// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in the other .pg tests */
// SDD-20261109-rules-write-permissions (NK-0095) U-1 · CA-1 to CA-7: runs migration 0081 on an in-process Postgres (PGlite)
// with two fictional companies. Never touches a real database.
// knowledge_docs is not in the harness: it is created here with the columns of types.ts (Row/Insert/Update), org_id defaulting
// to current_org(), the harness' set_audit trigger, the GRANTs of 0000 and the four knowledge_docs policies of 0002, read from
// that file as they are (the live policies were not read: SDD §16).
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, REPO, seed, U } from "@/test/pg-harness";
import { BINDING_CASES } from "@/test/knowledge-binding-cases";

type Db = Awaited<ReturnType<typeof build>>;
const MIGRATION = "0081_knowledge_binding_writers.sql";
const LEADER_A = "00000000-0000-4000-8000-0000000000a3";
const SDR_A = "00000000-0000-4000-8000-0000000000a4";

const POLICIES_0002 = readFileSync(
  `${REPO}/drizzle/migrations/0002_multitenant_organizations.sql`,
  "utf8",
)
  .split("\n")
  .filter((l) => /^create policy .* on public\.knowledge_docs /.test(l))
  .join("\n");

const TABLE = (withMandatory: boolean) => `
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create table public.knowledge_docs (
    id uuid primary key default gen_random_uuid(),
    section text not null,
    title text not null,
    body text not null default '',
    scope text not null default 'team',
    created_by uuid, updated_by uuid,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    org_id uuid default public.current_org() references public.organizations(id) on delete cascade
    ${withMandatory ? ", mandatory boolean not null default false" : ""});
  grant select, insert, update, delete on public.knowledge_docs to authenticated;
  grant all on public.knowledge_docs to service_role;
  alter table public.knowledge_docs enable row level security;
  create trigger knowledge_docs_audit before insert or update on public.knowledge_docs for each row execute function public.set_audit();
  ${POLICIES_0002}
`;

const rows = async (db: Db, sql: string, params?: unknown[]) =>
  (await db.query(sql, params)).rows as Record<string, any>[];
const fails = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return "";
  } catch (e) {
    return String((e as Error).message);
  }
};
const snapshot = async (db: Db) =>
  (
    await rows(
      db,
      "select md5(string_agg(t::text, ',' order by id)) as h, count(*)::int as n from public.knowledge_docs t",
    )
  )[0]!;

let db: Db;
let A: string;
let B: string;
let before: Record<string, any>;

/** A document written before the migration (service role, as old rows were). */
async function existing(
  org: string,
  section: string,
  title: string,
  o: { scope?: string; mandatory?: boolean; by?: string } = {},
) {
  return (
    await rows(
      db,
      `insert into public.knowledge_docs (org_id, section, title, body, scope, mandatory, created_by)
       values ($1, $2, $3, 'Texto ficticio.', $4, $5, $6) returning id`,
      [org, section, title, o.scope ?? "team", o.mandatory ?? false, o.by ?? U.ownerA],
    )
  )[0]!.id as string;
}
const insertAs = (
  uid: string,
  c: { section: string; scope: string; mandatory: boolean },
  org?: string,
) =>
  as(db, uid, () =>
    fails(() =>
      db.query(
        `insert into public.knowledge_docs (section, title, body, scope, mandatory${org ? ", org_id" : ""})
         values ($1, 'Nuevo', 'Texto ficticio.', $2, $3${org ? ", $4" : ""})`,
        org ? [c.section, c.scope, c.mandatory, org] : [c.section, c.scope, c.mandatory],
      ),
    ),
  );
/** Runs an update as uid: the error text ("" when none) and how many rows it touched. */
const updateAs = (uid: string, sql: string, params: unknown[]) =>
  as(db, uid, async () => {
    try {
      const r = await db.query(`${sql} returning id`, params);
      return { err: "", n: r.rows.length };
    } catch (e) {
      return { err: String((e as Error).message), n: 0 };
    }
  });
