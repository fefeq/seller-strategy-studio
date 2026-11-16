// @vitest-environment node
// Runs migrations 0058 (provenance trigger), 0060 (change log and undo), 0061 (provenance on strategy tables), 0062 (setup step
// snoozes), 0063 (undo keeps confirmations) on an in-process Postgres with two fictional companies (see src/test/pg-harness.ts for what it does and does not model).
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, seed, U } from "@/test/pg-harness";
import { ROLES } from "@/lib/roles";
import { SETUP_STEP_IDS, STEP_ROLES, canCompleteStep } from "@/lib/setup-guide";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string;
const rows = async (sql: string, params?: unknown[]) =>
  (await db.query(sql, params)).rows as Record<string, any>[];
const throws = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return "";
  } catch (e) {
    return String((e as Error).message);
  }
};
const fs = async (table: string, id: string) =>
  (await rows(`select field_sources from ${table} where id = $1`, [id]))[0]!.field_sources;
const log = () =>
  rows(
    "select id, table_name, op, row_id, org_id, before, after, changed_by from field_edit_log order by changed_at, id",
  );

/** quotas and deals are not in the harness: minimal versions with the audit trigger and company policies. */
async function addQuotasAndDeals(d: Db) {
  await d.exec(`
    create table public.quotas (id uuid primary key default gen_random_uuid(), org_id uuid default public.current_org(), period text not null, amount numeric not null, user_id uuid, created_by uuid, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table public.deals (id uuid primary key default gen_random_uuid(), org_id uuid default public.current_org(), name text not null, created_by uuid, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    do $$ declare t text; begin foreach t in array array['quotas','deals'] loop
      execute format('alter table public.%I enable row level security', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      execute format('grant all on public.%I to service_role', t);
      execute format('create policy "org all" on public.%I for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit()', t || '_audit', t);
    end loop; end $$;`);
}

let acc: string, icp: string, icpB: string, seg: string, pil: string, pos: string;

beforeAll(async () => {
  db = await build();
  ({ A } = await seed(db));
  await migrate(db, ["0058_field_sources_generic.sql"]);
}, 60_000);

describe("migration 0058: provenance trigger on accounts and icp_profiles", () => {
  it("stamps a signed-in edit as persona, confirmed, with who and when; untouched fields get no mark", async () => {
    await as(db, U.ownerA, async () => {
      acc = (
        await rows(
          "insert into accounts (name, industry, size, country) values ('Acme','Fintech','10 empleados','ES') returning id",
        )
      )[0]!.id;
    });
    await as(db, U.aeA, async () => {
      await db.query("update accounts set industry = 'Seguros' where id = $1", [acc]);
    });
    const s = await fs("accounts", acc);
    expect(s.industry).toMatchObject({ kind: "persona", confirmed: true, confirmedBy: U.aeA });
    expect(s.industry.at && s.industry.confirmedAt).toBeTruthy();
    expect(s).not.toHaveProperty("size");
    expect(s).not.toHaveProperty("country");
  });

  it("clearing a value removes its mark; a service-role update that does not touch field_sources drops it", async () => {
    await as(db, U.aeA, async () => {
      await db.query("update accounts set industry = '' where id = $1", [acc]);
    });
    expect(await fs("accounts", acc)).not.toHaveProperty("industry");
    await as(db, U.aeA, async () => {
      await db.query("update accounts set size = '20 empleados' where id = $1", [acc]);
    });
    await as(db, null, async () => {
      await db.query("update accounts set size = '30 empleados' where id = $1", [acc]);
    });
    expect(await fs("accounts", acc)).not.toHaveProperty("size");
  });

  it("an update that also sends field_sources is kept exactly as sent", async () => {
    await as(db, U.aeA, async () => {
      await db.query(
        `update accounts set country = 'FR', field_sources = '{"country":{"source":"apollo","at":"2026-10-01T00:00:00Z"}}'::jsonb where id = $1`,
        [acc],
      );
    });
    expect((await fs("accounts", acc)).country).toMatchObject({ source: "apollo" });
  });

  it("icp_profiles: array and numeric edits are stamped, an emptied array loses its mark, other columns get none", async () => {
    await as(db, U.ownerA, async () => {
      icp = (await rows("insert into icp_profiles (name) values ('Agencias') returning id"))[0]!.id;
    });
    await as(db, U.ownerB, async () => {
      icpB = (await rows("insert into icp_profiles (name) values ('Otros') returning id"))[0]!.id;
    });
    await as(db, U.aeA, async () => {
      await db.query(
        "update icp_profiles set countries = array['ES','MX'], min_employees = 10 where id = $1",
        [icp],
      );
    });
    let s = await fs("icp_profiles", icp);
    expect(s.countries.kind).toBe("persona");
    expect(s.min_employees.kind).toBe("persona");
    await as(db, U.aeA, async () => {
      await db.query(
        "update icp_profiles set countries = array[]::text[], name = 'Agencias 2' where id = $1",
        [icp],
      );
    });
    s = await fs("icp_profiles", icp);
    expect(s).not.toHaveProperty("countries");
    expect(s).not.toHaveProperty("name");
  });

  it("a member of company A sees and edits only company A's rows", async () => {
    await as(db, U.aeA, async () => {
      expect((await rows("select id from icp_profiles")).map((r) => r.id)).toEqual([icp]);
      expect(
        await rows("update icp_profiles set name = 'hack' where id = $1 returning id", [icpB]),
      ).toHaveLength(0);
      expect(await rows("select id from accounts")).toHaveLength(1);
    });
  });
});

