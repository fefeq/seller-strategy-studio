// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in the other .pg tests */
// SDD-20261106 plays-library-core U-4: runs migration 0077 on an in-process Postgres (PGlite) with two fictional companies. Never touches a real database.
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db; let A: string; let B: string;
const LEADER_A = "00000000-0000-4000-8000-0000000000a3";
const SUBJECT = "22222222-2222-4222-8222-222222222222";
const rows = async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows as Record<string, any>[];
const throws = async (fn: () => Promise<unknown>) => { try { await fn(); return ""; } catch (e) { return String((e as Error).message); } };

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(`insert into org_members (org_id, user_id, role) values ('${A}','${LEADER_A}','sales_leader'); insert into profiles (id, current_org_id) values ('${LEADER_A}','${A}');`);
  await migrate(db, ["0077_plays_library_core.sql"]);
}, 60_000);

describe("CA-8 (RLS): only owner and sales_leader write play_states; members read", () => {
  it("lets the owner and the sales leader activate and pause", async () => {
    await as(db, U.ownerA, () => db.query("insert into play_states (play_id, enabled) values ('crm-hygiene', false)"));
    await as(db, LEADER_A, () => db.query("update play_states set enabled = true where play_id = 'crm-hygiene'"));
    expect((await rows("select enabled from play_states where org_id = $1 and play_id = 'crm-hygiene'", [A]))[0]!.enabled).toBe(true);
  });

  it("refuses an insert from another role and leaves an update from another role without effect", async () => {
    const err = await as(db, U.aeA, () => throws(() => db.query("insert into play_states (play_id, enabled) values ('plg-to-sales', true)")));
    expect(err).toMatch(/row-level security/);
    await as(db, U.aeA, () => db.query("update play_states set enabled = false where play_id = 'crm-hygiene'"));
    expect((await rows("select enabled from play_states where org_id = $1 and play_id = 'crm-hygiene'", [A]))[0]!.enabled).toBe(true);
  });

  it("lets every member of the company read them", async () => {
    const seen = await as(db, U.aeA, () => rows("select play_id from play_states"));
    expect(seen.map((r) => r.play_id)).toEqual(["crm-hygiene"]);
  });

  it("has no delete for the app, not even for the owner", async () => {
    const err = await as(db, U.ownerA, () => throws(() => db.query("delete from play_states where play_id = 'crm-hygiene'")));
    expect(err).toMatch(/permission denied/);
  });

  it("stamps who and when from the session, whatever the client sends", async () => {
    await as(db, U.ownerA, () => db.query("update play_states set enabled = false, updated_by = $1, updated_at = '2001-01-01' where play_id = 'crm-hygiene'", [U.ownerB]));
    const r = (await rows("select updated_by, updated_at > '2020-01-01' as fresh from play_states where org_id = $1", [A]))[0]!;
    expect(r.updated_by).toBe(U.ownerA);
    expect(r.fresh).toBe(true);
  });

  it("defaults org_id to the current company and settings to an empty object", async () => {
    await as(db, U.ownerA, () => db.query("insert into play_states (play_id, enabled) values ('signal-activation', true)"));
    const r = (await rows("select org_id, settings from play_states where play_id = 'signal-activation'"))[0]!;
    expect(r).toEqual({ org_id: A, settings: {} });
  });

  it("does not check play_id against the catalogue (the catalogue lives in code)", async () => {
    await as(db, U.ownerA, () => db.query("insert into play_states (play_id, enabled) values ('a-future-play', false)"));
    expect((await rows("select count(*)::int n from play_states where play_id = 'a-future-play'"))[0]!.n).toBe(1);
  });
});

describe("CA-13: a company does not see or change the play_states of another", () => {
  it("hides them from the other company, including its owner", async () => {
    const seen = await as(db, U.ownerB, () => rows("select * from play_states"));
    expect(seen).toHaveLength(0);
  });

  it("refuses to insert for another company and leaves its update without effect", async () => {
    const err = await as(db, U.ownerB, () => throws(() => db.query("insert into play_states (org_id, play_id, enabled) values ($1, 'x-play', true)", [A])));
    expect(err).toMatch(/row-level security/);
    await as(db, U.ownerB, () => db.query("update play_states set enabled = true where org_id = $1", [A]));
    expect((await rows("select enabled from play_states where org_id = $1 and play_id = 'crm-hygiene'", [A]))[0]!.enabled).toBe(false);
  });

  it("keeps the same play id independent per company", async () => {
    await as(db, U.ownerB, () => db.query("insert into play_states (play_id, enabled) values ('crm-hygiene', true)"));
    expect((await rows("select org_id, enabled from play_states where play_id = 'crm-hygiene' order by enabled")).map((r) => r.org_id)).toEqual([A, B]);
  });

  it("gives nothing to anon", async () => {
    await db.exec("set role anon");
    const err = await throws(() => db.query("select * from play_states"));
    await db.exec("reset role");
    expect(err).toMatch(/permission denied/);
  });
});

describe("CA-17: play_runs is written only by the server", () => {
  const insert = `insert into play_runs (org_id, play_id, subject_table, subject_id, outcome, gate_key, drop_reason) values ($1, 'closed-lost-revival', 'deals', '${SUBJECT}', $2, $3, $4)`;

  it("accepts the privileged client (service role) and nothing from a signed-in user", async () => {
    await as(db, null, () => db.query(insert, [A, "pass", null, null]));
    await as(db, null, () => db.query(insert, [A, "drop", "ventana", "Dato desconocido: fecha de cierre"]));
    for (const uid of [U.ownerA, LEADER_A, U.aeA]) {
      const err = await as(db, uid, () => throws(() => db.query(insert, [A, "pass", null, null])));
      expect(err, uid).toMatch(/permission denied/);
    }
  });

  it("lets the members of the company read its runs and no one else", async () => {
    expect(await as(db, U.aeA, () => rows("select outcome from play_runs order by outcome"))).toEqual([{ outcome: "drop" }, { outcome: "pass" }]);
    expect(await as(db, U.ownerB, () => rows("select * from play_runs"))).toHaveLength(0);
  });

  it("does not let the app edit or delete a run", async () => {
    for (const sql of ["update play_runs set outcome = 'pass'", "delete from play_runs"]) {
      expect(await as(db, U.ownerA, () => throws(() => db.query(sql))), sql).toMatch(/permission denied/);
    }
  });

  it("requires a reason for a drop and only the two outcomes", async () => {
    expect(await as(db, null, () => throws(() => db.query(insert, [A, "drop", "ventana", null])))).toMatch(/play_runs_drop_reason/);
    expect(await as(db, null, () => throws(() => db.query(insert, [A, "drop", "ventana", "   "])))).toMatch(/play_runs_drop_reason/);
    expect(await as(db, null, () => throws(() => db.query(insert, [A, "skip", null, null])))).toMatch(/play_runs_outcome/);
  });

  it("has the index for the per-play history", async () => {
    const idx = await rows("select indexdef from pg_indexes where tablename = 'play_runs' and indexname = 'play_runs_org_play_idx'");
    expect(idx[0]!.indexdef).toMatch(/org_id, play_id, created_at DESC/);
  });
});

describe("the migration is safe to run again", () => {
  it("changes nothing the second time", async () => {
    const before = (await rows("select count(*)::int n from play_states"))[0]!.n;
    await migrate(db, ["0077_plays_library_core.sql"]);
    expect((await rows("select count(*)::int n from play_states"))[0]!.n).toBe(before);
  });
});
