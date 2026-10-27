// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in migrations.pg.test.ts */
// SDD-20261027 strategic-suggestions-engine, F0: runs migration 0068 (strategy evidence on suggestions, the decision log and the
// loss reason on deals) on an in-process Postgres (PGlite) with two fictional companies. Never touches a real database.
// The harness (src/test/pg-harness.ts) is a replica; suggestions and deals below copy the columns and policies of
// migrations 0007/0013 and types.ts, reduced to what 0068 touches (the real deals also has triggers 0068 does not use).
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string, B: string;
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

const ev = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    table: "deals",
    id: `d${i + 1}`,
    label: `Deal ${i + 1}`,
    link: `/deals?deal=d${i + 1}`,
  }));
const meta = (over: Record<string, unknown> = {}) => {
  const evidence = (over.evidence as unknown[]) ?? ev(5);
  const n = (over.sample_size as number) ?? evidence.length;
  return {
    element: "icp",
    kind: "create",
    evidence,
    evidence_level: n >= 10 ? "high" : n >= 5 ? "medium" : "low",
    sample_size: n,
    action_type: "strategy_change",
    fingerprint: "abc12345",
    ...over,
  };
};
let seq = 0;
const insertStrategy = async (m: unknown, detector = "strategy_icp", orgId = A) => ({
  rows: (
    await db.query(
      "insert into suggestions (org_id, detector, dedupe_key, title, strategy) values ($1,$2,$3,'t',$4::jsonb) returning id",
      [orgId, detector, `${detector}:c${++seq}`, JSON.stringify(m)],
    )
  ).rows as Record<string, any>[],
});

const createReplica = (d: Db) =>
  d.exec(`
    create table public.suggestions (
      id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, user_id uuid,
      detector text not null, dedupe_key text not null, priority int not null default 2 check (priority between 1 and 3), title text not null,
      body text not null default '', link text, action jsonb,
      status text not null default 'pending' check (status in ('pending','approved','snoozed','dismissed','resolved')),
      snoozed_until timestamptz, notified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      unique (org_id, dedupe_key));
    grant select, insert, update on public.suggestions to authenticated; grant all on public.suggestions to service_role;
    alter table public.suggestions enable row level security;
    create policy "org read" on public.suggestions for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id) and (user_id is null or user_id = auth.uid() or public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')));
    create policy "org insert" on public.suggestions for insert to authenticated with check (public.is_org_member(org_id));
    create policy "org update" on public.suggestions for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id) and (user_id is null or user_id = auth.uid() or public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader'))) with check (public.is_org_member(org_id));
    create table public.deals (
      id uuid primary key default gen_random_uuid(), account_id uuid, name text not null, stage text not null, amount numeric, close_date date, closed_at timestamptz,
      meddpicc jsonb not null default '{}', created_by uuid, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      org_id uuid default public.current_org());
    alter table public.deals enable row level security;
    grant select, insert, update, delete on public.deals to authenticated; grant all on public.deals to service_role;
    create policy "org read" on public.deals for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));
    create policy "org insert" on public.deals for insert to authenticated with check (public.is_org_member(org_id));
    create policy "org update" on public.deals for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id));
  `);

let oldDeal: string, oldSuggestion: string;

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await createReplica(db);
  // Rows that exist BEFORE the migration (CA-11): a lost deal, an open deal and an operational suggestion.
  oldDeal = (
    await rows(
      `insert into deals (name, stage, amount, org_id, meddpicc) values ('Deal viejo','lost',1200,'${A}','{"competition":{"score":1,"note":"Rival Uno"}}') returning id`,
    )
  )[0]!.id;
  await db.query(
    `insert into deals (name, stage, amount, org_id) values ('Deal abierto','demo',500,'${A}')`,
  );
  oldSuggestion = (
    await rows(
      `insert into suggestions (org_id, detector, dedupe_key, title, body, priority) values ('${A}','meddpicc_gaps','meddpicc_gaps:1','Completa MEDDPICC','texto',1) returning id`,
    )
  )[0]!.id;
  await migrate(db, ["0068_strategic_suggestions_and_loss_reason.sql"]);
}, 60_000);

