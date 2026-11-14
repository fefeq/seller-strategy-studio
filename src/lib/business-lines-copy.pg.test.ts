// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { as, build, seed, U } from '@/test/pg-harness';

let db: Awaited<ReturnType<typeof build>>;
let A: string;
let B: string;
const input = { model: 'b2b', acv: 12000, friction: 'committee', stage: 'early' };
beforeEach(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(`create table onboarding_sessions(id uuid primary key default gen_random_uuid(), org_id uuid, user_id uuid, diagnosis jsonb, updated_at timestamptz);
    create table platform_admins(user_id uuid primary key);
    grant select on organizations,org_members,onboarding_sessions,platform_admins to service_role;`);
  for (const suffix of ['business_lines_integrity.sql', 'business_lines_copy.sql']) {
    const file = readdirSync('drizzle/migrations').find(f => f.endsWith(suffix));
    const path = suffix === 'business_lines_copy.sql' && process.env.BUSINESS_LINES_COPY_TEST_SQL
      ? process.env.BUSINESS_LINES_COPY_TEST_SQL : file ? `drizzle/migrations/${file}` : null;
    if (!path) throw new Error(`Missing ${suffix}`);
    await db.exec(readFileSync(path, 'utf8'));
  }
}, 60000);
afterEach(async () => { await db?.close(); });
async function session(user = U.ownerA, org = A, raw: unknown = input, at = '2026-11-14T00:00:00Z', archetype: unknown = 'B') {
  await db.query(`insert into onboarding_sessions(org_id,user_id,diagnosis,updated_at) values($1,$2,$3,$4)`,
    [org, user, JSON.stringify({ input: raw, result: { archetype } }), at]);
}
async function copy() {
  return as(db, null, () => db.query<{ result: { created: number; refreshed: number } }>('select copy_business_lines() as result'));
}
it('CA-6 valid Owner wins over a more recent member, with latest Owner and stable id tie break', async () => {
  await session();
  await session(U.aeA, A, { ...input, acv: 30000 }, '2026-11-15');
  await db.query("insert into org_members(org_id,user_id,role) values($1,$2,'owner')", [A,U.ownerB]);
  await session(U.ownerB, A, { ...input, acv: 20000 }, '2026-11-14T01:00:00Z');
  await db.query(`insert into onboarding_sessions(id,org_id,user_id,diagnosis,updated_at) values('00000000-0000-4000-8000-000000000001',$1,$2,$3,'2026-11-14T01:00:00Z')`,
    [A,U.ownerB,JSON.stringify({input: {...input,acv:21000},result:{archetype:'B'}})]);
  await copy();
  expect((await db.query('select acv from business_lines')).rows).toEqual([{acv:'21000'}]);
});
it('CA-6 invalid Owner falls back to latest valid member, rejects zero in every model and malformed input', async () => {
  for (const model of ['b2b','b2c','marketplace']) await session(U.ownerA,A,{...input,model,acv:0});
  for (const raw of [null,{}, {...input,acv:'12000'}, {...input,friction:'other'}, {...input,stage:'other'}, {...input,model:'other'}]) await session(U.ownerA,A,raw);
  await session(U.ownerA,A,input,'2026-11-16',null);
  await session(U.aeA,A,{...input,acv:9000});
  await session(U.aeA,A,{...input,acv:10000},'2026-11-15');
  await session(U.ownerB,B,{...input,acv:0});
  await copy();
  expect((await db.query('select org_id,acv from business_lines')).rows).toEqual([{org_id:A,acv:'10000'}]);
});
it('CA-6 foreign platform admin is excluded at every level but creator is eligible', async () => {
  await db.query('insert into platform_admins values($1)',[U.ownerA]);
  await db.query("insert into org_members(org_id,user_id,role) values($1,$2,'owner')",[B,U.ownerA]);
  await session(); await session(U.ownerA,B);
  await db.query('update organizations set created_by=$1 where id=$2',[U.ownerA,B]);
  await copy();
  expect((await db.query('select org_id from business_lines')).rows).toEqual([{org_id:B}]);
});
it('CA-7 copy creates unnamed primary, leaves sessions and segments intact and second run is a no-op', async () => {
  await session();
  const before = (await db.query('select * from onboarding_sessions')).rows;
  expect((await copy()).rows[0]?.result).toEqual({created:1,refreshed:0});
  expect((await copy()).rows[0]?.result).toEqual({created:0,refreshed:0});
  expect((await db.query('select name,is_primary,origin,position from business_lines')).rows).toEqual([{name:null,is_primary:true,origin:'migrated',position:0}]);
  expect((await db.query('select * from onboarding_sessions')).rows).toEqual(before);
  expect((await db.query('select business_line_id from segments')).rows).toEqual([]);
});
it('CA-7 refreshes untouched copied answers but never user edits, including principal and privileged edits', async () => {
  await session(); await copy();
  await session(U.ownerA,A,{...input,acv:22000},'2026-11-15');
  expect((await copy()).rows[0]?.result).toEqual({created:0,refreshed:1});
  expect((await db.query('select acv,origin from business_lines')).rows).toEqual([{acv:'22000',origin:'migrated'}]);
  const id=(await db.query<{id:string}>('select id from business_lines')).rows[0]?.id;
  if (!id) throw new Error('Missing line');
  await as(db,U.ownerA,()=>db.query('select set_primary_business_line($1)',[id]));
  await session(U.ownerA,A,{...input,acv:33000},'2026-11-16');
  await copy();
  expect((await db.query('select acv,origin from business_lines')).rows).toEqual([{acv:'22000',origin:'user'}]);
  await db.query("insert into business_lines(org_id,model,acv,friction,stage,origin) values($1,'b2b',5000,'committee','early','migrated')",[B]);
  await as(db,null,()=>db.query("update business_lines set name='Synthetic edit' where org_id=$1",[B]));
  expect((await db.query('select origin from business_lines where org_id=$1',[B])).rows).toEqual([{origin:'user'}]);
});
it('CA-7 existing user lines prevent creating or refreshing another line', async () => {
  await session();
  await as(db,U.ownerA,()=>db.exec("insert into business_lines(model,acv,friction,stage) values('b2c',50,'self_serve','idea')"));
  expect((await copy()).rows[0]?.result).toEqual({created:0,refreshed:0});
  expect((await db.query('select model,acv from business_lines')).rows).toEqual([{model:'b2c',acv:'50'}]);
});
it('CA-7 members and anon cannot execute the administrative copy or forge its refresh context', async () => {
  await session(); await copy();
  await expect(as(db,U.ownerA,()=>db.query('select copy_business_lines()'))).rejects.toMatchObject({code:'42501'});
  await db.exec('set role anon');
  await expect(db.query('select copy_business_lines()')).rejects.toMatchObject({code:'42501'});
  await db.exec('reset role');
  await as(db,U.ownerA,async()=> {
    await db.exec("select set_config('nokko.business_lines_copy','authorized',false)");
    await db.exec("update business_lines set acv=25000");
  });
  expect((await db.query('select origin from business_lines')).rows).toEqual([{origin:'user'}]);
});