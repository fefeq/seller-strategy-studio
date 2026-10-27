// What postponing a setup step does to its suggestion «setup_incomplete:<step>» in the Suggestions inbox (SDD strategy-setup-guided-next-step, CA-7).
// Runs the real detector and the real syncSuggestions against an in-memory suggestions table that keeps the unique (org_id, dedupe_key) of the real one.
import { describe, expect, it } from "vitest";
import { detect } from "@/lib/proactive";
import type { Snapshot } from "@/lib/proactive/types";
import { syncSuggestions, type Db } from "@/lib/org-data";
import type { SetupData } from "@/lib/setup-schema";

type Row = { id: string; org_id: string; dedupe_key: string; detector: string; status: string; title: string; body: string | null; snoozed_until: string | null };

/** The slice of the Supabase client syncSuggestions uses on `suggestions`, with the real upsert-ignore-duplicates and update semantics. */
function fakeDb(store: Row[]): Db {
  const from = () => {
    let op: "select" | "update" | "upsert" = "select";
    let patch: Partial<Row> = {};
    let incoming: Partial<Row>[] = [];
    const filters: ((r: Row) => boolean)[] = [];
    const b: Record<string, unknown> = {
      select: () => b,
      update: (p: Partial<Row>) => { op = "update"; patch = p; return b; },
      upsert: (rows: Partial<Row>[]) => { op = "upsert"; incoming = rows; return b; },
      eq: (c: keyof Row, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: keyof Row, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      not: (c: keyof Row, _o: string, v: string) => { const vs = v.slice(1, -1).split(","); filters.push((r) => !vs.includes(String(r[c]))); return b; },
      lte: (c: keyof Row, v: string) => (filters.push((r) => r[c] != null && String(r[c]) <= v), b),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        const hit = store.filter((r) => filters.every((f) => f(r)));
        if (op === "upsert") for (const n of incoming) if (!store.some((r) => r.org_id === n.org_id && r.dedupe_key === n.dedupe_key)) store.push({ id: `s${store.length + 1}`, status: "pending", snoozed_until: null, body: null, ...n } as Row);
        if (op === "update") for (const r of hit) Object.assign(r, patch);
        return Promise.resolve({ data: op === "select" ? hit.map((r) => ({ ...r })) : null, error: null }).then(res, rej);
      },
    };
    return b;
  };
  return { from } as unknown as Db;
}

const fullPos = Object.fromEntries(["best_customers", "alternatives", "differentiation", "value", "trend", "target_customer", "need", "category", "key_benefit", "competitive_alternative", "differentiator", "one_liner", "elevator_pitch"].map((k) => [k, "texto"]));
const setup = (o: Partial<SetupData> = {}): SetupData => ({
  currency: "EUR", segments: [{ name: "Seg A", acv_min: 1, acv_max: 2, win_rate_target: 20, ae_quota: 100 }], icps: [{ industries: "a", company_size: "b", why_fit: "c", anti_icp: "d" }],
  positioning: fullPos, pillars: [1, 2, 3].map((n) => ({ title: `T${n}`, message: `M${n}` })), quotas: [], accounts: 1, deals: 1, quarter: "2026-Q4", ...o,
}); // only the quota is missing
const team = [{ user_id: "own1", role: "owner" }];
const snap = (now: string, snoozes: Snapshot["setupSnoozes"] = [], data: SetupData = setup()): Snapshot => ({ now: new Date(now), orgId: "o1", setup: data, setupSnoozes: snoozes, members: team, deals: [], meetings: [], accounts: [], stakeholders: [], registrations: [], trials: [], segments: [] });
const run = (db: Db, s: Snapshot) => syncSuggestions(db, "o1", detect(s));
const byKey = (store: Row[], key: string) => store.find((r) => r.dedupe_key === key);
const row = (store: Row[]) => store.find((r) => r.dedupe_key === "setup_incomplete:quota");
const SNOOZED = [{ step_id: "quota", snoozed_until: "2026-11-03T11:00:00.000Z" }];