describe("CA-11: los deals y las sugerencias existentes quedan intactos al añadir los campos", () => {
  it("existing deals keep every value; the new loss columns are null (sin dato)", async () => {
    const d = (await rows("select * from deals where id = $1", [oldDeal]))[0]!;
    expect(d).toMatchObject({
      name: "Deal viejo",
      stage: "lost",
      lost_reason: null,
      lost_reason_detail: null,
      lost_competitor: null,
    });
    expect(Number(d.amount)).toBe(1200);
    expect(d.meddpicc).toEqual({ competition: { score: 1, note: "Rival Uno" } });
    expect((await rows("select count(*)::int n from deals"))[0]!.n).toBe(2);
  });
  it("an operational suggestion (no strategy) is unchanged and still valid", async () => {
    const s = (await rows("select * from suggestions where id = $1", [oldSuggestion]))[0]!;
    expect(s).toMatchObject({
      detector: "meddpicc_gaps",
      title: "Completa MEDDPICC",
      body: "texto",
      priority: 1,
      status: "pending",
      strategy: null,
    });
  });
  it("the migration is additive: running it again changes nothing and loses nothing", async () => {
    await migrate(db, ["0068_strategic_suggestions_and_loss_reason.sql"]);
    expect((await rows("select count(*)::int n from deals"))[0]!.n).toBe(2);
    expect(
      (await rows("select count(*)::int n from suggestions where id = $1", [oldSuggestion]))[0]!.n,
    ).toBe(1);
  });
});

describe("CA-8, CA-9, CA-10: motivo de pérdida y competidor en deals", () => {
  let deal: string;
  it("CA-8: moving a deal to lost can store a reason from the list, free text and a competitor", async () => {
    await as(db, U.aeA, async () => {
      deal = (
        await rows("insert into deals (name, stage) values ('Deal A','negotiation') returning id")
      )[0]!.id;
      await db.query(
        "update deals set stage = 'lost', lost_reason = 'other', lost_reason_detail = 'Se fusionaron', lost_competitor = 'Rival Uno' where id = $1",
        [deal],
      );
    });
    expect(
      (
        await rows(
          "select stage, lost_reason, lost_reason_detail, lost_competitor from deals where id = $1",
          [deal],
        )
      )[0],
    ).toEqual({
      stage: "lost",
      lost_reason: "other",
      lost_reason_detail: "Se fusionaron",
      lost_competitor: "Rival Uno",
    });
  });
  it("the database refuses a reason outside the list and over-long texts", async () => {
    await as(db, U.aeA, async () => {
      expect(
        await throws(() => db.query("update deals set lost_reason = 'caro' where id = $1", [deal])),
      ).toMatch(/lost_reason/);
      expect(
        await throws(() =>
          db.query("update deals set lost_reason_detail = $2 where id = $1", [
            deal,
            "x".repeat(501),
          ]),
        ),
      ).toMatch(/lost_reason_detail/);
      expect(
        await throws(() =>
          db.query("update deals set lost_competitor = $2 where id = $1", [deal, "x".repeat(201)]),
        ),
      ).toMatch(/lost_competitor/);
    });
  });
  it("CA-9: reason and competitor can be completed on a deal that was already lost, without touching its stage", async () => {
    await as(db, U.aeA, async () => {
      await db.query(
        "update deals set lost_reason = 'price', lost_competitor = 'Rival Dos' where id = $1",
        [oldDeal],
      );
    });
    expect(
      (
        await rows("select stage, lost_reason, lost_competitor, name from deals where id = $1", [
          oldDeal,
        ])
      )[0],
    ).toEqual({
      stage: "lost",
      lost_reason: "price",
      lost_competitor: "Rival Dos",
      name: "Deal viejo",
    });
  });
  it("CA-10: a deal moved to lost with no reason is saved as lost with nulls, and the form may clear a value again", async () => {
    let d2: string;
    await as(db, U.aeA, async () => {
      d2 = (await rows("insert into deals (name, stage) values ('Deal B','demo') returning id"))[0]!
        .id;
      await db.query("update deals set stage = 'lost' where id = $1", [d2]);
    });
    expect(
      (await rows("select stage, lost_reason, lost_competitor from deals where id = $1", [d2!]))[0],
    ).toEqual({ stage: "lost", lost_reason: null, lost_competitor: null });
    await as(db, U.aeA, async () => {
      await db.query("update deals set lost_reason = null where id = $1", [deal]);
    });
    expect(
      (await rows("select lost_reason from deals where id = $1", [deal]))[0]!.lost_reason,
    ).toBeNull();
  });
  it("another company cannot read or change the loss data (RLS unchanged)", async () => {
    await as(db, U.ownerB, async () => {
      expect((await rows("select id from deals where id = $1", [oldDeal])).length).toBe(0);
      await db.query("update deals set lost_reason = 'price' where id = $1", [deal]);
    });
    expect(
      (await rows("select lost_reason from deals where id = $1", [deal]))[0]!.lost_reason,
    ).toBeNull();
  });
});

