// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in the other .pg tests */
// SDD-20261110-company-voice-and-escalation-rules (NK-0128) U-2 · CA-1, CA-3: runs migrations 0081 and 0084 on an in-process
// Postgres (PGlite) with two fictional companies. Never touches a real database.
// Same harness as knowledge-binding.pg.test.ts: knowledge_docs is created with the columns of types.ts, org_id defaulting to
// current_org(), the GRANTs of 0000 and the four knowledge_docs policies of 0002 as they are in that file.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, REPO, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
const BINDING = "0081_knowledge_binding_writers.sql";
const MIGRATION = "0084_knowledge_voice_writers.sql";
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
const ids: Record<string, string> = {};

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

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(`
    insert into org_members (org_id, user_id, role) values ('${A}','${LEADER_A}','sales_leader'), ('${A}','${SDR_A}','sdr');
    insert into profiles (id, current_org_id) values ('${LEADER_A}','${A}'), ('${SDR_A}','${A}');
  `);
  await db.exec(TABLE(true));
  ids.voice = await existing(A, "voice", "Mensaje de ejemplo");
  ids.voiceByAe = await existing(A, "voice", "Escrito por un AE", { by: U.aeA });
  ids.voicePersonal = await existing(A, "voice", "Personal", { scope: "personal", by: U.aeA });
  ids.plain = await existing(A, "company", "Propuesta de valor");
  ids.plainByAe = await existing(A, "objections", "Es caro", { by: U.aeA });
  ids.voiceB = await existing(B, "voice", "Mensaje de B", { by: U.ownerB });
  before = await snapshot(db);
  await migrate(db, [BINDING, MIGRATION]);
}, 60_000);

describe("CA-3: the migration adds two restrictive policies and changes no row", () => {
  it("leaves every row of knowledge_docs as it was", async () => {
    expect(before.n).toBe(6);
    expect(await snapshot(db)).toEqual(before);
  });

  it("creates knowledge voice insert and update: restrictive, to authenticated, for their own command; 0081 stays", async () => {
    const pol = await rows(
      db,
      "select policyname, permissive, cmd, roles::text as roles from pg_policies where tablename = 'knowledge_docs' and policyname like 'knowledge %' order by 1",
    );
    expect(pol).toEqual([
      {
        policyname: "knowledge binding insert",
        permissive: "RESTRICTIVE",
        cmd: "INSERT",
        roles: "{authenticated}",
      },
      {
        policyname: "knowledge binding update",
        permissive: "RESTRICTIVE",
        cmd: "UPDATE",
        roles: "{authenticated}",
      },
      {
        policyname: "knowledge voice insert",
        permissive: "RESTRICTIVE",
        cmd: "INSERT",
        roles: "{authenticated}",
      },
      {
        policyname: "knowledge voice update",
        permissive: "RESTRICTIVE",
        cmd: "UPDATE",
        roles: "{authenticated}",
      },
    ]);
  });

  it("does not touch knowledge_doc_is_binding: voice is still not binding unless marked", async () => {
    const r = await rows(
      db,
      "select public.knowledge_doc_is_binding('voice','team',false) as plain, public.knowledge_doc_is_binding('voice','team',true) as marked",
    );
    expect(r[0]).toEqual({ plain: false, marked: true });
  });

  it("runs a second time without failing, keeps two voice policies and still changes no row", async () => {
    await migrate(db, [MIGRATION]);
    expect(await snapshot(db)).toEqual(before);
    const n = await rows(
      db,
      "select count(*)::int as n from pg_policies where tablename = 'knowledge_docs' and policyname like 'knowledge voice%'",
    );
    expect(n[0]!.n).toBe(2);
  });

  it("applies on a table rebuilt from the repo, where mandatory only exists in commented SQL", async () => {
    const fresh = await build();
    await fresh.exec(TABLE(false));
    await migrate(fresh, [BINDING, MIGRATION]);
    const col = (
      await fresh.query<Record<string, any>>(
        "select data_type from information_schema.columns where table_name = 'knowledge_docs' and column_name = 'mandatory'",
      )
    ).rows[0];
    expect(col).toEqual({ data_type: "boolean" });
  }, 60_000);

  it("the file carries its rollback script in a comment", () => {
    const sql = readFileSync(`${REPO}/drizzle/migrations/${MIGRATION}`, "utf8");
    expect(sql).toMatch(/^-- .*rollback/im);
    expect(sql).toContain(
      '-- drop policy if exists "knowledge voice insert" on public.knowledge_docs;',
    );
    expect(sql).toContain(
      '-- drop policy if exists "knowledge voice update" on public.knowledge_docs;',
    );
  });
});