const docRow = async (id: string) =>
  (
    await rows(
      db,
      "select title, body, section, scope, mandatory from public.knowledge_docs where id = $1",
      [id],
    )
  )[0]!;

const ids: Record<string, string> = {};

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(`
    insert into org_members (org_id, user_id, role) values ('${A}','${LEADER_A}','sales_leader'), ('${A}','${SDR_A}','sdr');
    insert into profiles (id, current_org_id) values ('${LEADER_A}','${A}'), ('${SDR_A}','${A}');
  `);
  await db.exec(TABLE(true));
  // Documents that exist before the migration, some written by a member that will no longer be able to edit them.
  ids.rule = await existing(A, "rules", "Regla del equipo");
  ids.ruleByAe = await existing(A, "rules", "Regla escrita por un AE", { by: U.aeA });
  ids.mandatory = await existing(A, "company", "Precios obligatorios", { mandatory: true });
  ids.plain = await existing(A, "company", "Propuesta de valor");
  ids.plain2 = await existing(A, "objections", "Es caro");
  ids.personalRule = await existing(A, "rules", "Mi regla", { scope: "personal", by: U.aeA });
  ids.personalMandatory = await existing(A, "company", "Mi obligatorio", {
    scope: "personal",
    mandatory: true,
    by: U.aeA,
  });
  ids.ruleB = await existing(B, "rules", "Regla de B", { by: U.ownerB });
  before = await snapshot(db);
  await migrate(db, [MIGRATION]);
}, 60_000);

describe("CA-5: existing documents do not change and the migration can run again", () => {
  it("leaves every row of knowledge_docs as it was (same rows, same columns)", async () => {
    expect(before.n).toBe(8);
    expect(await snapshot(db)).toEqual(before);
  });

  it("runs a second time without failing and still changes no row", async () => {
    await migrate(db, [MIGRATION]);
    expect(await snapshot(db)).toEqual(before);
    const pol = await rows(
      db,
      "select policyname, permissive from pg_policies where tablename = 'knowledge_docs' and policyname like 'knowledge binding%' order by 1",
    );
    expect(pol).toEqual([
      { policyname: "knowledge binding insert", permissive: "RESTRICTIVE" },
      { policyname: "knowledge binding update", permissive: "RESTRICTIVE" },
    ]);
  });

  it("applies on a table rebuilt from the repo, where mandatory only exists in commented SQL", async () => {
    const fresh = await build();
    await fresh.exec(TABLE(false));
    await migrate(fresh, [MIGRATION]);
    const col = (
      await fresh.query<Record<string, any>>(
        "select data_type, is_nullable, column_default from information_schema.columns where table_name = 'knowledge_docs' and column_name = 'mandatory'",
      )
    ).rows[0];
    expect(col).toEqual({ data_type: "boolean", is_nullable: "NO", column_default: "false" });
  }, 60_000);
});

describe("CA-7: knowledge_doc_is_binding gives the shared table of cases", () => {
  it.each(BINDING_CASES)("$name → binding $binding", async (c) => {
    const r = await rows(db, "select public.knowledge_doc_is_binding($1, $2, $3) as b", [
      c.section,
      c.scope,
      c.mandatory,
    ]);
    expect(r[0]!.b).toBe(c.binding);
  });

  it("reads a null mandatory as not marked", async () => {
    const r = await rows(
      db,
      "select public.knowledge_doc_is_binding('company', 'team', null) as b",
    );
    expect(r[0]!.b).toBe(false);
  });

  it("anon cannot execute it; authenticated can", async () => {
    await db.exec("set role anon");
    const err = await fails(() =>
      db.query("select public.knowledge_doc_is_binding('rules','team',false)"),
    );
    await db.exec("reset role");
    expect(err).toMatch(/permission denied/);
    expect(
      await as(db, U.aeA, () =>
        fails(() => db.query("select public.knowledge_doc_is_binding('rules','team',false)")),
      ),
    ).toBe("");
  });
});

