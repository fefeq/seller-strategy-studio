// @vitest-environment node
import { beforeAll, afterAll, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { build, seed, as, U } from "@/test/pg-harness";
let db: Awaited<ReturnType<typeof build>>;
let org: string;
const leader = "00000000-0000-4000-8000-0000000000a3";
beforeAll(async () => {
  db = await build();
  org = (await seed(db)).A;
  await db.query("insert into profiles(id,current_org_id) values($1,$2)", [leader, org]);
  await db.query("insert into org_members(org_id,user_id,role) values($1,$2,'sales_leader')", [
    org,
    leader,
  ]);
  await db.exec(`create table lead_settings(org_id uuid primary key default current_org(),auto_enrich boolean default true,updated_by uuid,updated_at timestamptz default now());
    grant select,insert,update on lead_settings to authenticated;
    alter table lead_settings enable row level security;
    create policy member on lead_settings to authenticated using(is_org_member(org_id)) with check(is_org_member(org_id));
    create table agent_pending_actions(id uuid primary key default gen_random_uuid(),org_id uuid,user_id uuid,source text,args jsonb default '{}');`);
  const file = readdirSync("drizzle/migrations").find((f) =>
    f.endsWith("autopilot_action_threshold.sql"),
  );
  expect(file).toBeDefined();
  await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("defaults to zero and members can read", async () => {
  await as(db, U.ownerA, () => db.query("insert into lead_settings(org_id) values($1)", [org]));
  const r = await as(db, U.aeA, () =>
    db.query<{ autopilot_action_threshold: number }>(
      "select autopilot_action_threshold from lead_settings",
    ),
  );
  expect(Number(r.rows[0]?.autopilot_action_threshold)).toBe(0);
});
it("Owner and Sales Leader may set it; other members cannot bypass the tool", async () => {
  await as(db, U.ownerA, () =>
    db.query("update lead_settings set autopilot_action_threshold=0.03 where org_id=$1", [org]),
  );
  await as(db, leader, () =>
    db.query("update lead_settings set autopilot_action_threshold=0.04 where org_id=$1", [org]),
  );
  await expect(
    as(db, U.aeA, () =>
      db.query("update lead_settings set autopilot_action_threshold=1 where org_id=$1", [org]),
    ),
  ).rejects.toThrow();
});
it("one durable action per company and operation key, even after dismissal", async () => {
  await db.query(
    "insert into agent_pending_actions(org_id,user_id,source,args) values($1,$2,'autopilot',$3)",
    [org, U.ownerA, JSON.stringify({ autopilot_key: "meeting:synthetic" })],
  );
  await expect(
    db.query(
      "insert into agent_pending_actions(org_id,user_id,source,args) values($1,$2,'autopilot',$3)",
      [org, U.ownerA, JSON.stringify({ autopilot_key: "meeting:synthetic" })],
    ),
  ).rejects.toThrow();
});
