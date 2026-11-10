// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in the other .pg tests */
// NK-0136 CA-1: runs migration 0085 (unique team rule title per company) on an in-process Postgres (PGlite) with two fictional
// companies. Never touches a real database. Same table as knowledge-voice.pg.test.ts (columns of types.ts, org_id defaulting to
// current_org(), the GRANTs of 0000, the audit trigger and the knowledge_docs policies of 0002).
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, REPO, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
const MIGRATION = "0085_knowledge_rules_unique_title.sql";
const INDEX = "knowledge_docs_team_rule_title_uniq";

const POLICIES_0002 = readFileSync(
  `${REPO}/drizzle/migrations/0002_multitenant_organizations.sql`,
  "utf8",
)
  .split("\n")
  .filter((l) => /^create policy .* on public\.knowledge_docs /.test(l))
  .join("\n");

const TABLE = `
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create table public.knowledge_docs (
    id uuid primary key default gen_random_uuid(),
    section text not null,
    title text not null,
    body text not null default '',
    scope text not null default 'team',
    created_by uuid, updated_by uuid,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
    mandatory boolean not null default false);
  grant select, insert, update, delete on public.knowledge_docs to authenticated;
  grant all on public.knowledge_docs to service_role;
  alter table public.knowledge_docs enable row level security;
  create trigger knowledge_docs_audit before insert or update on public.knowledge_docs for each row execute function public.set_audit();
  ${POLICIES_0002}
`;

const rows = async (db: Db, sql: string, params?: unknown[]) =>
  (await db.query(sql, params)).rows as Record<string, any>[];
const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return "";
  } catch (e) {
    return String((e as { code?: string }).code ?? (e as Error).message);
  }
};
const put = (db: Db, org: string, section: string, title: string, scope = "team") =>
  db.query(
    `insert into public.knowledge_docs (org_id, section, title, scope, created_by) values ($1, $2, $3, $4, $5)`,
    [org, section, title, scope, U.ownerA],
  );
const count = async (db: Db, org: string, title: string) =>
  (
    await rows(
      db,
      "select count(*)::int as n from public.knowledge_docs where org_id = $1 and lower(btrim(title)) = lower(btrim($2))",
      [org, title],
    )
  )[0]!.n as number;

let db: Db;
let A: string;
let B: string;
// Three more databases, built once in beforeAll (building one takes seconds, longer than a test may take under load).
type Fresh = { db: Db; org: string };
const fresh: Record<"clean" | "dupes" | "harmless", Fresh> = {} as never;
async function freshDb(rowsToPut: [string, string, string?][]): Promise<Fresh> {
  const f = await build();
  const { A: org } = await seed(f);
  await f.exec(TABLE);
  for (const [section, title, scope] of rowsToPut) await put(f, org, section, title, scope);
  return { db: f, org };
}

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(TABLE);
  await put(db, A, "rules", "Regla previa");
  await put(db, A, "company", "Repetido en otra sección");
  await migrate(db, [MIGRATION]);
  fresh.clean = await freshDb([
    ["rules", "Uno"],
    ["rules", "Uno", "personal"],
  ]);
  fresh.dupes = await freshDb([
    ["rules", "Duplicada"],
    ["rules", " duplicada "],
  ]);
  fresh.harmless = await freshDb([
    ["rules", "Igual", "personal"],
    ["rules", "Igual", "personal"],
    ["objections", "Igual"],
    ["objections", "Igual"],
  ]);
}, 60_000);

describe("the index", () => {
  it("is a partial unique index on org and the normalized title, only for team rules", async () => {
    const ix = (
      await rows(db, "select indexdef from pg_indexes where indexname = $1", [INDEX])
    )[0]!;
    expect(ix.indexdef).toMatch(/UNIQUE/);
    expect(ix.indexdef).toMatch(/org_id/);
    expect(ix.indexdef).toMatch(/lower\(btrim\(title\)\)/);
    expect(ix.indexdef).toMatch(/section = 'rules'/);
    expect(ix.indexdef).toMatch(/scope = 'team'/);
  });

  it("refuses a second team rule with the same title in the same company (unique_violation)", async () => {
    await put(db, A, "rules", "Nunca inventar");
    expect(await code(() => put(db, A, "rules", "Nunca inventar"))).toBe("23505");
    expect(await count(db, A, "Nunca inventar")).toBe(1);
  });

  it("treats case and surrounding spaces as the same title, as addDefaultRulesCore does", async () => {
    await put(db, A, "rules", "Siempre fuente y fecha");
    expect(await code(() => put(db, A, "rules", "  SIEMPRE fuente y FECHA "))).toBe("23505");
    expect(await count(db, A, "siempre fuente y fecha")).toBe(1);
  });

  it("allows the same title in another company, in another section and as a personal rule", async () => {
    await put(db, A, "rules", "Título libre");
    expect(await code(() => put(db, B, "rules", "Título libre"))).toBe("");
    expect(await code(() => put(db, A, "objections", "Título libre"))).toBe("");
    expect(await code(() => put(db, A, "rules", "Título libre", "personal"))).toBe("");
    expect(await count(db, A, "Título libre")).toBe(3);
  });

  it("makes the batch insert of the core all or nothing: one repeated title and none of the nine is written", async () => {
    await put(db, B, "rules", "Escalar cuando falte el ICP");
    const before = (
      await rows(db, "select count(*)::int as n from public.knowledge_docs where org_id = $1", [B])
    )[0]!.n;
    const err = await code(() =>
      db.query(
        `insert into public.knowledge_docs (org_id, section, title, scope)
         values ($1, 'rules', 'Nueva uno', 'team'), ($1, 'rules', 'escalar cuando falte el icp', 'team')`,
        [B],
      ),
    );
    expect(err).toBe("23505");
    const after = (
      await rows(db, "select count(*)::int as n from public.knowledge_docs where org_id = $1", [B])
    )[0]!.n;
    expect(after).toBe(before);
  });
});