describe("CA-1, CA-2, CA-3: la base solo acepta sugerencias estratégicas completas y coherentes", () => {
  it("CA-1: a complete strategy suggestion is stored with its evidence, links, level and action", async () => {
    const id = (await insertStrategy(meta())).rows[0]!.id;
    const s = (
      await rows("select detector, strategy, status, priority from suggestions where id = $1", [id])
    )[0]!;
    expect(s).toMatchObject({ detector: "strategy_icp", status: "pending", priority: 2 });
    expect(s.strategy.evidence).toHaveLength(5);
    expect(s.strategy.evidence[0].link).toBe("/deals?deal=d1");
    expect(s.strategy).toMatchObject({
      element: "icp",
      kind: "create",
      evidence_level: "medium",
      sample_size: 5,
      action_type: "strategy_change",
    });
  });
  it("CA-1: a strategy_* detector without strategy, or with a missing or unknown field, is refused", async () => {
    expect(
      await throws(() =>
        db.query(
          "insert into suggestions (org_id, detector, dedupe_key, title) values ($1,'strategy_icp','k1','t')",
          [A],
        ),
      ),
    ).toMatch(/suggestions_strategy_valid/);
    for (const bad of [
      { element: "nope" },
      { kind: "maybe" },
      { action_type: "x" },
      { fingerprint: "" },
      { evidence_level: undefined },
    ]) {
      expect(await throws(() => insertStrategy({ ...meta(), ...bad }))).toMatch(
        /suggestions_strategy_valid/,
      );
    }
    expect(
      await throws(() =>
        insertStrategy({ ...meta(), evidence: [{ table: "deals", id: "d1", label: "x" }] }),
      ),
    ).toMatch(/suggestions_strategy_valid/);
  });
  it("CA-1: strategy data on a detector that is not strategy_* is refused", async () => {
    expect(await throws(() => insertStrategy(meta(), "meddpicc_gaps"))).toMatch(
      /suggestions_strategy_detector/,
    );
  });
  it("CA-2: with no evidence the only valid suggestion is «falta dato» asking to complete data", async () => {
    expect(await throws(() => insertStrategy(meta({ evidence: [], sample_size: 0 })))).toMatch(
      /suggestions_strategy_valid/,
    );
    expect(
      await throws(() =>
        insertStrategy(
          meta({ evidence: [], sample_size: 0, kind: "missing_data", action_type: "experiment" }),
        ),
      ),
    ).toMatch(/suggestions_strategy_valid/);
    const id = (
      await insertStrategy(
        meta({
          evidence: [],
          sample_size: 0,
          kind: "missing_data",
          action_type: "data_to_complete",
        }),
      )
    ).rows[0]!.id;
    expect(
      (await rows("select strategy->>'kind' k from suggestions where id = $1", [id]))[0]!.k,
    ).toBe("missing_data");
  });
  it("CA-3: the level must follow the fixed rule (under 5 low, 5 to 9 medium, 10 or more high) and the sample cannot be smaller than the evidence", async () => {
    for (const [n, level] of [
      [4, "low"],
      [5, "medium"],
      [9, "medium"],
      [10, "high"],
    ] as const) {
      expect(
        await throws(() =>
          insertStrategy(
            meta({ evidence: ev(Math.min(n, 4)), sample_size: n, evidence_level: level }),
          ),
        ),
      ).toBe("");
    }
    expect(
      await throws(() =>
        insertStrategy(meta({ evidence: ev(5), sample_size: 5, evidence_level: "high" })),
      ),
    ).toMatch(/suggestions_strategy_valid/);
    expect(
      await throws(() =>
        insertStrategy(meta({ evidence: ev(3), sample_size: 10, evidence_level: "low" })),
      ),
    ).toMatch(/suggestions_strategy_valid/);
    expect(
      await throws(() =>
        insertStrategy(meta({ evidence: ev(5), sample_size: 3, evidence_level: "low" })),
      ),
    ).toMatch(/suggestions_strategy_valid/);
  });
});