describe("CA-1 + CA-3 (RLS, insert): a member that is not Owner or Sales Leader cannot create a voice document", () => {
  it.each([
    ["team", U.aeA],
    ["personal", U.aeA],
    ["team", SDR_A],
  ])("%s voice inserted by a non-leader is refused (row-level security)", async (scope, uid) => {
    const n0 = (await snapshot(db)).n;
    expect(await insertAs(uid, { section: "voice", scope, mandatory: false })).toMatch(
      /row-level security/,
    );
    expect((await snapshot(db)).n).toBe(n0);
  });

  it("the Owner and a Sales Leader create it", async () => {
    for (const uid of [U.ownerA, LEADER_A])
      expect(await insertAs(uid, { section: "voice", scope: "team", mandatory: false }), uid).toBe(
        "",
      );
  });

  it("nobody creates a voice document marked mandatory, not even the Owner", async () => {
    for (const uid of [U.ownerA, LEADER_A])
      expect(
        await insertAs(uid, { section: "voice", scope: "team", mandatory: true }),
        uid,
      ).toMatch(/row-level security/);
  });

  it("other sections stay open to a member as before (a plain company document)", async () => {
    expect(await insertAs(U.aeA, { section: "company", scope: "team", mandatory: false })).toBe("");
  });

  it("the Owner of B cannot write voice in A", async () => {
    expect(
      await insertAs(U.ownerB, { section: "voice", scope: "team", mandatory: false }, A),
    ).toMatch(/row-level security/);
  });
});

describe("CA-1 + CA-3 (RLS, update): edit, move in, move out and mark", () => {
  it("a member cannot edit a voice document, even one they wrote: no row touched, data unchanged", async () => {
    for (const id of [ids.voice!, ids.voiceByAe!, ids.voicePersonal!]) {
      const was = await docRow(id);
      const r = await updateAs(
        U.aeA,
        "update public.knowledge_docs set body = 'Otro texto.' where id = $1",
        [id],
      );
      expect(r).toEqual({ err: "", n: 0 });
      expect(await docRow(id)).toEqual(was);
    }
  });

  it("a member cannot move a document into voice (row-level security error), nor one out of it (no row touched)", async () => {
    const into = await updateAs(
      U.aeA,
      "update public.knowledge_docs set section = 'voice' where id = $1",
      [ids.plainByAe],
    );
    expect(into.err).toMatch(/row-level security/);
    expect((await docRow(ids.plainByAe!)).section).toBe("objections");
    const out = await updateAs(
      U.aeA,
      "update public.knowledge_docs set section = 'company' where id = $1",
      [ids.voiceByAe],
    );
    expect(out).toEqual({ err: "", n: 0 });
    expect((await docRow(ids.voiceByAe!)).section).toBe("voice");
  });

  it("a member cannot turn their personal voice document into a team one", async () => {
    const r = await updateAs(
      U.aeA,
      "update public.knowledge_docs set scope = 'team' where id = $1",
      [ids.voicePersonal],
    );
    expect(r).toEqual({ err: "", n: 0 });
    expect((await docRow(ids.voicePersonal!)).scope).toBe("personal");
  });

  it.each([
    ["owner", U.ownerA],
    ["sales_leader", LEADER_A],
  ])("%s edits a voice document and moves a plain one in and out", async (_r, uid) => {
    expect(
      await updateAs(uid, "update public.knowledge_docs set body = 'Editado.' where id = $1", [
        ids.voice,
      ]),
    ).toEqual({ err: "", n: 1 });
    const doc = await existing(A, "company", `Para mover ${_r}`);
    expect(
      await updateAs(uid, "update public.knowledge_docs set section = 'voice' where id = $1", [
        doc,
      ]),
    ).toEqual({ err: "", n: 1 });
    expect(
      await updateAs(uid, "update public.knowledge_docs set section = 'company' where id = $1", [
        doc,
      ]),
    ).toEqual({ err: "", n: 1 });
  });

  it.each([
    ["owner", U.ownerA],
    ["sales_leader", LEADER_A],
  ])("%s cannot mark a voice document mandatory (row-level security error)", async (_r, uid) => {
    const r = await updateAs(
      uid,
      "update public.knowledge_docs set mandatory = true where id = $1",
      [ids.voice],
    );
    expect(r.err).toMatch(/row-level security/);
    expect((await docRow(ids.voice!)).mandatory).toBe(false);
  });

  it("a plain document of another section is still edited by a member", async () => {
    const r = await updateAs(
      U.aeA,
      "update public.knowledge_docs set body = 'Editado por el AE.' where id = $1",
      [ids.plainByAe],
    );
    expect(r).toEqual({ err: "", n: 1 });
  });

  it("the Owner of B cannot edit a voice document of A: no row touched; in B it can", async () => {
    expect(
      await updateAs(U.ownerB, "update public.knowledge_docs set body = 'De B.' where id = $1", [
        ids.voice,
      ]),
    ).toEqual({ err: "", n: 0 });
    expect(
      await updateAs(U.ownerB, "update public.knowledge_docs set body = 'Propia.' where id = $1", [
        ids.voiceB,
      ]),
    ).toEqual({ err: "", n: 1 });
  });
});

describe("delete and the privileged client", () => {
  it("only the Owner deletes a voice document: the Sales Leader's delete touches no row (0002 intact)", async () => {
    const id = await existing(A, "voice", "Para borrar");
    const del = (uid: string) =>
      as(
        db,
        uid,
        async () =>
          (await db.query("delete from public.knowledge_docs where id = $1 returning id", [id]))
            .rows.length,
      );
    expect(await del(LEADER_A)).toBe(0);
    expect(await del(U.ownerA)).toBe(1);
  });

  it("service_role is not limited by the policies (no code path writes voice: Drive and the agent refuse it)", async () => {
    const err = await as(db, null, () =>
      fails(() =>
        db.query(
          "insert into public.knowledge_docs (org_id, section, title, body, scope) values ($1, 'voice', 'Del sistema', 'Texto ficticio.', 'team')",
          [A],
        ),
      ),
    );
    expect(err).toBe("");
  });
});
