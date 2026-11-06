// @vitest-environment node
// NK-0064 (SDD tool-plan-real-connections, CA-7): only the Owner of the active company may insert or update the team's tool plan
// (public.integrations). Two fictional companies on an in-process Postgres (see src/test/pg-harness.ts for what it models).
// The harness does not build `integrations`, so this file creates it and applies the same four company policies 0002 gives it
// (0002_multitenant_organizations.sql:119-123), then runs a control block BEFORE the migration (so the old behaviour is asserted,
// not assumed) and the same cases AFTER it. The migration is found by name pattern, never by number.
import { readdirSync, readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { as, build, REPO, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string;
let B: string;
let rowA: string;
let rowB: string;
type Row = { id: string; status: string; n: number };
const rows = async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows as Row[];
const throws = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return "";
  } catch (e) {
    return String((e as Error).message);
  }
};
const setStatus = (id: string) =>
  rows("update integrations set status = 'connected' where id = $1 returning id", [id]);
const insertFor = (org: string, name: string) =>
  rows("insert into integrations (org_id, category, name) values ($1, 'CRM', $2) returning id", [
    org,
    name,
  ]);
// Case (d) inserts without RETURNING: RETURNING also needs the SELECT policy, which hides a row of a company that is not the
// active one, so it would fail for that reason in both blocks and prove nothing about the insert policy.
const insertQuiet = async (org: string, name: string) => {
  await db.query("insert into integrations (org_id, category, name) values ($1, 'CRM', $2)", [
    org,
    name,
  ]);
};
const count = async (name: string) =>
  Number(
    (
      await as(db, null, () =>
        rows("select count(*)::int as n from integrations where name = $1", [name]),
      )
    )[0]!.n,
  );
const RLS = /row-level security/i;

// The two write policies exactly as 0002 gives them (0002_multitenant_organizations.sql:121-122). Applying them puts the table
// in its «before» state, so each control case sets it up itself and does not depend on running before the migration.
const POLICIES_0002 = `
  drop policy if exists "org insert" on public.integrations;
  drop policy if exists "org update" on public.integrations;
  create policy "org insert" on public.integrations for insert to authenticated with check (public.is_org_member(org_id));
  create policy "org update" on public.integrations for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id));
`;

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(`
    create table public.integrations (
      id uuid primary key default gen_random_uuid(), category text not null, name text not null, purpose text default '',
      status text not null default 'planned', created_by uuid, updated_by uuid,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), org_id uuid default public.current_org());
    create unique index integrations_org_name_uniq on public.integrations (org_id, name);
    alter table public.integrations enable row level security;
    grant select, insert, update, delete on public.integrations to authenticated;
    grant all on public.integrations to service_role;
    create trigger integrations_audit before insert or update on public.integrations for each row execute function public.set_audit();
    create policy "org read" on public.integrations for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));
    create policy "org delete owner" on public.integrations for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  `);
  await db.exec(POLICIES_0002);
  // ownerA is Owner of company A (active) and also of company B, where they are not the active one: case (d).
  await db.exec(
    `insert into org_members (org_id, user_id, role) values ('${B}', '${U.ownerA}', 'owner')`,
  );
  rowA = (await as(db, null, () => insertFor(A, "HubSpot")))[0]!.id;
  rowB = (await as(db, null, () => insertFor(B, "HubSpot")))[0]!.id;
}, 60_000);

describe("control, before the migration: any member of the company can write (the behaviour this ticket removes)", () => {
  beforeEach(async () => {
    await db.exec(POLICIES_0002);
  });
  it("aeA, a member who is not the Owner, updates and inserts", async () => {
    expect(await as(db, U.aeA, () => setStatus(rowA))).toHaveLength(1);
    const made = await as(db, U.aeA, () => insertFor(A, "Control A"));
    expect(made).toHaveLength(1);
    await as(db, null, () => db.query("delete from integrations where name = 'Control A'"));
  });
  it("ownerA, active in company A, inserts into company B where they are not the active company", async () => {
    await as(db, U.ownerA, () => insertQuiet(B, "Control B"));
    expect(await count("Control B")).toBe(1);
    await as(db, null, () => db.query("delete from integrations where name = 'Control B'"));
  });
});

