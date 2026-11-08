// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in the other .pg tests */
// NK-0057 U-0: migration 0080 versions ten tables and one function that existed in the real database without a migration.
// Runs on an in-process Postgres (PGlite) with two fictional companies. Never touches a real database.
// The definitions were checked against the real catalog on 2026-11-08 (columns, constraints, indexes, policies and triggers of
// the ten tables hash the same); this test pins the behaviour that matters: it can be applied twice, RLS is on, and a company
// never sees another's rows.
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string;
let B: string;
const TABLES = [
  "activities",
  "deal_offers",
  "email_templates",
  "finance_cost_lines",
  "finance_invoices",
  "finance_months",
  "finance_settings",
  "forecast_snapshots",
  "teams",
  "team_members",
];
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

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  // The tables the new ones point at are not part of the harness: minimal stand-ins with the columns the foreign keys need.
  await db.exec(
    "create table public.deals (id uuid primary key default gen_random_uuid(), org_id uuid); create table public.people (id uuid primary key default gen_random_uuid(), org_id uuid);",
  );
  await migrate(db, ["0080_unversioned_schema_capture.sql"]);
}, 60_000);

describe("0080 schema capture", () => {
  it("can be applied again without failing and leaves one of everything", async () => {
    await migrate(db, ["0080_unversioned_schema_capture.sql"]);
    const pol = await rows(
      "select tablename, count(*)::int n from pg_policies where schemaname = 'public' and tablename = any($1) group by 1",
      [TABLES],
    );
    expect(pol).toHaveLength(10);
    expect(pol.every((r) => r.n === 4)).toBe(true);
    const trg = await rows(
      "select count(*)::int n from pg_trigger where not tgisinternal and tgname like '%\\_audit' and tgrelid = any($1::regclass[])",
      [TABLES.map((t) => `public.${t}`)],
    );
    expect(trg[0]!.n).toBe(10);
  });

  it("turns row level security on for every one of the ten tables", async () => {
    const r = await rows(
      "select relname from pg_class where relnamespace = 'public'::regnamespace and relname = any($1) and not relrowsecurity",
      [TABLES],
    );
    expect(r).toEqual([]);
  });

  it("keeps a company out of another's rows and finance data out of members who are not owner or sales leader", async () => {
    await as(db, U.ownerA, () =>
      db.query("insert into finance_cost_lines (name, amount) values ('Herramientas', 10)"),
    );
    await as(db, U.ownerA, () =>
      db.query("insert into email_templates (name, subject) values ('Plantilla A', 'Hola')"),
    );
    // the other company sees none of it
    expect(await as(db, U.ownerB, () => rows("select id from finance_cost_lines"))).toHaveLength(0);
    expect(await as(db, U.ownerB, () => rows("select id from email_templates"))).toHaveLength(0);
    // a plain member reads the company's templates but not its finance lines (control: the owner reads both)
    expect(await as(db, U.aeA, () => rows("select id from email_templates"))).toHaveLength(1);
    expect(await as(db, U.aeA, () => rows("select id from finance_cost_lines"))).toHaveLength(0);
    expect(await as(db, U.ownerA, () => rows("select id from finance_cost_lines"))).toHaveLength(1);
    // and a plain member cannot write finance data
    const err = await as(db, U.aeA, () =>
      throws(() => db.query("insert into finance_cost_lines (name, amount) values ('X', 1)")),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("gives anon nothing through the policies (control: the same owner reads it)", async () => {
    await db.exec("set role anon");
    try {
      expect(await rows("select id from email_templates")).toHaveLength(0);
    } finally {
      await db.exec("reset role");
    }
    expect(await as(db, U.ownerA, () => rows("select id from email_templates"))).toHaveLength(1);
  });

  it("is_finance_member is true for owner and sales leader of the company and false for a member without that role", async () => {
    const q = (uid: string, org: string) =>
      as(db, uid, async () => (await rows("select public.is_finance_member($1) ok", [org]))[0]!.ok);
    expect(await q(U.ownerA, A)).toBe(true);
    expect(await q(U.aeA, A)).toBe(false);
    expect(await q(U.ownerA, B)).toBe(false); // not a member of B
  });
});
