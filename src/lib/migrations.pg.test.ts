// @vitest-environment node
// Runs migrations 0058 (provenance trigger), 0060 (change log and undo) and 0061 (provenance on strategy tables) on an
// in-process Postgres with two fictional companies (see src/test/pg-harness.ts for what it does and does not model).
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string;
const rows = async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows as Record<string, any>[];
const throws = async (fn: () => Promise<unknown>) => { try { await fn(); return ""; } catch (e) { return String((e as Error).message); } };
const fs = async (table: string, id: string) => (await rows(`select field_sources from ${table} where id = $1`, [id]))[0]!.field_sources;
const log = () => rows("select id, table_name, op, row_id, org_id, before, after, changed_by from field_edit_log order by changed_at, id");

let acc: string, icp: string, icpB: string, seg: string, pil: string, pos: string;

beforeAll(async () => {
  db = await build();
  ({ A } = await seed(db));
  await migrate(db, ["0058_field_sources_generic.sql"]);
}, 60_000);

describe("migration 0058: provenance trigger on accounts and icp_profiles", () => {
  it("stamps a signed-in edit as persona, confirmed, with who and when; untouched fields get no mark", async () => {
    await as(db, U.ownerA, async () => { acc = (await rows("insert into accounts (name, industry, size, country) values ('Acme','Fintech','10 empleados','ES') returning id"))[0]!.id; });
    await as(db, U.aeA, async () => { await db.query("update accounts set industry = 'Seguros' where id = $1", [acc]); });
    const s = await fs("accounts", acc);
    expect(s.industry).toMatchObject({ kind: "persona", confirmed: true, confirmedBy: U.aeA });
    expect(s.industry.at && s.industry.confirmedAt).toBeTruthy();
    expect(s).not.toHaveProperty("size");
    expect(s).not.toHaveProperty("country");
  });

  it("clearing a value removes its mark; a service-role update that does not touch field_sources drops it", async () => {
    await as(db, U.aeA, async () => { await db.query("update accounts set industry = '' where id = $1", [acc]); });
    expect(await fs("accounts", acc)).not.toHaveProperty("industry");
    await as(db, U.aeA, async () => { await db.query("update accounts set size = '20 empleados' where id = $1", [acc]); });
    await as(db, null, async () => { await db.query("update accounts set size = '30 empleados' where id = $1", [acc]); });
    expect(await fs("accounts", acc)).not.toHaveProperty("size");
  });

  it("an update that also sends field_sources is kept exactly as sent", async () => {
    await as(db, U.aeA, async () => { await db.query(`update accounts set country = 'FR', field_sources = '{"country":{"source":"apollo","at":"2026-10-01T00:00:00Z"}}'::jsonb where id = $1`, [acc]); });
    expect((await fs("accounts", acc)).country).toMatchObject({ source: "apollo" });
  });

  it("icp_profiles: array and numeric edits are stamped, an emptied array loses its mark, other columns get none", async () => {
    await as(db, U.ownerA, async () => { icp = (await rows("insert into icp_profiles (name) values ('Agencias') returning id"))[0]!.id; });
    await as(db, U.ownerB, async () => { icpB = (await rows("insert into icp_profiles (name) values ('Otros') returning id"))[0]!.id; });
    await as(db, U.aeA, async () => { await db.query("update icp_profiles set countries = array['ES','MX'], min_employees = 10 where id = $1", [icp]); });
    let s = await fs("icp_profiles", icp);
    expect(s.countries.kind).toBe("persona");
    expect(s.min_employees.kind).toBe("persona");
    await as(db, U.aeA, async () => { await db.query("update icp_profiles set countries = array[]::text[], name = 'Agencias 2' where id = $1", [icp]); });
    s = await fs("icp_profiles", icp);
    expect(s).not.toHaveProperty("countries");
    expect(s).not.toHaveProperty("name");
  });

  it("a member of company A sees and edits only company A's rows", async () => {
    await as(db, U.aeA, async () => {
      expect((await rows("select id from icp_profiles")).map((r) => r.id)).toEqual([icp]);
      expect(await rows("update icp_profiles set name = 'hack' where id = $1 returning id", [icpB])).toHaveLength(0);
      expect(await rows("select id from accounts")).toHaveLength(1);
    });
  });
});

