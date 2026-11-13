// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { build, seed, as, migrate, U } from "@/test/pg-harness";

let db: Awaited<ReturnType<typeof build>>;
let A: string; let B: string;
const leader = "00000000-0000-4000-8000-0000000000a3";
const desk = "00000000-0000-4000-8000-0000000000a4";
beforeAll(async () => {
  db = await build(); ({ A, B } = await seed(db));
  await db.exec(`
    create schema storage; grant usage on schema storage to authenticated;
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
    grant select, insert, delete on storage.objects to authenticated; alter table storage.objects enable row level security;
    create table onboarding_sessions (id uuid primary key default gen_random_uuid());
    create table suggestions (id uuid primary key default gen_random_uuid(), org_id uuid default current_org(), detector text, dedupe_key text, body text);
    create table play_states (org_id uuid default current_org(), play_id text, enabled boolean not null default false, primary key(org_id,play_id));
    grant select, insert, update on suggestions, play_states to authenticated;
    alter table suggestions enable row level security; alter table play_states enable row level security;
    create policy member_read on suggestions for select to authenticated using (org_id = current_org() and is_org_member(org_id));
    create policy member_update on suggestions for update to authenticated using (org_id = current_org() and is_org_member(org_id)) with check (org_id = current_org());
    create policy member_read on play_states for select to authenticated using (org_id = current_org() and is_org_member(org_id));
    create policy leader_insert on play_states for insert to authenticated with check (org_id = current_org() and (has_org_role(org_id,'owner') or has_org_role(org_id,'sales_leader')));
    create policy leader_update on play_states for update to authenticated using (org_id = current_org() and (has_org_role(org_id,'owner') or has_org_role(org_id,'sales_leader'))) with check (org_id = current_org());
    insert into org_members(org_id,user_id,role) values ('${A}','${leader}','sales_leader'),('${A}','${desk}','deal_desk');
    insert into profiles(id,current_org_id) values ('${leader}','${A}'),('${desk}','${A}');
  `);
  await migrate(db, ["0086_onboarding_sources_storage.sql", "0087_price_suggestions_and_blocked_plays_guard.sql"]);
}, 30_000);
afterAll(async () => { await db?.close(); });

describe("F3: real migration policies in a simulated storage schema", () => {
  it("upload/read/delete is scoped to the company and the uploader folder", async () => {
    const own = `${A}/${U.ownerA}/synthetic.txt`;
    await as(db, U.ownerA, async () => {
      await db.query("insert into storage.objects(bucket_id,name) values ('onboarding-sources',$1)", [own]);
      await expect(db.query("insert into storage.objects(bucket_id,name) values ('onboarding-sources',$1)", [`${A}/${U.aeA}/not-own.txt`])).rejects.toThrow();
      await expect(db.query("insert into storage.objects(bucket_id,name) values ('other-bucket',$1)", [own])).rejects.toThrow();
    });
    await as(db, U.ownerB, async () => {
      expect((await db.query("select name from storage.objects")).rows).toEqual([]);
      expect((await db.query("delete from storage.objects where name=$1 returning name", [own])).rows).toEqual([]);
      await expect(db.query("insert into storage.objects(bucket_id,name) values ('onboarding-sources',$1)", [own])).rejects.toThrow();
    });
    await as(db, U.aeA, async () => {
      expect((await db.query("select name from storage.objects")).rows).toEqual([{ name: own }]);
      expect((await db.query("delete from storage.objects where name=$1 returning name", [own])).rows).toEqual([]);
    });
    await as(db, U.ownerA, async () => { expect((await db.query("delete from storage.objects where name=$1 returning name", [own])).rows).toEqual([{ name: own }]); });
  });
  it.each([U.ownerA, leader, desk])("price suggestion is readable/editable by eligible role %s", async (uid) => {
    const id = (await db.query<{ id: string }>("insert into suggestions(org_id,detector,dedupe_key,body) values ($1,'strategy_product_price','strategy_product_price:price:synthetic','before') returning id", [A])).rows[0]?.id;
    await as(db, uid, async () => {
      expect((await db.query("select id from suggestions where id=$1", [id])).rows).toHaveLength(1);
      expect((await db.query("update suggestions set body='after' where id=$1 returning body", [id])).rows).toEqual([{ body: "after" }]);
    });
  });
  it("AE and another company cannot read or edit the price suggestion", async () => {
    const id = (await db.query<{ id: string }>("insert into suggestions(org_id,detector,dedupe_key) values ($1,'strategy_product_price','strategy_product_price:price:hidden') returning id", [A])).rows[0]?.id;
    for (const uid of [U.aeA, U.ownerB]) await as(db, uid, async () => {
      expect((await db.query("select id from suggestions where id=$1", [id])).rows).toEqual([]);
      expect((await db.query("update suggestions set body='forbidden' where id=$1 returning id", [id])).rows).toEqual([]);
    });
  });
  it("blocked play activation fails on INSERT and UPDATE; normal activation works", async () => {
    await as(db, U.ownerA, async () => {
      await expect(db.query("insert into play_states(play_id,enabled) values ('automated-reply-enrichment',true)")).rejects.toThrow();
      await db.query("insert into play_states(play_id,enabled) values ('automated-reply-enrichment',false)");
      await expect(db.query("update play_states set enabled=true where play_id='automated-reply-enrichment'")).rejects.toThrow();
      await db.query("insert into play_states(play_id,enabled) values ('crm-hygiene',true)");
      expect((await db.query("update play_states set enabled=false where play_id='crm-hygiene' returning enabled")).rows).toEqual([{ enabled: false }]);
      expect((await db.query("update play_states set enabled=true where play_id='crm-hygiene' returning enabled")).rows).toEqual([{ enabled: true }]);
    });
  });
});