describe("CA-4: la decisión queda registrada con fecha, autor y motivo opcional, por empresa", () => {
  let sid: string;
  const decide = (
    uid: string,
    decision: string,
    reason: string | null = null,
    remind: string | null = null,
    org = A,
    suggestion = sid,
  ) =>
    as(db, uid, () =>
      db.query(
        "insert into strategy_decisions (org_id, suggestion_id, decision, reason, remind_at, evidence_fingerprint, decided_by) values ($1,$2,$3,$4,$5,'abc12345',$6)",
        [org, suggestion, decision, reason, remind, uid],
      ),
    );
  beforeAll(async () => {
    sid = (await insertStrategy(meta())).rows[0]!.id;
  });

  it("any role of the company can record accept, postpone or dismiss; the author is the caller", async () => {
    await decide(U.aeA, "accepted");
    await decide(U.ownerA, "postponed", "Tras la reunión", "2026-11-01T00:00:00Z");
    await decide(U.aeA, "dismissed", null);
    const r = await rows(
      "select decision, reason, remind_at, decided_by, decided_at, org_id from strategy_decisions where suggestion_id = $1 order by decided_at, decision",
      [sid],
    );
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.decided_at instanceof Date || typeof x.decided_at === "string")).toBe(
      true,
    );
    expect(r.find((x) => x.decision === "postponed")).toMatchObject({
      reason: "Tras la reunión",
      decided_by: U.ownerA,
      org_id: A,
    });
    expect(r.find((x) => x.decision === "accepted")!.reason).toBeNull();
  });
  it("only the three decisions, a reason of at most 500 characters, and never as someone else", async () => {
    expect(await throws(() => decide(U.aeA, "approved"))).toMatch(/decision/);
    expect(await throws(() => decide(U.aeA, "dismissed", "x".repeat(501)))).toMatch(/reason/);
    expect(
      await throws(() =>
        as(db, U.aeA, () =>
          db.query(
            "insert into strategy_decisions (org_id, suggestion_id, decision, evidence_fingerprint, decided_by) values ($1,$2,'accepted','f',$3)",
            [A, sid, U.ownerA],
          ),
        ),
      ),
    ).toMatch(/row-level security/);
  });
  it("the database sets the date and the fingerprint: values sent by the app are overwritten, and a decided suggestion cannot be deleted", async () => {
    const fp = (
      await rows("select strategy->>'fingerprint' fp from suggestions where id = $1", [sid])
    )[0]!.fp;
    const forged = await as(
      db,
      U.aeA,
      async () =>
        (
          await db.query(
            "insert into strategy_decisions (org_id, suggestion_id, decision, evidence_fingerprint, decided_by, decided_at) values ($1,$2,'accepted','otra-huella',$3,'2020-01-01T00:00:00Z'::timestamptz) returning evidence_fingerprint, decided_at",
            [A, sid, U.aeA],
          )
        ).rows[0] as Record<string, any>,
    );
    expect(forged.evidence_fingerprint).toBe(fp);
    expect(new Date(forged.decided_at).getFullYear()).toBeGreaterThan(2020);
    expect(Math.abs(Date.now() - new Date(forged.decided_at).getTime())).toBeLessThan(60_000);
    expect(await throws(() => db.query("delete from suggestions where id = $1", [sid]))).toMatch(
      /foreign key|strategy_decisions/,
    );
  });
  it("a decision on a suggestion that does not exist or has no strategy data is refused by the trigger", async () => {
    expect(
      await throws(() =>
        as(db, U.aeA, () =>
          db.query(
            "insert into strategy_decisions (org_id, suggestion_id, decision, evidence_fingerprint, decided_by) values ($1,$2,'accepted','x',$3)",
            [A, "00000000-0000-4000-8000-00000000ffff", U.aeA],
          ),
        ),
      ),
    ).toMatch(/row-level security|does not exist/);
    expect(
      await throws(() =>
        as(db, U.aeA, () =>
          db.query(
            "insert into strategy_decisions (org_id, suggestion_id, decision, evidence_fingerprint, decided_by) values ($1,$2,'accepted','x',$3)",
            [A, oldSuggestion, U.aeA],
          ),
        ),
      ),
    ).toMatch(/no strategy data|does not exist/);
  });
  it("a member of another company cannot record or read decisions of this one", async () => {
    // refused either by the trigger (the suggestion is invisible to the caller) or by the insert policy
    expect(await throws(() => decide(U.ownerB, "dismissed", null, null, B))).toMatch(
      /row-level security|does not exist/,
    );
    expect(await throws(() => decide(U.ownerB, "dismissed", null, null, A))).toMatch(
      /row-level security|does not exist/,
    );
    await as(db, U.ownerB, async () => {
      expect((await rows("select id from strategy_decisions")).length).toBe(0);
    });
  });
  it("the log is append-only for the app: no update, no delete", async () => {
    await as(db, U.ownerA, async () => {
      expect(await throws(() => db.query("update strategy_decisions set reason = 'x'"))).toMatch(
        /permission denied/,
      );
      expect(await throws(() => db.query("delete from strategy_decisions"))).toMatch(
        /permission denied/,
      );
    });
  });
  it("a decision on a suggestion this person cannot see is refused (assigned to someone else, not a leader)", async () => {
    const own = (
      (
        await db.query(
          "insert into suggestions (org_id, user_id, detector, dedupe_key, title, strategy) values ($1,$2,'strategy_icp','own:1','t',$3::jsonb) returning id",
          [A, U.ownerA, JSON.stringify(meta())],
        )
      ).rows[0] as Record<string, any>
    ).id as string;
    expect(await throws(() => decide(U.aeA, "accepted", null, null, A, own))).toMatch(
      /row-level security|does not exist/,
    );
    expect(await throws(() => decide(U.ownerA, "accepted", null, null, A, own))).toBe("");
  });
});