describe("CA-1 + CA-7 (RLS, insert): a member that is not Owner or Sales Leader cannot create a binding document", () => {
  it.each(BINDING_CASES)("ae inserts «$name»: allowed only when it is not binding", async (c) => {
    const n0 = (await snapshot(db)).n;
    const err = await insertAs(U.aeA, c);
    if (c.binding) {
      expect(err).toMatch(/row-level security/);
      expect((await snapshot(db)).n).toBe(n0);
    } else {
      expect(err).toBe("");
      expect((await snapshot(db)).n).toBe(n0 + 1);
    }
  });

  it("an sdr cannot insert a team rule either", async () => {
    expect(await insertAs(SDR_A, { section: "rules", scope: "team", mandatory: false })).toMatch(
      /row-level security/,
    );
  });
});

describe("CA-2 (RLS, edit): a member that is not Owner or Sales Leader cannot edit, mark, move, share or unmark", () => {
  it("cannot change the title or text of a team rule, even one they wrote: no row touched, data unchanged", async () => {
    for (const id of [ids.rule!, ids.ruleByAe!]) {
      const was = await docRow(id);
      const r = await updateAs(
        U.aeA,
        "update public.knowledge_docs set title = 'Cambiada', body = 'Otro texto.' where id = $1",
        [id],
      );
      expect(r).toEqual({ err: "", n: 0 });
      expect(await docRow(id)).toEqual(was);
    }
  });

  it("cannot change a team document marked mandatory of another section", async () => {
    const was = await docRow(ids.mandatory!);
    const r = await updateAs(
      U.aeA,
      "update public.knowledge_docs set body = 'Otro texto.' where id = $1",
      [ids.mandatory],
    );
    expect(r).toEqual({ err: "", n: 0 });
    expect(await docRow(ids.mandatory!)).toEqual(was);
  });

  it("cannot mark a team document as mandatory (row-level security error)", async () => {
    const r = await updateAs(
      U.aeA,
      "update public.knowledge_docs set mandatory = true where id = $1",
      [ids.plain],
    );
    expect(r.err).toMatch(/row-level security/);
    expect((await docRow(ids.plain!)).mandatory).toBe(false);
  });

  it("cannot move a team document to rules (row-level security error)", async () => {
    const r = await updateAs(
      U.aeA,
      "update public.knowledge_docs set section = 'rules' where id = $1",
      [ids.plain],
    );
    expect(r.err).toMatch(/row-level security/);
    expect((await docRow(ids.plain!)).section).toBe("company");
  });

  it("cannot turn their personal rule or personal mandatory document into a team one (row-level security error)", async () => {
    for (const id of [ids.personalRule!, ids.personalMandatory!]) {
      const r = await updateAs(
        U.aeA,
        "update public.knowledge_docs set scope = 'team' where id = $1",
        [id],
      );
      expect(r.err).toMatch(/row-level security/);
      expect((await docRow(id)).scope).toBe("personal");
    }
  });

  it("cannot unmark mandatory on a team document: no row touched", async () => {
    const r = await updateAs(
      U.aeA,
      "update public.knowledge_docs set mandatory = false where id = $1",
      [ids.mandatory],
    );
    expect(r).toEqual({ err: "", n: 0 });
    expect((await docRow(ids.mandatory!)).mandatory).toBe(true);
  });

  it("still edits a team document that is not binding, saving mandatory = false as the screen does", async () => {
    const r = await updateAs(
      U.aeA,
      "update public.knowledge_docs set body = 'Editado por el AE.', mandatory = false where id = $1",
      [ids.plain2],
    );
    expect(r).toEqual({ err: "", n: 1 });
    expect((await docRow(ids.plain2!)).body).toBe("Editado por el AE.");
  });

  it("still edits their own personal rule", async () => {
    const r = await updateAs(
      U.aeA,
      "update public.knowledge_docs set body = 'Mi nota.' where id = $1",
      [ids.personalRule],
    );
    expect(r).toEqual({ err: "", n: 1 });
  });
});

