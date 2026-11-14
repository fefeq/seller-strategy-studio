// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import { as, build, seed, U } from "@/test/pg-harness";

let db: Awaited<ReturnType<typeof build>>;
let A: string;
let B: string;
const leader = "00000000-0000-4000-8000-0000000000a3";
beforeEach(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.query("insert into org_members(org_id,user_id,role) values($1,$2,'sales_leader')", [A, leader]);
  await db.query("insert into profiles(id,current_org_id) values($1,$2)", [leader, A]);
  const migration = readdirSync("drizzle/migrations").find(f => f.endsWith("business_lines_integrity.sql"));
  const path = process.env.BUSINESS_LINES_TEST_SQL ?? (migration ? `drizzle/migrations/${migration}` : null);
  if (!path) throw new Error("Missing business_lines_integrity migration");
  await db.exec(readFileSync(path, "utf8"));
}, 60000);
afterEach(async () => { await db?.close(); });

async function add(user = U.ownerA) {
  const result = await as(db, user, () => db.query<{ id: string }>(
    "insert into business_lines(model,acv,friction,stage) values('b2b',10000,'committee','early') returning id"));
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Missing synthetic line");
  return id;
}

it("CA-2 rejects a fifth line and a multirow insert exceeding four", async () => {
  await add();
  await expect(as(db, U.ownerA, () => db.exec(`insert into business_lines(model,acv,friction,stage)
    select 'b2b',10000,'committee','early' from generate_series(1,4)`))).rejects.toMatchObject({ code: "23514" });
  expect((await db.query("select id from business_lines")).rows).toHaveLength(1);
  await add(); await add(); await add();
  await expect(add()).rejects.toMatchObject({ code: "23514" });
});
it("CA-2 organization is immutable even for a leader in both organizations", async () => {
  const id = await add();
  await db.query("insert into org_members(org_id,user_id,role) values($1,$2,'owner')", [B,U.ownerA]);
  await expect(as(db,U.ownerA,() => db.query("update business_lines set org_id=$1 where id=$2",[B,id]))).rejects.toBeDefined();
  expect((await db.query("select org_id from business_lines where id=$1",[id])).rows).toEqual([{ org_id:A }]);
});
it("CA-3 first line is primary and principal RPC changes it atomically", async () => {
  const first = await add(leader); const second = await add(leader);
  expect((await db.query("select id from business_lines where is_primary")).rows).toEqual([{ id:first }]);
  await as(db,leader,() => db.query("select set_primary_business_line($1)",[second]));
  expect((await db.query("select id from business_lines where is_primary")).rows).toEqual([{ id:second }]);
  await expect(as(db,leader,() => db.query("update business_lines set is_primary=false where id=$1",[second]))).rejects.toMatchObject({ code:"23514" });
});
it("CA-4 members read only their company and cannot add or change principal", async () => {
  await add();
  expect((await as(db,U.aeA,() => db.query("select id from business_lines"))).rows).toHaveLength(1);
  expect((await as(db,U.ownerB,() => db.query("select id from business_lines"))).rows).toHaveLength(0);
  await expect(add(U.aeA)).rejects.toMatchObject({ code:"42501" });
  await expect(as(db,U.aeA,() => db.query("select set_primary_business_line(gen_random_uuid())"))).rejects.toMatchObject({ code:"42501" });
});
it("CA-4 only Owner removes, promotes next primary, rejects last and unknown line", async () => {
  const first=await add(); const second=await add();
  await expect(as(db,leader,() => db.query("select remove_business_line($1)",[first]))).rejects.toMatchObject({ code:"42501" });
  await as(db,U.ownerA,() => db.query("select remove_business_line($1)",[first]));
  expect((await db.query("select id,is_primary from business_lines")).rows).toEqual([{ id:second,is_primary:true }]);
  await expect(as(db,U.ownerA,() => db.query("select remove_business_line($1)",[second]))).rejects.toMatchObject({ code:"23514" });
  await expect(as(db,U.ownerA,() => db.query("select remove_business_line(gen_random_uuid())"))).rejects.toMatchObject({ code:"P0002" });
});
it("CA-5 segment linkage rejects cross-company and null org, deletes only link", async () => {
  const first=await add(); await add();
  await expect(db.query("insert into segments(name,org_id,business_line_id) values('Synthetic',$1,$2)",[B,first])).rejects.toMatchObject({ code:"23503" });
  await expect(db.query("insert into segments(name,org_id,business_line_id) values('Synthetic',null,$1)",[first])).rejects.toMatchObject({ code:"23514" });
  await db.query("insert into segments(name,org_id,business_line_id) values('Synthetic',$1,$2)",[A,first]);
  await as(db,U.ownerA,() => db.query("select remove_business_line($1)",[first]));
  expect((await db.query("select name,org_id,business_line_id from segments")).rows).toEqual([{ name:"Synthetic",org_id:A,business_line_id:null }]);
});
it("CA-1 database rejects zero ticket and invalid domain for all models", async () => {
  for(const model of ['b2b','b2c','marketplace']) {
    await expect(as(db,U.ownerA,() => db.query("insert into business_lines(model,acv,friction,stage) values($1,0,'committee','early')",[model]))).rejects.toMatchObject({ code:"23514" });
  }
  await expect(as(db,U.ownerA,() => db.query("insert into business_lines(model,acv,friction,stage) values('unknown',100,'committee','early')"))).rejects.toMatchObject({ code:"23514" });
});
it("CA-3 cascade deleting organization remains possible with a primary", async () => {
  await add(); await add();
  await db.query("delete from organizations where id=$1",[A]);
  expect((await db.query("select id from business_lines")).rows).toHaveLength(0);
});
it("CA-7 ordinary inserts and edits cannot forge migrated origin", async () => {
  await expect(as(db,U.ownerA,() => db.query("insert into business_lines(model,acv,friction,stage,origin) values('b2b',100,'committee','early','migrated')"))).rejects.toMatchObject({ code:"42501" });
  const id=await add();
  await db.query("update business_lines set origin='migrated' where id=$1",[id]);
  await as(db,leader,() => db.query("update business_lines set name='Synthetic edit' where id=$1",[id]));
  expect((await db.query("select origin from business_lines where id=$1",[id])).rows).toEqual([{ origin:"user" }]);
});