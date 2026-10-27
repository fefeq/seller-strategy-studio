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
const snap = (now: string, snoozes: Snapshot["setupSnoozes"] = []): Snapshot => ({ now: new Date(now), orgId: "o1", setup: setup(), setupSnoozes: snoozes, members: team, deals: [], meetings: [], accounts: [], stakeholders: [], registrations: [], trials: [], segments: [] });
const run = (db: Db, s: Snapshot) => syncSuggestions(db, "o1", detect(s));
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
    expect(detect(snap("2026-11-04T08:00:00Z", SNOOZED)).map((s) => s.dedupe_key)).toEqual(["setup_incomplete:quota:2026-11-03"]);
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
    expect(store.find((r) => r.dedupe_key === "setup_incomplete:quota:2026-11-03")?.status).toBe("pending");
  });

  it("the suggestion comes back when the postponement ends, even if the person had dismissed it before", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await run(db, snap("2026-10-27T08:00:00Z"));
    row(store)!.status = "dismissed";
    await run(db, snap("2026-10-27T09:00:00Z", SNOOZED));
    await run(db, snap("2026-11-04T08:00:00Z", SNOOZED));
    expect(row(store)?.status).toBe("dismissed");
    expect(store.find((r) => r.dedupe_key === "setup_incomplete:quota:2026-11-03")?.status).toBe("pending");
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
    expect(store.filter((r) => r.status === "pending").map((r) => r.dedupe_key)).toEqual(["setup_incomplete:quota:2026-11-10"]);
  });

  it("the step is still found from the key: the resolve plan and Inicio read the step as the second part", () => {
    const found = detect(snap("2026-11-04T08:00:00Z", SNOOZED))[0]!;
    expect(found.dedupe_key.split(":")[1]).toBe("quota");
    expect(found.dedupe_key.startsWith("setup_incomplete:")).toBe(true);
  });
});