describe("CA-4 atomic: decide_strategy_suggestion changes the status and logs the decision in one transaction", () => {
  const rpc = (
    uid: string | null,
    id: string,
    decision: string,
    reason: string | null = null,
    remind: string | null = null,
    org = A,
    by = uid ?? U.aeA,
  ) =>
    as(
      db,
      uid,
      async () =>
        (
          (
            await db.query(
              "select public.decide_strategy_suggestion($1,$2,$3,$4,$5::timestamptz,$6) r",
              [id, org, decision, reason, remind, by],
            )
          ).rows[0] as Record<string, string | null>
        ).r,
    );
  const fresh = async () => (await insertStrategy(meta())).rows[0]!.id as string;
  const state = async (id: string) => ({
    s: (await rows("select status, snoozed_until from suggestions where id = $1", [id]))[0]!,
    d: await rows(
      "select decision, reason, remind_at, decided_by, evidence_fingerprint, org_id from strategy_decisions where suggestion_id = $1",
      [id],
    ),
  });

  it("accept, postpone and dismiss each change the status and write exactly one log row, with the fingerprint of the suggestion", async () => {
    const a = await fresh(),
      p = await fresh(),
      x = await fresh();
    expect(await rpc(U.aeA, a, "accept")).toBe("approved");
    expect(
      await rpc(U.ownerA, p, "postpone", " Tras la reunión ", "2026-11-01T00:00:00Z", A, U.ownerA),
    ).toBe("snoozed");
    expect(await rpc(U.aeA, x, "dismiss", "No aplica")).toBe("dismissed");
    const sa = await state(a),
      sp = await state(p),
      sx = await state(x);
    expect(sa.s.status).toBe("approved");
    expect(sa.d).toEqual([
      expect.objectContaining({
        decision: "accepted",
        reason: null,
        decided_by: U.aeA,
        evidence_fingerprint: "abc12345",
        org_id: A,
      }),
    ]);
    expect(sp.s.status).toBe("snoozed");
    expect(new Date(sp.s.snoozed_until).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(sp.d).toEqual([
      expect.objectContaining({ decision: "postponed", reason: "Tras la reunión" }),
    ]);
    expect(sx.s.status).toBe("dismissed");
    expect(sx.d).toEqual([expect.objectContaining({ decision: "dismissed", reason: "No aplica" })]);
  });
  it("postpone without a date sleeps 3 days", async () => {
    const id = await fresh();
    await rpc(U.aeA, id, "postpone");
    const days = (new Date((await state(id)).s.snoozed_until).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(2.9);
    expect(days).toBeLessThan(3.1);
  });
  it("a second decision on the same suggestion does nothing (returns null) and logs nothing", async () => {
    const id = await fresh();
    await rpc(U.aeA, id, "dismiss");
    expect(await rpc(U.ownerA, id, "accept", null, null, A, U.ownerA)).toBeNull();
    const s = await state(id);
    expect(s.s.status).toBe("dismissed");
    expect(s.d).toHaveLength(1);
  });
  it("if the log insert fails the status change is undone: never a decided suggestion without its record", async () => {
    const id = await fresh();
    // authenticated caller claiming to be someone else: the update succeeds inside the function, the insert is refused by RLS, all rolls back
    expect(await throws(() => rpc(U.aeA, id, "accept", null, null, A, U.ownerA))).toMatch(
      /row-level security/,
    );
    const s = await state(id);
    expect(s.s.status).toBe("pending");
    expect(s.d).toHaveLength(0);
  });
  it("bad input is refused before anything changes", async () => {
    const id = await fresh();
    expect(await throws(() => rpc(U.aeA, id, "approve"))).toMatch(/unknown decision/);
    expect(await throws(() => rpc(U.aeA, id, "dismiss", "x".repeat(501)))).toMatch(/500/);
    expect((await state(id)).s.status).toBe("pending");
  });
  it("another company, or a suggestion this person cannot see, cannot be decided", async () => {
    const id = await fresh();
    expect(await rpc(U.ownerB, id, "dismiss", null, null, B, U.ownerB)).toBeNull(); // not B's suggestion
    expect(await rpc(U.ownerB, id, "dismiss", null, null, A, U.ownerB)).toBeNull(); // RLS hides it from B
    const own = (
      (
        await db.query(
          "insert into suggestions (org_id, user_id, detector, dedupe_key, title, strategy) values ($1,$2,'strategy_icp','own:rpc','t',$3::jsonb) returning id",
          [A, U.ownerA, JSON.stringify(meta())],
        )
      ).rows[0] as Record<string, any>
    ).id as string;
    expect(await rpc(U.aeA, own, "accept")).toBeNull();
    expect((await state(own)).s.status).toBe("pending");
    expect(await rpc(U.ownerA, own, "accept", null, null, A, U.ownerA)).toBe("approved");
  });
  it("the privileged client (Telegram, cron) can decide for the user it acts for; an operational suggestion is not decidable here", async () => {
    const id = await fresh();
    expect(await rpc(null, id, "accept", null, null, A, U.aeA)).toBe("approved");
    expect((await state(id)).d[0]).toMatchObject({ decided_by: U.aeA });
    expect(await rpc(null, oldSuggestion, "accept", null, null, A, U.aeA)).toBeNull();
  });
  it("anonymous users cannot call it", async () => {
    const id = await fresh();
    expect(
      await throws(async () => {
        await db.exec("set role anon");
        try {
          await db.query("select public.decide_strategy_suggestion($1,$2,'accept',null,null,$3)", [
            id,
            A,
            U.aeA,
          ]);
        } finally {
          await db.exec("reset role");
        }
      }),
    ).toMatch(/permission denied/);
  });
});

describe("migration on a database that already has strategy_* rows (no failure on previous rows, repeatable)", () => {
  it("a strategy_* row created before the migration (so without strategy data) does not stop it: the check stays NOT VALID and keeps guarding new writes", async () => {
    const d2 = await build();
    const { A: A2 } = await seed(d2);
    await createReplica(d2);
    await d2.query(
      "insert into suggestions (org_id, detector, dedupe_key, title) values ($1,'strategy_icp','old:1','Antigua')",
      [A2],
    );
    await migrate(d2, ["0068_strategic_suggestions_and_loss_reason.sql"]);
    await migrate(d2, ["0068_strategic_suggestions_and_loss_reason.sql"]); // and again
    const c = (
      await d2.query(
        "select convalidated from pg_constraint where conname = 'suggestions_strategy_valid'",
      )
    ).rows[0] as Record<string, any>;
    expect(c.convalidated).toBe(false);
    expect(
      await throws(() =>
        d2.query(
          "insert into suggestions (org_id, detector, dedupe_key, title) values ($1,'strategy_icp','new:1','t')",
          [A2],
        ),
      ),
    ).toMatch(/suggestions_strategy_valid/);
    expect((await d2.query("select count(*)::int n from suggestions")).rows[0]).toEqual({ n: 1 });
  }, 60_000);
  it("on the usual database (no previous strategy_* rows) every check ends validated", async () => {
    const r = await rows(
      "select conname from pg_constraint where conname in ('suggestions_strategy_valid','suggestions_strategy_detector','deals_lost_reason_list','deals_lost_reason_detail_len','deals_lost_competitor_len') and not convalidated",
    );
    expect(r).toEqual([]);
  });
});