describe("migration 0060: change log and undo", () => {
  beforeAll(async () => {
    await migrate(db, [
      "0060_field_edit_log.sql",
      "0061_field_sources_strategy.sql",
      "0063_undo_keeps_confirmations.sql",
    ]);
    await as(db, U.ownerA, async () => {
      seg = (await rows("insert into segments (name) values ('Pymes') returning id"))[0]!.id;
      pil = (await rows("insert into messaging_pillars (title) values ('Ahorro') returning id"))[0]!
        .id;
      pos = (await rows("insert into positioning (category) values ('CRM') returning id"))[0]!.id;
    });
  });

  it("inserts are not logged; an edit of each of the four tables writes one row with company, op, who, before and after", async () => {
    expect(await log()).toHaveLength(0);
    await as(db, U.aeA, async () => {
      await db.query("update segments set name = 'Pymes ES' where id = $1", [seg]);
      await db.query("update messaging_pillars set title = 'Ahorro real' where id = $1", [pil]);
      await db.query("update positioning set category = 'CRM B2B' where id = $1", [pos]);
      await db.query("update icp_profiles set industries = 'agencias' where id = $1", [icp]);
    });
    const L = await log();
    expect(L).toHaveLength(4);
    expect(L.every((e) => e.op === "update" && e.org_id === A && e.changed_by === U.aeA)).toBe(
      true,
    );
    expect(L[0]!.before.name).toBe("Pymes");
    expect(L[0]!.after.name).toBe("Pymes ES");
  });

  it("an update that only moves updated_at, updated_by or field_sources writes nothing", async () => {
    await as(db, U.aeA, async () => {
      await db.query(
        `update segments set field_sources = '{"name":{"source":"x","at":"y"}}'::jsonb where id = $1`,
        [seg],
      );
    });
    expect(await log()).toHaveLength(4);
  });

  it("a member reads their company's log, nobody writes it directly, and another company sees none of it", async () => {
    await as(db, U.aeA, async () => {
      expect(await rows("select id from field_edit_log")).toHaveLength(4);
      expect(
        await throws(() =>
          db.query(
            "insert into field_edit_log (org_id, table_name, row_id, op, before) values ($1,'segments',$2,'update','{}')",
            [A, seg],
          ),
        ),
      ).not.toBe("");
      expect(await throws(() => db.query("update field_edit_log set undone_at = now()"))).not.toBe(
        "",
      );
      expect(await throws(() => db.query("delete from field_edit_log"))).not.toBe("");
    });
    await as(db, U.ownerB, async () => {
      expect(await rows("select id from field_edit_log")).toHaveLength(0);
    });
  });

  it("the log table gives anon nothing and authenticated only SELECT, even though Supabase grants everything to new tables (TRUNCATE would skip RLS)", async () => {
    const priv = async (role: string) =>
      (
        await rows(
          "select privilege_type from information_schema.table_privileges where table_schema='public' and table_name='field_edit_log' and grantee = $1 order by 1",
          [role],
        )
      ).map((r) => r.privilege_type);
    expect(await priv("anon")).toEqual([]);
    expect(await priv("authenticated")).toEqual(["SELECT"]);
    expect(await priv("service_role")).toContain("INSERT");
  });

  it("undo restores an edit only while the row still equals what the edit left; it writes no new log row and cannot repeat", async () => {
    const first = (await log()).find((e) => e.table_name === "segments")!.id;
    await as(db, U.aeA, async () => {
      await db.query("update segments set name = 'Pymes ES v2' where id = $1", [seg]);
    });
    const second = (await log()).filter((e) => e.table_name === "segments").pop()!.id;
    expect(
      await as(db, U.aeA, () =>
        throws(() => db.query("select public.undo_field_edit($1)", [first])),
      ),
    ).toMatch(/cambió después/);
    await as(db, U.aeA, async () => {
      await db.query("select public.undo_field_edit($1)", [second]);
    });
    expect((await rows("select name from segments where id = $1", [seg]))[0]!.name).toBe(
      "Pymes ES",
    );
    expect(await log()).toHaveLength(5);
    expect(
      await as(db, U.aeA, () =>
        throws(() => db.query("select public.undo_field_edit($1)", [second])),
      ),
    ).toMatch(/Ya lo deshiciste/);
    expect(
      await as(db, U.ownerB, () =>
        throws(() => db.query("select public.undo_field_edit($1)", [first])),
      ),
    ).toMatch(/No encuentro/);
  });

  it("only the Owner deletes and undoes a delete; the row comes back with its original id and no new log row", async () => {
    await as(db, U.aeA, async () => {
      expect(
        await rows("delete from messaging_pillars where id = $1 returning id", [pil]),
      ).toHaveLength(0);
    });
    await as(db, U.ownerA, async () => {
      await db.query("delete from messaging_pillars where id = $1", [pil]);
    });
    const del = (await log()).find((e) => e.op === "delete")!;
    expect(del.before.title).toBe("Ahorro real");
    expect(del.row_id).toBe(pil);
    expect(
      await as(db, U.aeA, () =>
        throws(() => db.query("select public.undo_field_edit($1)", [del.id])),
      ),
    ).toMatch(/Solo el Owner/);
    await as(db, U.ownerA, async () => {
      await db.query("select public.undo_field_edit($1)", [del.id]);
    });
    const back = await rows("select id, title, org_id from messaging_pillars where id = $1", [pil]);
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ title: "Ahorro real", org_id: A });
    expect(await log()).toHaveLength(6);
  });

  it("after 24 hours undo refuses", async () => {
    const e = (await log()).find((x) => x.table_name === "positioning")!;
    await db.exec(
      `update field_edit_log set changed_at = now() - interval '25 hours' where id = '${e.id}'`,
    );
    expect(
      await as(db, U.ownerA, () =>
        throws(() => db.query("select public.undo_field_edit($1)", [e.id])),
      ),
    ).toMatch(/pasaron más de 24 horas/);
  });

  it("deleting a whole company (cascade) neither fails nor writes log rows", async () => {
    const C = (await rows("insert into organizations (name) values ('Empresa C') returning id"))[0]!
      .id;
    await db.exec(
      `insert into segments (org_id, name) values ('${C}','S1'); insert into messaging_pillars (org_id, title) values ('${C}','P1');`,
    );
    const before = (await log()).length;
    expect(await throws(() => db.query("delete from organizations where id = $1", [C]))).toBe("");
    expect(await log()).toHaveLength(before);
  });
});