describe("postponing a setup step and its suggestion (CA-7)", () => {
  it("postponing closes the open suggestion for that step, at the next run of the proactive job", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await run(db, snap("2026-10-27T08:00:00Z"));
    expect(row(store)?.status).toBe("pending");
    await run(db, snap("2026-10-27T09:00:00Z", SNOOZED)); // the person postponed the quota
    expect(row(store)?.status).toBe("resolved");
  });

  it("the guide itself brings the step back when the postponement ends (screen and agent)", () => {
    expect(detect(snap("2026-11-04T08:00:00Z", SNOOZED)).map((s) => s.dedupe_key)).toEqual(["setup_incomplete:quota:1793703600"]);
    expect(detect(snap("2026-11-02T08:00:00Z", SNOOZED))).toEqual([]);
  });

  // The row of a closed or dismissed suggestion keeps its key (unique per company), so the one that returns carries the day the postponement ended.
  it("the suggestion comes back when the postponement ends, after the postponement closed it", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await run(db, snap("2026-10-27T08:00:00Z"));
    await run(db, snap("2026-10-27T09:00:00Z", SNOOZED));
    await run(db, snap("2026-11-04T08:00:00Z", SNOOZED));
    expect(row(store)?.status).toBe("resolved"); // the old row stays closed
    expect(store.find((r) => r.dedupe_key === "setup_incomplete:quota:1793703600")?.status).toBe("pending");
  });

  it("the suggestion comes back when the postponement ends, even if the person had dismissed it before", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await run(db, snap("2026-10-27T08:00:00Z"));
    row(store)!.status = "dismissed";
    await run(db, snap("2026-10-27T09:00:00Z", SNOOZED));
    await run(db, snap("2026-11-04T08:00:00Z", SNOOZED));
    expect(row(store)?.status).toBe("dismissed");
    expect(store.find((r) => r.dedupe_key === "setup_incomplete:quota:1793703600")?.status).toBe("pending");
  });

  it("a second postponement and its end give yet another suggestion, and nothing doubles while it is open", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    const later = [{ step_id: "quota", snoozed_until: "2026-11-10T11:00:00.000Z" }];
    await run(db, snap("2026-11-04T08:00:00Z", SNOOZED));
    await run(db, snap("2026-11-04T09:00:00Z", SNOOZED));
    expect(store.filter((r) => r.status === "pending")).toHaveLength(1);
    await run(db, snap("2026-11-05T08:00:00Z", later)); // postponed again: the open one closes
    await run(db, snap("2026-11-11T08:00:00Z", later));
    expect(store.filter((r) => r.status === "pending").map((r) => r.dedupe_key)).toEqual(["setup_incomplete:quota:1794308400"]);
  });

  it("the step is still found from the key: the resolve plan and Inicio read the step as the second part", () => {
    const found = detect(snap("2026-11-04T08:00:00Z", SNOOZED))[0]!;
    expect(found.dedupe_key.split(":")[1]).toBe("quota");
    expect(found.dedupe_key.startsWith("setup_incomplete:")).toBe(true);
  });

  it("M-2: postponing and clearing the same step twice on the same day gives a second suggestion, not a blocked one", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    const first = [{ step_id: "quota", snoozed_until: "2026-10-27T09:00:00.000Z" }]; // cleared at 09:00
    const second = [{ step_id: "quota", snoozed_until: "2026-10-27T11:00:00.000Z" }]; // postponed and cleared again at 11:00
    await run(db, snap("2026-10-27T08:00:00Z"));
    await run(db, snap("2026-10-27T08:30:00Z", [{ step_id: "quota", snoozed_until: "2026-11-03T11:00:00.000Z" }])); // postponed: closes
    await run(db, snap("2026-10-27T09:00:05Z", first));
    const a = store.find((r) => r.dedupe_key.endsWith(String(Math.floor(Date.parse(first[0]!.snoozed_until) / 1000))))!;
    expect(a.status).toBe("pending");
    a.status = "dismissed";
    await run(db, snap("2026-10-27T10:30:00Z", [{ step_id: "quota", snoozed_until: "2026-11-03T11:00:00.000Z" }]));
    await run(db, snap("2026-10-27T11:00:05Z", second));
    expect(store.filter((r) => r.status === "pending").map((r) => r.dedupe_key)).toEqual([`setup_incomplete:quota:${Math.floor(Date.parse(second[0]!.snoozed_until) / 1000)}`]);
  });
});