describe("migration 0060: change log and undo", () => {
  beforeAll(async () => {
    await migrate(db, ["0060_field_edit_log.sql", "0061_field_sources_strategy.sql"]);
    await as(db, U.ownerA, async () => {
      seg = (await rows("insert into segments (name) values ('Pymes') returning id"))[0]!.id;
      pil = (await rows("insert into messaging_pillars (title) values ('Ahorro') returning id"))[0]!.id;
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
    expect(L.every((e) => e.op === "update" && e.org_id === A && e.changed_by === U.aeA)).toBe(true);
    expect(L[0]!.before.name).toBe("Pymes");
    expect(L[0]!.after.name).toBe("Pymes ES");
  });

  it("an update that only moves updated_at, updated_by or field_sources writes nothing", async () => {
    await as(db, U.aeA, async () => { await db.query(`update segments set field_sources = '{"name":{"source":"x","at":"y"}}'::jsonb where id = $1`, [seg]); });
    expect(await log()).toHaveLength(4);
  });

  it("a member reads their company's log, nobody writes it directly, and another company sees none of it", async () => {
    await as(db, U.aeA, async () => {
      expect(await rows("select id from field_edit_log")).toHaveLength(4);
      expect(await throws(() => db.query("insert into field_edit_log (org_id, table_name, row_id, op, before) values ($1,'segments',$2,'update','{}')", [A, seg]))).not.toBe("");
      expect(await throws(() => db.query("update field_edit_log set undone_at = now()"))).not.toBe("");
      expect(await throws(() => db.query("delete from field_edit_log"))).not.toBe("");
    });
    await as(db, U.ownerB, async () => { expect(await rows("select id from field_edit_log")).toHaveLength(0); });
  });

  it("undo restores an edit only while the row still equals what the edit left; it writes no new log row and cannot repeat", async () => {
    const first = (await log()).find((e) => e.table_name === "segments")!.id;
    await as(db, U.aeA, async () => { await db.query("update segments set name = 'Pymes ES v2' where id = $1", [seg]); });
    const second = (await log()).filter((e) => e.table_name === "segments").pop()!.id;
    expect(await as(db, U.aeA, () => throws(() => db.query("select public.undo_field_edit($1)", [first])))).toMatch(/cambió después/);
    await as(db, U.aeA, async () => { await db.query("select public.undo_field_edit($1)", [second]); });
    expect((await rows("select name from segments where id = $1", [seg]))[0]!.name).toBe("Pymes ES");
    expect(await log()).toHaveLength(5);
    expect(await as(db, U.aeA, () => throws(() => db.query("select public.undo_field_edit($1)", [second])))).toMatch(/Ya lo deshiciste/);
    expect(await as(db, U.ownerB, () => throws(() => db.query("select public.undo_field_edit($1)", [first])))).toMatch(/No encuentro/);
  });

  it("only the Owner deletes and undoes a delete; the row comes back with its original id and no new log row", async () => {
    await as(db, U.aeA, async () => { expect(await rows("delete from messaging_pillars where id = $1 returning id", [pil])).toHaveLength(0); });
    await as(db, U.ownerA, async () => { await db.query("delete from messaging_pillars where id = $1", [pil]); });
    const del = (await log()).find((e) => e.op === "delete")!;
    expect(del.before.title).toBe("Ahorro real");
    expect(del.row_id).toBe(pil);
    expect(await as(db, U.aeA, () => throws(() => db.query("select public.undo_field_edit($1)", [del.id])))).toMatch(/Solo el Owner/);
    await as(db, U.ownerA, async () => { await db.query("select public.undo_field_edit($1)", [del.id]); });
    const back = await rows("select id, title, org_id from messaging_pillars where id = $1", [pil]);
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ title: "Ahorro real", org_id: A });
    expect(await log()).toHaveLength(6);
  });

  it("after 24 hours undo refuses", async () => {
    const e = (await log()).find((x) => x.table_name === "positioning")!;
    await db.exec(`update field_edit_log set changed_at = now() - interval '25 hours' where id = '${e.id}'`);
    expect(await as(db, U.ownerA, () => throws(() => db.query("select public.undo_field_edit($1)", [e.id])))).toMatch(/pasaron más de 24 horas/);
  });

  it("deleting a whole company (cascade) neither fails nor writes log rows", async () => {
    const C = (await rows("insert into organizations (name) values ('Empresa C') returning id"))[0]!.id;
    await db.exec(`insert into segments (org_id, name) values ('${C}','S1'); insert into messaging_pillars (org_id, title) values ('${C}','P1');`);
    const before = (await log()).length;
    expect(await throws(() => db.query("delete from organizations where id = $1", [C]))).toBe("");
    expect(await log()).toHaveLength(before);
  });
});