describe("migration 0061: provenance on positioning, messaging_pillars and segments", () => {
  it("adds field_sources with a default to the three tables", async () => {
    const cols = await rows(
      "select table_name from information_schema.columns where column_name = 'field_sources' and table_name in ('positioning','messaging_pillars','segments') order by 1",
    );
    expect(cols.map((c) => c.table_name)).toEqual(["messaging_pillars", "positioning", "segments"]);
    expect(await fs("segments", seg)).not.toBeNull();
  });

  it("stamps a signed-in edit, drops the mark on a cleared value or a service-role update, and keeps what is sent", async () => {
    await as(db, U.aeA, async () => {
      await db.query("update messaging_pillars set pain = 'Coste' where id = $1", [pil]);
      await db.query(
        "update positioning set tagline = 'Vende más', value = 'ahorro' where id = $1",
        [pos],
      );
      await db.query("update segments set acv_min = 1000, motion = 'field' where id = $1", [seg]);
    });
    for (const [table, id, fields] of [
      ["messaging_pillars", pil, ["pain"]],
      ["positioning", pos, ["tagline", "value"]],
      ["segments", seg, ["acv_min", "motion"]],
    ] as const) {
      const s = await fs(table, id);
      for (const f of fields)
        expect(s[f], `${table}.${f}`).toMatchObject({ kind: "persona", confirmedBy: U.aeA });
    }
    await as(db, U.aeA, async () => {
      await db.query("update positioning set tagline = '' where id = $1", [pos]);
    });
    expect(await fs("positioning", pos)).not.toHaveProperty("tagline");
    await as(db, null, async () => {
      await db.query("update segments set motion = 'plg' where id = $1", [seg]);
    });
    expect(await fs("segments", seg)).not.toHaveProperty("motion");
    await as(db, U.aeA, async () => {
      await db.query(
        `update messaging_pillars set field_sources = field_sources || '{"title":{"source":"persona","kind":"persona","confirmed":true,"at":"a","confirmedBy":"x","confirmedAt":"b"}}'::jsonb where id = $1`,
        [pil],
      );
    });
    expect((await fs("messaging_pillars", pil)).title.confirmedBy).toBe("x");
  });

  it("members still edit, another company cannot, and the audit trigger still stamps updated_by", async () => {
    await as(db, U.aeA, async () => {
      expect(
        await rows("update segments set name = 'x' where id = $1 returning id", [seg]),
      ).toHaveLength(1);
    });
    await as(db, U.ownerB, async () => {
      expect(
        await rows("update segments set name = 'hack' where id = $1 returning id", [seg]),
      ).toHaveLength(0);
    });
    expect(
      (await rows("select updated_by from segments where id = $1", [seg]))[0]!.updated_by,
    ).toBe(U.aeA);
  });
});