describe("CA-3 (RLS): the Owner and a Sales Leader do all of it; only the Owner deletes", () => {
  it.each([
    ["owner", U.ownerA],
    ["sales_leader", LEADER_A],
  ])("%s inserts every case of the table", async (_role, uid) => {
    for (const c of BINDING_CASES) expect(await insertAs(uid, c), c.name).toBe("");
  });

  it.each([
    ["owner", U.ownerA],
    ["sales_leader", LEADER_A],
  ])("%s edits a rule, marks, moves, shares and unmarks", async (role, uid) => {
    const plain = await existing(A, "company", `Doc ${role}`);
    const personal = await existing(A, "rules", `Personal ${role}`, { scope: "personal", by: uid });
    const steps: [string, unknown[]][] = [
      ["update public.knowledge_docs set body = 'Editada.' where id = $1", [ids.rule]],
      ["update public.knowledge_docs set body = 'Editado.' where id = $1", [ids.mandatory]],
      ["update public.knowledge_docs set mandatory = true where id = $1", [plain]],
      ["update public.knowledge_docs set mandatory = false where id = $1", [plain]],
      ["update public.knowledge_docs set section = 'rules' where id = $1", [plain]],
      ["update public.knowledge_docs set scope = 'team' where id = $1", [personal]],
    ];
    for (const [sql, p] of steps)
      expect(await updateAs(uid, sql, p), sql).toEqual({ err: "", n: 1 });
    expect(await docRow(plain)).toMatchObject({ section: "rules", mandatory: false });
    expect((await docRow(personal)).scope).toBe("team");
  });

  it("the Sales Leader still cannot delete (0002 policy intact); the Owner can", async () => {
    const id = await existing(A, "rules", "Para borrar");
    const n = await as(
      db,
      LEADER_A,
      async () =>
        (await db.query("delete from public.knowledge_docs where id = $1 returning id", [id])).rows
          .length,
    );
    expect(n).toBe(0);
    const m = await as(
      db,
      U.ownerA,
      async () =>
        (await db.query("delete from public.knowledge_docs where id = $1 returning id", [id])).rows
          .length,
    );
    expect(m).toBe(1);
  });
});

describe("CA-4 (multi-company): the Owner of B cannot write binding documents of A", () => {
  it("cannot insert a rule or a mandatory document into A, nor a plain one (as today)", async () => {
    for (const c of [
      { section: "rules", scope: "team", mandatory: false },
      { section: "company", scope: "team", mandatory: true },
      { section: "company", scope: "team", mandatory: false },
    ])
      expect(await insertAs(U.ownerB, c, A)).toMatch(/row-level security/);
  });

  it("cannot edit a rule of A: no row touched", async () => {
    const was = await docRow(ids.rule!);
    const r = await updateAs(
      U.ownerB,
      "update public.knowledge_docs set body = 'De B.' where id = $1",
      [ids.rule],
    );
    expect(r).toEqual({ err: "", n: 0 });
    expect(await docRow(ids.rule!)).toEqual(was);
  });

  it("still writes rules in their own company", async () => {
    const r = await updateAs(
      U.ownerB,
      "update public.knowledge_docs set body = 'Editada en B.' where id = $1",
      [ids.ruleB],
    );
    expect(r).toEqual({ err: "", n: 1 });
  });
});

describe("CA-6 (privileged client): service_role is not limited by the policies", () => {
  it("inserts and edits binding documents (so the code repeats the rule: CA-9 to CA-11)", async () => {
    const err = await as(db, null, () =>
      fails(() =>
        db.query(
          "insert into public.knowledge_docs (org_id, section, title, body, scope) values ($1, 'rules', 'Del sistema', 'Texto ficticio.', 'team')",
          [A],
        ),
      ),
    );
    expect(err).toBe("");
    const n = await as(
      db,
      null,
      async () =>
        (
          await db.query(
            "update public.knowledge_docs set body = 'Sistema.' where id = $1 returning id",
            [ids.mandatory],
          )
        ).rows.length,
    );
    expect(n).toBe(1);
  });
});