describe("migration 0061: provenance on positioning, messaging_pillars and segments", () => {
  it("adds field_sources with a default to the three tables", async () => {
    const cols = await rows("select table_name from information_schema.columns where column_name = 'field_sources' and table_name in ('positioning','messaging_pillars','segments') order by 1");
    expect(cols.map((c) => c.table_name)).toEqual(["messaging_pillars", "positioning", "segments"]);
    expect((await fs("segments", seg))).not.toBeNull();
  });

  it("stamps a signed-in edit, drops the mark on a cleared value or a service-role update, and keeps what is sent", async () => {
    await as(db, U.aeA, async () => {
      await db.query("update messaging_pillars set pain = 'Coste' where id = $1", [pil]);
      await db.query("update positioning set tagline = 'Vende más', value = 'ahorro' where id = $1", [pos]);
      await db.query("update segments set acv_min = 1000, motion = 'inside' where id = $1", [seg]);
    });
    for (const [table, id, fields] of [["messaging_pillars", pil, ["pain"]], ["positioning", pos, ["tagline", "value"]], ["segments", seg, ["acv_min", "motion"]]] as const) {
      const s = await fs(table, id);
      for (const f of fields) expect(s[f], `${table}.${f}`).toMatchObject({ kind: "persona", confirmedBy: U.aeA });
    }
    await as(db, U.aeA, async () => { await db.query("update positioning set tagline = '' where id = $1", [pos]); });
    expect(await fs("positioning", pos)).not.toHaveProperty("tagline");
    await as(db, null, async () => { await db.query("update segments set motion = 'field' where id = $1", [seg]); });
    expect(await fs("segments", seg)).not.toHaveProperty("motion");
    await as(db, U.aeA, async () => { await db.query(`update messaging_pillars set field_sources = field_sources || '{"title":{"source":"persona","kind":"persona","confirmed":true,"at":"a","confirmedBy":"x","confirmedAt":"b"}}'::jsonb where id = $1`, [pil]); });
    expect((await fs("messaging_pillars", pil)).title.confirmedBy).toBe("x");
  });

  it("members still edit, another company cannot, and the audit trigger still stamps updated_by", async () => {
    await as(db, U.aeA, async () => { expect(await rows("update segments set name = 'x' where id = $1 returning id", [seg])).toHaveLength(1); });
    await as(db, U.ownerB, async () => { expect(await rows("update segments set name = 'hack' where id = $1 returning id", [seg])).toHaveLength(0); });
    expect((await rows("select updated_by from segments where id = $1", [seg]))[0]!.updated_by).toBe(U.aeA);
  });
});
