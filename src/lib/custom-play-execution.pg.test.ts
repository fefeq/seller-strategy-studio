// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { as, build, seed, U } from "@/test/pg-harness";
let db: Awaited<ReturnType<typeof build>>;
let org: string;
let play: string;
const run = "00000000-0000-4000-8000-000000000099";
const token = "00000000-0000-4000-8000-000000000088";
beforeAll(async () => {
  db = await build();
  org = (await seed(db)).A;
  await db.exec(`alter table organizations add column archived_at timestamptz;
    create table suggestions(id uuid primary key default gen_random_uuid(),org_id uuid not null,detector text,dedupe_key text,title text,body text,link text,priority int,status text default 'pending',unique(org_id,dedupe_key));
    create table integration_usage(id uuid primary key default gen_random_uuid(),org_id uuid,user_id uuid,service text,need text,trigger text,cost numeric);
    alter default privileges in schema public revoke all on tables from anon,authenticated,service_role;`);
  for (const suffix of [
    "custom_plays_storage.sql",
    "custom_plays_execution.sql",
    "custom_play_checkpoints.sql",
  ]) {
    const f = readdirSync("drizzle/migrations").find((x) => x.endsWith(suffix));
    expect(f, suffix).toBeDefined();
    await db.exec(readFileSync(`drizzle/migrations/${f}`, "utf8"));
  }
  const r = await db.query<{ id: string }>(
    "insert into custom_plays(org_id,key,name,status) values($1,'custom:test','Prueba','activo') returning id",
    [org],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("Missing fixture");
  play = id;
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("CA-1/CA-2 lease is single flight, reserve is not replayable, commit and receipt are atomic", async () => {
  const args = [org, play, run, U.ownerA, token];
  const claim = () =>
    db.query<{ ok: boolean }>("select claim_custom_play($1,$2,$3,$4,$5) as ok", args);
  expect((await claim()).rows[0]?.ok).toBe(true);
  expect((await claim()).rows[0]?.ok).toBe(false);
  expect(
    (
      await db.query<{ ok: boolean }>("select reserve_custom_play_step($1,$2,$3,$4,1) as ok", [
        org,
        play,
        run,
        token,
      ])
    ).rows[0]?.ok,
  ).toBe(true);
  expect(
    (
      await db.query<{ ok: boolean }>("select reserve_custom_play_step($1,$2,$3,$4,1) as ok", [
        org,
        play,
        run,
        token,
      ])
    ).rows[0]?.ok,
  ).toBe(false);
  const payload = {
    signals: [],
    evidence: [
      {
        url: "https://example.com/news",
        quote: "Aviso público del 13 de noviembre de 2026",
        event_date: "2026-11-13",
        provider: "firecrawl",
      },
    ],
    suggestions: [
      {
        dedupe_key: "synthetic:1",
        title: "Señal de prueba",
        body: "Fuente pública",
        link: "/inbox",
      },
    ],
    costs: [
      {
        provider: "test",
        amount: 0.12,
        cost_kind: "ai_measured",
        currency: "USD",
        input_tokens: 10,
        output_tokens: 2,
      },
    ],
  };
  const commit = (p: unknown) =>
    db.query("select commit_custom_play_step($1,$2,$3,$4,1,$5::jsonb)", [
      org,
      play,
      run,
      token,
      JSON.stringify(p),
    ]);
  await expect(
    commit({ ...payload, evidence: [{ ...payload.evidence[0], quote: "bad@example.com" }] }),
  ).rejects.toBeDefined();
  expect((await db.query("select * from custom_play_evidence")).rows).toHaveLength(0);
  expect((await db.query("select status from custom_play_steps")).rows).toEqual([
    { status: "reserved" },
  ]);
  await commit(payload);
  await commit(payload);
  expect((await db.query("select * from custom_play_evidence")).rows).toHaveLength(1);
  expect((await db.query("select * from suggestions")).rows).toHaveLength(1);
  expect(
    (await db.query("select amount,currency,input_tokens from custom_play_costs")).rows,
  ).toEqual([{ amount: "0.12", currency: "USD", input_tokens: 10 }]);
  expect(
    (await db.query("select evidence_count,suggestion_count,status from custom_play_steps")).rows,
  ).toEqual([{ evidence_count: 1, suggestion_count: 1, status: "committed" }]);
});
it("CA-1 privileged RPC checks organization and member; members cannot execute it", async () => {
  await expect(
    as(db, U.ownerA, () =>
      db.query("select claim_custom_play($1,$2,$3,$4,$5)", [org, play, run, U.ownerA, token]),
    ),
  ).rejects.toMatchObject({ code: "42501" });
  expect(
    (
      await db.query<{ ok: boolean }>("select claim_custom_play($1,$2,$3,$4,$5) as ok", [
        org,
        play,
        run,
        U.ownerB,
        token,
      ])
    ).rows[0]?.ok,
  ).toBe(false);
});
it("CA-2 uncertain reserve survives a restart, paused plays do not claim", async () => {
  await db.query("select reserve_custom_play_step($1,$2,$3,$4,2)", [org, play, run, token]);
  await db.query("update custom_plays set lease_until=now()-interval '1 minute' where id=$1", [
    play,
  ]);
  const t2 = "00000000-0000-4000-8000-000000000077";
  expect(
    (
      await db.query<{ ok: boolean }>("select claim_custom_play($1,$2,$3,$4,$5) as ok", [
        org,
        play,
        run,
        U.ownerA,
        t2,
      ])
    ).rows[0]?.ok,
  ).toBe(true);
  expect(
    (
      await db.query<{ ok: boolean }>("select reserve_custom_play_step($1,$2,$3,$4,2) as ok", [
        org,
        play,
        run,
        t2,
      ])
    ).rows[0]?.ok,
  ).toBe(false);
  await db.query("update custom_plays set status='pausado',lease_until=null where id=$1", [play]);
  expect(
    (
      await db.query<{ ok: boolean }>("select claim_custom_play($1,$2,$3,$4,$5) as ok", [
        org,
        play,
        run,
        U.ownerA,
        t2,
      ])
    ).rows[0]?.ok,
  ).toBe(false);
});