describe("what the real database has that the migrations must live with (catalog read 2026-10-26)", () => {
  it("positioning_copy_guard still runs next to the provenance trigger: an edit of a public text is stamped and its approval is cleared, and only leaders approve", async () => {
    await as(db, U.ownerA, async () => {
      await db.query("update positioning set tagline = 'Una frase' where id = $1", [pos]);
    });
    await as(db, U.ownerA, async () => {
      await db.query(
        `update positioning set copy_status = '{"tagline":{"status":"approved","by":"x","at":"y"}}'::jsonb where id = $1`,
        [pos],
      );
    });
    expect(
      (await rows("select copy_status from positioning where id = $1", [pos]))[0]!.copy_status,
    ).toHaveProperty("tagline");
    await as(db, U.aeA, async () => {
      await db.query("update positioning set tagline = 'Otra frase' where id = $1", [pos]);
    });
    expect(
      (await rows("select copy_status from positioning where id = $1", [pos]))[0]!.copy_status,
    ).not.toHaveProperty("tagline");
    expect((await fs("positioning", pos)).tagline).toMatchObject({
      kind: "persona",
      confirmedBy: U.aeA,
    });
    const t = await as(db, U.aeA, () =>
      throws(() =>
        db.query(
          `update positioning set copy_status = '{"one_liner":{"status":"approved","by":"x","at":"y"}}'::jsonb where id = $1`,
          [pos],
        ),
      ),
    );
    expect(t).toMatch(/Solo el Owner o el Sales Leader/);
  });

  it("deleting an ICP with its NOT NULL array columns and undoing it restores every column", async () => {
    let id = "";
    await as(db, U.ownerA, async () => {
      id = (
        await rows(
          "insert into icp_profiles (name, countries, search_keywords, segment_id) values ('Con arrays', array['ES','FR'], array['crm','sales'], $1) returning id",
          [seg],
        )
      )[0]!.id;
    });
    await as(db, U.ownerA, async () => {
      await db.query("delete from icp_profiles where id = $1", [id]);
    });
    const del = (await log())
      .filter((e) => e.op === "delete" && e.table_name === "icp_profiles")
      .pop()!;
    await as(db, U.ownerA, async () => {
      await db.query("select public.undo_field_edit($1)", [del.id]);
    });
    const back = (
      await rows(
        "select name, countries, search_keywords, seniorities, segment_id from icp_profiles where id = $1",
        [id],
      )
    )[0]!;
    expect(back).toMatchObject({
      name: "Con arrays",
      countries: ["ES", "FR"],
      search_keywords: ["crm", "sales"],
      seniorities: [],
      segment_id: seg,
    });
  });

  it("deleting a segment cascades to its targets and assignment rules and logs only the segment: that is why a segment in use is never deleted", async () => {
    let s2 = "";
    await as(db, U.ownerA, async () => {
      s2 = (await rows("insert into segments (name) values ('Con datos') returning id"))[0]!.id;
      await db.query(
        "insert into segment_targets (segment_id, period, amount) values ($1,'2026-Q4',1000)",
        [s2],
      );
      await db.query("insert into account_assignment_rules (segment_id) values ($1)", [s2]);
    });
    const before = (await log()).length;
    await as(db, U.ownerA, async () => {
      await db.query("delete from segments where id = $1", [s2]);
    });
    const added = (await log()).slice(before);
    expect(added.map((e) => e.table_name)).toEqual(["segments"]);
    expect(await rows("select id from segment_targets where segment_id = $1", [s2])).toHaveLength(
      0,
    );
    expect(
      await rows("select id from account_assignment_rules where segment_id = $1", [s2]),
    ).toHaveLength(0);
  });
});

describe("migration 0063: undoing an edit keeps the confirmations of other fields", () => {
  it("gives the reverted field its previous mark (none) and leaves a later confirmation of another field alone", async () => {
    let id = "";
    await as(db, U.ownerA, async () => {
      id = (
        await rows("insert into messaging_pillars (title) values ('Pilar 63') returning id")
      )[0]!.id;
    });
    await as(db, U.aeA, async () => {
      await db.query("update messaging_pillars set pain = 'Dolor nuevo' where id = $1", [id]);
    });
    const edit = (await log()).filter((e) => e.row_id === id).pop()!;
    // someone confirms the title after the edit (field_sources only: not logged)
    await as(db, U.aeA, async () => {
      await db.query(
        `update messaging_pillars set field_sources = field_sources || '{"title":{"source":"sin_origen","kind":"sin_dato","confirmed":true,"at":"a","confirmedBy":"x","confirmedAt":"b"}}'::jsonb where id = $1`,
        [id],
      );
    });
    await as(db, U.aeA, async () => {
      await db.query("select public.undo_field_edit($1)", [edit.id]);
    });
    const row = (
      await rows("select pain, field_sources from messaging_pillars where id = $1", [id])
    )[0]!;
    expect(row.pain).toBe("");
    expect(row.field_sources).not.toHaveProperty("pain");
    expect(row.field_sources.title).toMatchObject({ confirmed: true });
  });

  it("gives back the mark the field had before the edit", async () => {
    let id = "";
    await as(db, U.ownerA, async () => {
      id = (
        await rows(
          "insert into messaging_pillars (title, message) values ('Pilar 63b', 'Original') returning id",
        )
      )[0]!.id;
    });
    await db.exec(
      `update messaging_pillars set field_sources = '{"message":{"source":"clay","at":"x"}}'::jsonb where id = '${id}'`,
    );
    await as(db, U.aeA, async () => {
      await db.query("update messaging_pillars set message = 'Cambiado' where id = $1", [id]);
    });
    expect(
      (await rows("select field_sources from messaging_pillars where id = $1", [id]))[0]!
        .field_sources.message.kind,
    ).toBe("persona");
    const edit = (await log()).filter((e) => e.row_id === id).pop()!;
    await as(db, U.aeA, async () => {
      await db.query("select public.undo_field_edit($1)", [edit.id]);
    });
    const row = (
      await rows("select message, field_sources from messaging_pillars where id = $1", [id])
    )[0]!;
    expect(row.message).toBe("Original");
    expect(row.field_sources.message).toEqual({ source: "clay", at: "x" });
  });
});