const MIGRATION = () => {
  const files = readdirSync(`${REPO}/drizzle/migrations`).filter((f) =>
    f.endsWith("_integrations_owner_write.sql"),
  );
  expect(files, "exactly one *_integrations_owner_write.sql in drizzle/migrations").toHaveLength(1);
  return readFileSync(`${REPO}/drizzle/migrations/${files[0]}`, "utf8");
};
// The rollback is written in the migration's header as «--   <sql>» lines.
const rollbackSql = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => l.startsWith("--   "))
    .map((l) => l.slice(5))
    .join("\n");

describe("the migration that limits the plan to the Owner", () => {
  // Every case starts from the same state (migration applied, rows reset), so none depends on another or on the order they run in.
  beforeEach(async () => {
    await db.exec(MIGRATION());
    await as(db, null, () =>
      db.query("delete from integrations where id not in ($1, $2)", [rowA, rowB]),
    );
    await as(db, null, () => db.query("update integrations set status = 'planned'"));
  });

  it("(a) the Owner of the active company updates a row of their company", async () => {
    expect(await as(db, U.ownerA, () => setStatus(rowA))).toHaveLength(1);
  });
  it("(b) a member who is not the Owner updates nothing and cannot insert", async () => {
    expect(await as(db, U.aeA, () => setStatus(rowA))).toHaveLength(0);
    expect(
      await as(db, null, () => rows("select status from integrations where id = $1", [rowA])),
    ).toEqual([{ status: "planned" }]);
    expect(await as(db, U.aeA, () => throws(() => insertFor(A, "Nuevo")))).toMatch(RLS);
  });
  it("(c) the Owner of another company cannot touch this company's rows", async () => {
    expect(await as(db, U.ownerB, () => setStatus(rowA))).toHaveLength(0);
  });
  it("(d) an Owner cannot insert into a company that is not their active one", async () => {
    expect(await as(db, U.ownerA, () => throws(() => insertQuiet(B, "Otra empresa")))).toMatch(RLS);
    expect(await count("Otra empresa")).toBe(0);
  });
  it("(e) an Owner cannot update a row of a company that is not their active one", async () => {
    expect(await as(db, U.ownerA, () => setStatus(rowB))).toHaveLength(0);
  });
  it("(f) an Owner cannot move a row of their company to another company", async () => {
    const moved = await as(db, U.ownerA, () =>
      throws(() => db.query("update integrations set org_id = $1 where id = $2", [B, rowA])),
    );
    expect(moved).toMatch(RLS);
    expect(
      await as(db, null, () => rows("select id from integrations where org_id = $1", [A])),
    ).toEqual([{ id: rowA }]);
  });
  it("deleting is unchanged: the Owner deletes, a member who is not the Owner does not", async () => {
    const [extra] = await as(db, null, () => insertFor(A, "Para borrar"));
    const del = (id: string) => rows("delete from integrations where id = $1 returning id", [id]);
    expect(await as(db, U.aeA, () => del(extra!.id))).toHaveLength(0);
    expect(await as(db, U.ownerA, () => del(extra!.id))).toHaveLength(1);
  });
  it("members still read the plan of their active company, and only that one", async () => {
    expect(
      (await as(db, U.aeA, () => rows("select id from integrations"))).map((r: Row) => r.id),
    ).toEqual([rowA]);
    expect(
      (await as(db, U.ownerB, () => rows("select id from integrations"))).map((r: Row) => r.id),
    ).toEqual([rowB]);
  });
});

describe("the rollback written in the migration's header", () => {
  it("restores the 0002 behaviour (a member who is not the Owner writes again) and the migration can be applied again", async () => {
    const sql = MIGRATION();
    const undo = rollbackSql(sql);
    expect(undo).toContain('create policy "org insert"');
    expect(undo).toContain('create policy "org update"');
    await db.exec(sql);
    expect(await as(db, U.aeA, () => throws(() => insertFor(A, "Con migración")))).toMatch(RLS);
    await db.exec(undo);
    expect(await as(db, U.aeA, () => setStatus(rowA))).toHaveLength(1);
    expect(await as(db, U.aeA, () => insertFor(A, "Tras rollback"))).toHaveLength(1);
    await as(db, null, () => db.query("delete from integrations where name = 'Tras rollback'"));
    await db.exec(sql);
    expect(await as(db, U.aeA, () => throws(() => insertFor(A, "Otra vez")))).toMatch(RLS);
  });
});
