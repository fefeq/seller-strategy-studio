// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in migrations.pg.test.ts */
// SDD-20261027 F3: runs migration 0070 (pending strategy changes and links) on an in-process Postgres (PGlite) with two fictional
// companies. Never touches a real database. «suggestions» below copies the columns and policies of migrations 0007/0013, reduced.
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db; let A: string, B: string; let sA: string, sB: string;
const LEADER = "00000000-0000-4000-8000-0000000000a3", DESK = "00000000-0000-4000-8000-0000000000a4";
const rows = async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows as Record<string, any>[];
const throws = async (fn: () => Promise<unknown>) => { try { await fn(); return ""; } catch (e) { return String((e as Error).message); } };
const proposal = (suggestion: string, over = "") => db.query(`insert into strategy_changes (suggestion_id, element, op, target_table, target_id, values, base ${over ? "," + over.split("=")[0] : ""}) values ($1,'icp','update','icp_profiles','00000000-0000-4000-8000-0000000000c1','{"industries":"Logística"}','{"industries":"Salud"}' ${over ? "," + over.split("=")[1] : ""}) returning id`, [suggestion]);

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(`
    insert into org_members (org_id, user_id, role) values ('${A}','${LEADER}','sales_leader'),('${A}','${DESK}','deal_desk');
    insert into profiles (id, current_org_id) values ('${LEADER}','${A}'),('${DESK}','${A}');
    create table public.suggestions (
      id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, user_id uuid,
      detector text not null, dedupe_key text not null, title text not null, status text not null default 'pending', unique (org_id, dedupe_key));
    grant select, insert, update on public.suggestions to authenticated; grant all on public.suggestions to service_role;
    alter table public.suggestions enable row level security;
    create policy "org read" on public.suggestions for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));
    create policy "org insert" on public.suggestions for insert to authenticated with check (public.is_org_member(org_id));
  `);
  sA = (await rows(`insert into suggestions (org_id, detector, dedupe_key, title) values ('${A}','strategy_icp','strategy_icp:x','t') returning id`))[0]!.id;
  sB = (await rows(`insert into suggestions (org_id, detector, dedupe_key, title) values ('${B}','strategy_icp','strategy_icp:y','t') returning id`))[0]!.id;
  await migrate(db, ["0070_strategy_execution.sql"]);
}, 60_000);

describe("migration 0070 is additive", () => {
  it("running it again changes nothing", async () => {
    await migrate(db, ["0070_strategy_execution.sql"]);
    expect((await rows("select count(*)::int n from strategy_changes"))[0]!.n).toBe(0);
  });
});

describe("CA-32 / CA-37: a member saves a pending proposal linked to a suggestion of their company", () => {
  let c1: string;
  it("insert defaults to pending and the company of the user; one proposal per suggestion", async () => {
    await as(db, U.aeA, async () => {
      c1 = ((await proposal(sA)).rows[0] as { id: string }).id;
      await db.query("insert into strategy_links (suggestion_id, kind, ref_id) values ($1,'change',$2)", [sA, c1]);
      expect(await throws(() => proposal(sA))).toMatch(/duplicate|unique/);
    });
    expect((await rows("select status, org_id from strategy_changes where id = $1", [c1]))[0]).toEqual({ status: "pending", org_id: A });
  });
  it("cannot point at a suggestion of another company", async () => {
    await as(db, U.aeA, async () => { expect(await throws(() => proposal(sB))).toMatch(/row-level security/); });
  });
  it("the shape and lists are enforced by the database", async () => {
    await as(db, U.aeA, async () => {
      expect(await throws(() => db.query("insert into strategy_changes (suggestion_id, element, op, target_table) values ($1,'icp','update','icp_profiles')", [sA]))).toMatch(/shape|unique/);
      expect(await throws(() => db.query("insert into strategy_changes (suggestion_id, element, op) values ($1,'precio','manual')", [sA]))).toMatch(/element|unique/);
      expect(await throws(() => db.query("insert into strategy_links (suggestion_id, kind, ref_id) values ($1,'email',gen_random_uuid())", [sA]))).toMatch(/kind/);
    });
  });
});

describe("CA-38 / CA-33: only the roles that can change strategy move a proposal on; no one deletes", () => {
  let c: string;
  beforeAll(async () => { c = (await rows(`insert into strategy_changes (org_id, suggestion_id, element, op, target_table, target_id, values) values ('${A}', '${(await rows(`insert into suggestions (org_id, detector, dedupe_key, title) values ('${A}','strategy_icp','strategy_icp:z','t') returning id`))[0]!.id}','icp','update','icp_profiles','00000000-0000-4000-8000-0000000000c1','{}') returning id`))[0]!.id; });
  it("an AE can read it but cannot apply or reject it", async () => {
    await as(db, U.aeA, async () => {
      expect((await rows("select id from strategy_changes where id = $1", [c])).length).toBe(1);
      await db.query("update strategy_changes set status = 'applied' where id = $1", [c]);
    });
    expect((await rows("select status from strategy_changes where id = $1", [c]))[0]!.status).toBe("pending");
  });
  it("a sales leader can; deal desk only for products", async () => {
    await as(db, LEADER, async () => { await db.query("update strategy_changes set status = 'applied', undo_until = now() + interval '24 hours' where id = $1", [c]); });
    expect((await rows("select status from strategy_changes where id = $1", [c]))[0]!.status).toBe("applied");
    await as(db, DESK, async () => { await db.query("update strategy_changes set status = 'undone' where id = $1", [c]); });
    expect((await rows("select status from strategy_changes where id = $1", [c]))[0]!.status).toBe("applied");
  });
  it("the status list is enforced and nobody deletes through the app", async () => {
    await as(db, LEADER, async () => { expect(await throws(() => db.query("update strategy_changes set status = 'hecho' where id = $1", [c]))).toMatch(/status/); });
    await as(db, U.ownerA, async () => { expect(await throws(() => db.query("delete from strategy_changes where id = $1", [c]))).toMatch(/permission denied/); });
  });
});

describe("RLS: another company sees and changes nothing", () => {
  it("reads empty and updates nothing", async () => {
    await as(db, U.ownerB, async () => {
      expect((await rows("select id from strategy_changes")).length).toBe(0);
      expect((await rows("select id from strategy_links")).length).toBe(0);
      await db.query("update strategy_changes set status = 'rejected'");
    });
    expect((await rows("select count(*)::int n from strategy_changes where status = 'rejected'"))[0]!.n).toBe(0);
  });
});