describe("a setup suggestion comes back when its step is emitted again (two steps)", () => {
  // segments (3rd in the order) and quota (6th): the guide recommends the first pending one
  const both = setup({ segments: [], quotas: [] });
  const onlyQuota = setup({ quotas: [] });
  const onlySegments = setup({ segments: [] });

  it("a step that was resolved because another took its place is reopened when it is next again", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await run(db, snap("2026-10-27T08:00:00Z", [], onlyQuota));          // quota is next
    await run(db, snap("2026-10-27T09:00:00Z", [], both));               // segments reopens ahead of it (order, or CA-5): quota closes, segments opens
    expect(byKey(store, "setup_incomplete:quota")?.status).toBe("resolved");
    expect(byKey(store, "setup_incomplete:segments")?.status).toBe("pending");
    await run(db, snap("2026-10-27T10:00:00Z", [], onlyQuota));          // segments done again: segments closes, quota must come back
    expect(byKey(store, "setup_incomplete:segments")?.status).toBe("resolved");
    expect(byKey(store, "setup_incomplete:quota")?.status).toBe("pending");
    await run(db, snap("2026-10-27T11:00:00Z", [], onlySegments));       // and the other way round
    expect(byKey(store, "setup_incomplete:segments")?.status).toBe("pending");
    expect(byKey(store, "setup_incomplete:quota")?.status).toBe("resolved");
    expect(store.filter((r) => r.detector === "setup_incomplete")).toHaveLength(2); // no duplicates
  });

  it("a step that was done and is reopened (CA-5) gets its suggestion back", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await run(db, snap("2026-10-27T08:00:00Z", [], onlyQuota));
    await run(db, snap("2026-10-27T09:00:00Z", [], setup({ quotas: [{ period: "2026-Q4", amount: 100 }] }))); // quota filled: closes
    expect(byKey(store, "setup_incomplete:quota")?.status).toBe("resolved");
    await run(db, snap("2026-10-27T10:00:00Z", [], onlyQuota));          // the quota was deleted
    expect(byKey(store, "setup_incomplete:quota")?.status).toBe("pending");
  });

  it("a suggestion the person dismissed stays dismissed when its step is emitted again", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await run(db, snap("2026-10-27T08:00:00Z", [], onlyQuota));
    byKey(store, "setup_incomplete:quota")!.status = "dismissed";
    await run(db, snap("2026-10-27T09:00:00Z", [], both));
    await run(db, snap("2026-10-27T10:00:00Z", [], onlyQuota));
    expect(byKey(store, "setup_incomplete:quota")?.status).toBe("dismissed");
  });

  it("other detectors are left alone: a resolved suggestion that is found again stays resolved", async () => {
    const store: Row[] = [{ id: "s1", org_id: "o1", dedupe_key: "stale_deal:d1", detector: "stale_deal", status: "resolved", title: "x", body: null, snoozed_until: null }];
    const db = fakeDb(store);
    await syncSuggestions(db, "o1", [{ detector: "stale_deal", dedupe_key: "stale_deal:d1", priority: 2, title: "x", body: "", link: null, action: null, user_id: null }]);
    expect(store[0]!.status).toBe("resolved");
  });
});