describe("two sessions of the same company at once", () => {
  // The loop of addDefaultRulesCore in SQL: read the missing titles, insert them, on a lost race read again.
  const BASE = ["Base uno", "Base dos", "Base tres"];
  async function addMissing(session: string) {
    const have = new Set(
      (
        await rows(
          db,
          "select title from public.knowledge_docs where org_id = $1 and section = 'rules'",
          [A],
        )
      ).map((r) => String(r.title).trim().toLowerCase()),
    );
    const missing = BASE.filter((t) => !have.has(t.toLowerCase()));
    return { session, missing };
  }

  it("both read nothing, both insert: exactly one wins and nothing is duplicated", async () => {
    const [s1, s2] = await Promise.all([addMissing("1"), addMissing("2")]);
    expect(s1.missing).toEqual(BASE);
    expect(s2.missing).toEqual(BASE);
    const insert = (t: string[]) =>
      code(() =>
        db.query(
          `insert into public.knowledge_docs (org_id, section, title, scope) select $1, 'rules', t, 'team' from unnest($2::text[]) t`,
          [A, t],
        ),
      );
    const results = await Promise.all([insert(s1.missing), insert(s2.missing)]);
    expect(results.sort()).toEqual(["", "23505"]);
    for (const t of BASE) expect(await count(db, A, t)).toBe(1);
    // The loser reads again and finds nothing left to add.
    expect((await addMissing("2")).missing).toEqual([]);
  });
});

describe("the migration itself", () => {
  it("runs a second time without failing and keeps one index", async () => {
    await migrate(db, [MIGRATION]);
    const n = (
      await rows(db, "select count(*)::int as n from pg_indexes where indexname = $1", [INDEX])
    )[0]!.n;
    expect(n).toBe(1);
  });

  const idx = async (d: Db) =>
    (await rows(d, "select count(*)::int as n from pg_indexes where indexname = $1", [INDEX]))[0]!
      .n;

  it("changes no row", async () => {
    const { db: d } = fresh.clean;
    const h = async () =>
      (
        await rows(
          d,
          "select md5(string_agg(t::text, ',' order by id)) as h from public.knowledge_docs t",
        )
      )[0]!.h;
    const before = await h();
    await migrate(d, [MIGRATION]);
    expect(await h()).toBe(before);
    expect(await idx(d)).toBe(1);
  });

  it("stops with a clear message, and creates nothing, when a company already has two team rules with the same title", async () => {
    const { db: d } = fresh.dupes;
    const err = await migrate(d, [MIGRATION]).then(
      () => "",
      (e: Error) => String(e.message),
    );
    expect(err).toMatch(/0085/);
    expect(err).toMatch(/misma regla de equipo/);
    // The message never carries a title (client text).
    expect(err).not.toMatch(/duplicada/i);
    expect(await idx(d)).toBe(0);
    expect((await rows(d, "select count(*)::int as n from public.knowledge_docs"))[0]!.n).toBe(2);
  });

  it("is not blocked by personal or other-section duplicates", async () => {
    await migrate(fresh.harmless.db, [MIGRATION]);
    expect(await idx(fresh.harmless.db)).toBe(1);
  });

  it("carries a rollback script in its header that removes the index and touches no data", () => {
    const sql = readFileSync(`${REPO}/drizzle/migrations/${MIGRATION}`, "utf8");
    expect(sql).toMatch(/^-- drop index if exists public\.knowledge_docs_team_rule_title_uniq;$/m);
    expect(sql).not.toMatch(/^\s*(delete|update|truncate)\b/im);
  });

  it("works as a signed-in Owner through RLS: the refusal reaches the app as 23505", async () => {
    const err = await as(db, U.ownerA, () =>
      code(() =>
        db.query(
          `insert into public.knowledge_docs (section, title, scope) values ('rules', 'Nunca inventar', 'team')`,
        ),
      ),
    );
    expect(err).toBe("23505");
  });
});