describe("migration 0062: setup step snoozes", () => {
  let B: string;
  beforeAll(async () => {
    await migrate(db, ["0062_setup_step_snoozes.sql"]);
    B = (await rows("select id from organizations where name = 'Empresa B'"))[0]!.id;
  });
  const until = "2026-11-03T11:00:00Z";

  it("1. a member of company A reads and writes A's snoozes, and org_id and snoozed_by fill themselves", async () => {
    await as(db, U.aeA, async () => {
      await db.query(
        "insert into setup_step_snoozes (step_id, snoozed_until) values ('accounts', $1)",
        [until],
      );
    });
    await as(db, U.ownerA, async () => {
      const r = await rows("select org_id, step_id, snoozed_by from setup_step_snoozes");
      expect(r).toEqual([{ org_id: A, step_id: "accounts", snoozed_by: U.aeA }]);
      // an update must also say who made it (the app's upsert always does)
      expect(
        await throws(() =>
          db.query(
            "update setup_step_snoozes set snoozed_until = '2026-11-10T11:00:00Z' where step_id = 'accounts'",
          ),
        ),
      ).not.toBe("");
      await db.query(
        "update setup_step_snoozes set snoozed_until = '2026-11-10T11:00:00Z', snoozed_by = $1 where step_id = 'accounts'",
        [U.ownerA],
      );
    });
    await as(db, U.aeA, async () => {
      expect(await rows("select snoozed_until from setup_step_snoozes")).toHaveLength(1);
    });
  });

  it("2. a member of company A cannot read, update or delete company B's snoozes, nor write one into B", async () => {
    await as(db, U.ownerB, async () => {
      await db.query(
        "insert into setup_step_snoozes (step_id, snoozed_until) values ('quota', $1)",
        [until],
      );
    });
    await as(db, U.ownerA, async () => {
      expect((await rows("select step_id from setup_step_snoozes")).map((r) => r.step_id)).toEqual([
        "accounts",
      ]);
      expect(
        await rows(
          "update setup_step_snoozes set snoozed_until = now() where org_id = $1 returning step_id",
          [B],
        ),
      ).toHaveLength(0);
      expect(
        await rows("delete from setup_step_snoozes where org_id = $1 returning step_id", [B]),
      ).toHaveLength(0);
      expect(
        await throws(() =>
          db.query(
            "insert into setup_step_snoozes (org_id, step_id, snoozed_until) values ($1,'deals',$2)",
            [B, until],
          ),
        ),
      ).not.toBe("");
    });
    await as(db, U.ownerB, async () => {
      expect(await rows("select step_id from setup_step_snoozes")).toHaveLength(1);
    });
  });

  it("3. snoozed_by is the signed-in person: another person's id is refused on insert and on update", async () => {
    await as(db, U.ownerA, async () => {
      expect(
        await throws(() =>
          db.query(
            "insert into setup_step_snoozes (step_id, snoozed_until, snoozed_by) values ('deals', $1, $2)",
            [until, U.aeA],
          ),
        ),
      ).not.toBe("");
      expect(
        await throws(() =>
          db.query("update setup_step_snoozes set snoozed_by = $1 where step_id = 'accounts'", [
            U.aeA,
          ]),
        ),
      ).not.toBe("");
      await db.query(
        "update setup_step_snoozes set snoozed_until = '2026-11-12T11:00:00Z', snoozed_by = $1 where step_id = 'accounts'",
        [U.ownerA],
      );
    });
  });

  it("4. deleting a company deletes its snoozes", async () => {
    const C = (await rows("insert into organizations (name) values ('Empresa C') returning id"))[0]!
      .id;
    await db.exec(
      `insert into setup_step_snoozes (org_id, step_id, snoozed_until) values ('${C}','deals','${until}')`,
    );
    await db.exec(`delete from organizations where id = '${C}'`);
    expect(await rows("select 1 from setup_step_snoozes where org_id = $1", [C])).toHaveLength(0);
  });

  it("5. only a role that can complete the step may snooze or clear it", async () => {
    // an AE completes accounts and deals, not quota
    await as(db, U.aeA, async () => {
      expect(
        await throws(() =>
          db.query("insert into setup_step_snoozes (step_id, snoozed_until) values ('quota', $1)", [
            until,
          ]),
        ),
      ).not.toBe("");
      expect(
        await throws(() =>
          db.query(
            "insert into setup_step_snoozes (step_id, snoozed_until) values ('no_such_step', $1)",
            [until],
          ),
        ),
      ).not.toBe("");
    });
    await as(db, U.ownerA, async () => {
      await db.query(
        "insert into setup_step_snoozes (step_id, snoozed_until) values ('quota', $1)",
        [until],
      );
    });
    await as(db, U.aeA, async () => {
      expect(
        await rows(
          "update setup_step_snoozes set snoozed_until = '2026-12-01T11:00:00Z' where step_id = 'quota' returning step_id",
          [],
        ),
      ).toHaveLength(0);
      expect(
        await rows("delete from setup_step_snoozes where step_id = 'quota' returning step_id"),
      ).toHaveLength(0);
      expect(
        await rows("select step_id from setup_step_snoozes where step_id = 'quota'"),
      ).toHaveLength(1); // members still read it
    });
    await as(db, U.ownerA, async () => {
      expect(
        await rows("delete from setup_step_snoozes where step_id = 'quota' returning step_id"),
      ).toHaveLength(1);
    });
  });

  it("5. the SQL role rule and STEP_ROLES say the same for every step and every role", async () => {
    const roles = Object.keys(ROLES);
    for (const [i, role] of roles.entries()) {
      const uid = `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
      await db.exec(
        `insert into org_members (org_id, user_id, role) values ('${A}','${uid}','${role}')`,
      );
      for (const step of SETUP_STEP_IDS) {
        const sql = (
          await as(db, uid, () =>
            rows("select public.can_complete_setup_step($1, $2) as ok", [A, step]),
          )
        )[0]!.ok;
        expect(sql, `${role} / ${step}`).toBe(canCompleteStep(step, role));
      }
    }
    expect(Object.keys(STEP_ROLES).sort()).toEqual([...SETUP_STEP_IDS].sort());
    const outsider = (
      await as(db, U.ownerB, () =>
        rows("select public.can_complete_setup_step($1, 'deals') as ok", [A]),
      )
    )[0]!.ok;
    expect(outsider).toBe(false);
  });

  it("6. anon gets nothing and authenticated only SELECT, INSERT, UPDATE and DELETE, even though Supabase grants everything to new tables", async () => {
    const priv = async (role: string) =>
      (
        await rows(
          "select privilege_type from information_schema.table_privileges where table_schema='public' and table_name='setup_step_snoozes' and grantee = $1 order by 1",
          [role],
        )
      ).map((r) => r.privilege_type);
    expect(await priv("anon")).toEqual([]);
    expect(await priv("authenticated")).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
    expect(await priv("service_role")).toContain("TRUNCATE");
  });
});

describe("migration 0064: last_human_edit_at, only what a person changed", () => {
  const TABLES = [
    "positioning",
    "segments",
    "quotas",
    "accounts",
    "deals",
    "icp_profiles",
    "messaging_pillars",
  ];
  const INSERT: Record<string, string> = {
    positioning: "insert into positioning (category) values ('X') returning id",
    segments: "insert into segments (name) values ('S64') returning id",
    quotas: "insert into quotas (period, amount) values ('2026-Q4', 1) returning id",
    accounts: "insert into accounts (name) values ('Acc64') returning id",
    deals: "insert into deals (name) values ('Deal64') returning id",
    icp_profiles: "insert into icp_profiles (name) values ('Icp64') returning id",
    messaging_pillars: "insert into messaging_pillars (title) values ('P64') returning id",
  };
  const SET: Record<string, string> = {
    positioning: "category = 'Y'",
    segments: "name = 'S64b'",
    quotas: "amount = 2",
    accounts: "name = 'Acc64b'",
    deals: "name = 'Deal64b'",
    icp_profiles: "name = 'Icp64b'",
    messaging_pillars: "title = 'P64b'",
  };
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await addQuotasAndDeals(db);
    await migrate(db, ["0064_last_human_edit_at.sql"]);
  });
  const stamp = async (t: string, id: string) =>
    (await rows(`select last_human_edit_at, updated_at from ${t} where id = $1`, [id]))[0]!;

  it("4. the column exists on the seven tables the setup steps read", async () => {
    const r = await rows(
      "select table_name from information_schema.columns where column_name = 'last_human_edit_at' and table_schema = 'public' order by 1",
    );
    expect(r.map((x) => x.table_name)).toEqual([...TABLES].sort());
  });

  it("1. a signed-in insert and update stamp it", async () => {
    for (const t of TABLES) {
      await as(db, U.aeA, async () => {
        ids[t] = (await rows(INSERT[t]!))[0]!.id;
      });
      expect((await stamp(t, ids[t]!)).last_human_edit_at, `${t} insert`).not.toBeNull();
      await db.exec(`update ${t} set last_human_edit_at = null where id = '${ids[t]}'`); // as superuser: no auth.uid(), so the trigger keeps what is there
      await as(db, U.ownerA, async () => {
        await db.query(`update ${t} set ${SET[t]} where id = $1`, [ids[t]]);
      });
      expect((await stamp(t, ids[t]!)).last_human_edit_at, `${t} update`).not.toBeNull();
    }
  });

  it("2. an update with no signed-in person leaves it as it was while updated_at moves", async () => {
    for (const t of TABLES) {
      const before = await stamp(t, ids[t]!);
      await as(db, null, async () => {
        await db.query(`update ${t} set ${SET[t]!.replace(/'(.*)b?'/, "'auto'")} where id = $1`, [
          ids[t],
        ]);
      });
      const after = await stamp(t, ids[t]!);
      expect(after.last_human_edit_at, t).toEqual(before.last_human_edit_at);
      expect(new Date(after.updated_at).getTime(), t).toBeGreaterThan(
        new Date(before.updated_at).getTime(),
      );
    }
  });

  it("3. an insert with no signed-in person leaves it empty", async () => {
    await as(db, null, async () => {
      const id = (
        await rows("insert into accounts (name, org_id) values ('Auto64', $1) returning id", [A])
      )[0]!.id;
      expect((await stamp("accounts", id)).last_human_edit_at).toBeNull();
    });
  });

  it("5. a value sent by the client is overwritten", async () => {
    await as(db, U.aeA, async () => {
      const id = (
        await rows(
          "insert into segments (name, last_human_edit_at) values ('Forged', '2000-01-01') returning id",
        )
      )[0]!.id;
      expect(
        new Date((await stamp("segments", id)).last_human_edit_at).getFullYear(),
      ).toBeGreaterThan(2000);
    });
    const keep = (await stamp("segments", ids["segments"]!)).last_human_edit_at;
    await as(db, null, async () => {
      await db.query("update segments set last_human_edit_at = '2000-01-01' where id = $1", [
        ids["segments"],
      ]);
    });
    expect((await stamp("segments", ids["segments"]!)).last_human_edit_at).toEqual(keep);
  });
});

describe("migration 0065: company_diagnosis shares only the diagnosis", () => {
  const D = (n: string) => JSON.stringify({ result: { name: n } });
  beforeAll(async () => {
    await migrate(db, ["0052_onboarding_sessions.sql"]);
    await migrate(db, ["0065_company_diagnosis.sql"]);
    await db.exec(`insert into onboarding_sessions (org_id, user_id, diagnosis, updated_at) values
      ('${A}', '${U.ownerA}', '${D("Dueño")}', '2026-10-20T10:00:00Z'),
      ('${A}', '${U.aeA}', null, '2026-10-26T10:00:00Z')`);
  });
  const diag = (uid: string | null, org = A) =>
    as(db, uid, async () => (await rows("select public.company_diagnosis($1) as d", [org]))[0]!.d);

  it("1. a member without a diagnosis of their own gets a colleague's", async () => {
    expect(await diag(U.aeA)).toEqual({ result: { name: "Dueño" } });
  });
  it("2. their own wins over a colleague's, and among colleagues the most recently updated", async () => {
    await db.exec(
      `update onboarding_sessions set diagnosis = '${D("Mía")}', updated_at = '2026-10-21T10:00:00Z' where user_id = '${U.aeA}'`,
    );
    expect(await diag(U.aeA)).toEqual({ result: { name: "Mía" } });
    expect(await diag(U.ownerA)).toEqual({ result: { name: "Dueño" } });
    const u3 = "00000000-0000-4000-8000-0000000000c3";
    await db.exec(
      `insert into org_members (org_id, user_id, role) values ('${A}','${u3}','marketing'); insert into profiles (id, current_org_id) values ('${u3}','${A}');`,
    );
    expect(await diag(u3)).toEqual({ result: { name: "Mía" } }); // newest of the two
  });
  it("3. someone outside the company gets nothing, and so does anon", async () => {
    expect(await diag(U.ownerB)).toBeNull();
    expect(
      await as(db, U.ownerB, () =>
        throws(() => db.query("select public.company_diagnosis($1)", [A])),
      ),
    ).toBe("");
    await db.exec("set role anon");
    expect(await throws(() => db.query("select public.company_diagnosis($1)", [A]))).not.toBe("");
    await db.exec("reset role");
  });
  it("4. the table's policy is unchanged: a colleague's row (proposal, findings) is still not readable directly", async () => {
    await as(db, U.aeA, async () => {
      expect((await rows("select user_id from onboarding_sessions")).map((r) => r.user_id)).toEqual(
        [U.aeA],
      );
    });
  });
});

describe("migrations 0060, 0063, 0064 and 0066 together: undo survives a confirmation", () => {
  let d: Db, A2: string;
  // rows are free-shaped SQL results, as in `rows` at the top of this file
  const rows2 = async (sql: string, params?: unknown[]) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await d.query(sql, params)).rows as Record<string, any>[];
  const log2 = () => rows2("select id, row_id, op from field_edit_log order by changed_at, id");
  const confirm = (id: string, field: string) =>
    as(d, U.aeA, async () => {
      await d.query(
        `update messaging_pillars set field_sources = field_sources || '{"${field}":{"source":"persona","kind":"persona","confirmed":true,"at":"a","confirmedBy":"x","confirmedAt":"b"}}'::jsonb where id = $1`,
        [id],
      );
    });
  const pillar = async (title: string) => {
    let id = "";
    await as(d, U.ownerA, async () => {
      id = (
        await rows2("insert into messaging_pillars (title) values ($1) returning id", [title])
      )[0]!.id;
    });
    return id;
  };

  beforeAll(async () => {
    d = await build();
    ({ A: A2 } = await seed(d));
    await addQuotasAndDeals(d);
    await migrate(d, [
      "0058_field_sources_generic.sql",
      "0060_field_edit_log.sql",
      "0061_field_sources_strategy.sql",
      "0063_undo_keeps_confirmations.sql",
      "0064_last_human_edit_at.sql",
    ]);
  }, 60_000);

  it("why 0066 exists: with 0064 but without it, confirming another field logs a second edit and blocks the undo", async () => {
    const id = await pillar("Sin 0066");
    await as(d, U.aeA, async () => {
      await d.query("update messaging_pillars set pain = 'Nuevo' where id = $1", [id]);
    });
    const edit = (await log2()).filter((e) => e.row_id === id).pop()!;
    await confirm(id, "title");
    expect((await log2()).filter((e) => e.row_id === id)).toHaveLength(2); // the confirmation was logged as an edit
    expect(
      await as(d, U.aeA, () =>
        d.query("select public.undo_field_edit($1)", [edit.id]).then(
          () => "",
          (e) => String((e as Error).message),
        ),
      ),
    ).toMatch(/cambió después/);
  });

  describe("with 0066 applied", () => {
    beforeAll(async () => {
      await migrate(d, ["0066_undo_ignores_last_human_edit.sql"]);
    });

    it("1-2. an edit, a confirmation of another field, then the undo of the edit: one log row, the undo works and the confirmation stays", async () => {
      const id = await pillar("Pilar 66");
      const before = (await log2()).length;
      await as(d, U.aeA, async () => {
        await d.query("update messaging_pillars set pain = 'Dolor nuevo' where id = $1", [id]);
      });
      await confirm(id, "title");
      expect((await log2()).length - before).toBe(1);
      const edit = (await log2()).filter((e) => e.row_id === id).pop()!;
      await as(d, U.aeA, async () => {
        await d.query("select public.undo_field_edit($1)", [edit.id]);
      });
      const row = (
        await rows2("select pain, field_sources from messaging_pillars where id = $1", [id])
      )[0]!;
      expect(row.pain).toBe("");
      expect(row.field_sources).not.toHaveProperty("pain");
      expect(row.field_sources.title).toMatchObject({ confirmed: true }); // «leaves a later confirmation of another field alone», now with 0064
    });

    it("2. the previous mark of the reverted field comes back", async () => {
      let id = "";
      await as(d, U.ownerA, async () => {
        id = (
          await rows2(
            "insert into messaging_pillars (title, message) values ('Pilar 66b', 'Original') returning id",
          )
        )[0]!.id;
      });
      await d.exec(
        `update messaging_pillars set field_sources = '{"message":{"source":"clay","at":"x"}}'::jsonb where id = '${id}'`,
      );
      await as(d, U.aeA, async () => {
        await d.query("update messaging_pillars set message = 'Cambiado' where id = $1", [id]);
      });
      await confirm(id, "title");
      const edit = (await log2()).filter((e) => e.row_id === id).pop()!;
      await as(d, U.aeA, async () => {
        await d.query("select public.undo_field_edit($1)", [edit.id]);
      });
      const row = (
        await rows2("select message, field_sources from messaging_pillars where id = $1", [id])
      )[0]!;
      expect(row.message).toBe("Original");
      expect(row.field_sources.message).toEqual({ source: "clay", at: "x" });
      expect(row.field_sources.title).toMatchObject({ confirmed: true });
    });

    it("3. the confirmation still moves last_human_edit_at: confirming is activity of a person", async () => {
      const id = await pillar("Pilar 66c");
      const t0 = (
        await rows2("select last_human_edit_at t from messaging_pillars where id = $1", [id])
      )[0]!.t;
      await new Promise((r) => setTimeout(r, 15)); // timestamps have millisecond resolution here
      await confirm(id, "title");
      const t1 = (
        await rows2("select last_human_edit_at t from messaging_pillars where id = $1", [id])
      )[0]!.t;
      expect(new Date(t1).getTime()).toBeGreaterThan(new Date(t0).getTime());
    });

    it("4. a real edit of another field after the first still blocks the undo of the first", async () => {
      const id = await pillar("Pilar 66d");
      await as(d, U.aeA, async () => {
        await d.query("update messaging_pillars set pain = 'Uno' where id = $1", [id]);
      });
      const first = (await log2()).filter((e) => e.row_id === id).pop()!;
      await as(d, U.aeA, async () => {
        await d.query("update messaging_pillars set proof = 'Dos' where id = $1", [id]);
      });
      expect(
        await as(d, U.aeA, () =>
          d.query("select public.undo_field_edit($1)", [first.id]).then(
            () => "",
            (e) => String((e as Error).message),
          ),
        ),
      ).toMatch(/cambió después/);
    });

    it("undo of a delete and the 24 hour limit are unchanged, and another company still cannot undo", async () => {
      const id = await pillar("Pilar 66e");
      await as(d, U.ownerA, async () => {
        await d.query("delete from messaging_pillars where id = $1", [id]);
      });
      const del = (await log2()).filter((e) => e.row_id === id && e.op === "delete").pop()!;
      expect(
        await as(d, U.ownerB, () =>
          d.query("select public.undo_field_edit($1)", [del.id]).then(
            () => "",
            (e) => String((e as Error).message),
          ),
        ),
      ).toMatch(/No encuentro/);
      await as(d, U.ownerA, async () => {
        await d.query("select public.undo_field_edit($1)", [del.id]);
      });
      expect(await rows2("select id from messaging_pillars where id = $1", [id])).toHaveLength(1);
    });
  });
});

describe("migration 0067: partial index for the activity query", () => {
  const TABLES = [
    "positioning",
    "segments",
    "quotas",
    "accounts",
    "deals",
    "icp_profiles",
    "messaging_pillars",
  ];
  beforeAll(async () => {
    await migrate(db, ["0067_last_human_edit_index.sql"]);
  });

  it("the seven indexes exist, on (org_id, last_human_edit_at DESC) and only for rows someone edited", async () => {
    const r = await rows(
      "select tablename, indexdef from pg_indexes where schemaname = 'public' and indexname like '%_org_human_edit_idx' order by tablename",
    );
    expect(r.map((x) => x.tablename)).toEqual([...TABLES].sort());
    for (const x of r) {
      expect(x.indexdef).toContain("(org_id, last_human_edit_at DESC)");
      expect(x.indexdef).toContain("WHERE (last_human_edit_at IS NOT NULL)");
    }
  });

  it("the nudge's query for each table is answered from its index", async () => {
    for (const t of TABLES) {
      await db.exec("set enable_seqscan = off"); // a tiny test table would otherwise prefer a scan; this checks the index can serve the query
      const plan = (
        await rows(
          `explain select last_human_edit_at from ${t} where org_id = '${A}' and last_human_edit_at is not null order by last_human_edit_at desc limit 1`,
        )
      )
        .map((x) => x["QUERY PLAN"])
        .join("\n");
      await db.exec("reset enable_seqscan");
      expect(plan, t).toContain(`${t}_org_human_edit_idx`);
    }
  });

  it("re-running the migration changes nothing", async () => {
    await migrate(db, ["0067_last_human_edit_index.sql"]);
  });
});

describe("migration hygiene (audit point 5): re-running 0062 and the search_path of the security definer functions", () => {
  it("0062 can be run again: its policies are dropped and recreated, not duplicated", async () => {
    await migrate(db, ["0062_setup_step_snoozes.sql"]);
    const p = await rows(
      "select policyname from pg_policies where tablename = 'setup_step_snoozes' order by policyname",
    );
    expect(p).toHaveLength(4);
    await as(db, U.aeA, async () => {
      expect((await rows("select 1 from setup_step_snoozes")).length).toBeGreaterThan(0);
    }); // data kept, policies still work
  });

  it("can_complete_setup_step and company_diagnosis pin search_path to public, pg_temp", async () => {
    for (const fn of ["can_complete_setup_step", "company_diagnosis"]) {
      const r = (
        await rows(
          "select prosecdef, proconfig from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace",
          [fn],
        )
      )[0]!;
      expect(r.prosecdef, fn).toBe(true);
      expect(r.proconfig, fn).toContain("search_path=public, pg_temp");
    }
  });
});
