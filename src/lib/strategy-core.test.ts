// SDD-20261027 strategic-suggestions-engine, F0 · H-1: writing a decision (CA-4) and re-evaluating what a detector finds again
// (CA-5, CA-6) with a recording fake client. Fictional data only.
import { describe, expect, it } from "vitest";
import { buildStrategySuggestion } from "./strategy-suggestions";
import { decideStrategy, isStrategySuggestion, STRATEGY_DETECTOR_LIKE, syncStrategySuggestions } from "./strategy-core";
import { syncSuggestions, type Db } from "./org-data";

type Q = { table: string; op: "select" | "insert" | "update" | "upsert" | "delete"; payload?: unknown; opts?: unknown; filters: unknown[][] };
type Payload = Record<string, unknown>;
type Reply = { data?: unknown; error?: { message: string } | null } | undefined;
function fakeDb(reply: (q: Q) => Reply = () => undefined) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const proxy: object = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") {
          log.push(q);
          const r = reply(q) ?? {};
          const res = { data: r.data ?? null, error: r.error ?? null, count: null };
          return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) => Promise.resolve(res).then(a, b);
        }
        return (...args: unknown[]) => {
          if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") { q.op = prop; q.payload = args[0]; q.opts = args[1]; }
          else if (!["select", "single", "maybeSingle", "order", "limit"].includes(prop)) q.filters.push([prop, ...args]);
          return proxy;
        };
      },
    });
    return proxy;
  };
  return { db: { from } as unknown as Db, log };
}

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const ev = (n: number) => Array.from({ length: n }, (_, i) => ({ table: "deals", id: `d${i + 1}`, label: `Deal ${i + 1}` }));
const found = (n: number) => buildStrategySuggestion({ element: "icp", kind: "create", action_type: "strategy_change", cause: "won_sector", priority: 2, title: "Crea un ICP", body: "texto", evidence: ev(n) });
const eq = (q: Q, c: string, v: unknown) => q.filters.some(([op, col, val]) => op === "eq" && col === c && val === v);
const writes = (log: Q[], table?: string) => log.filter((q) => q.op !== "select" && (!table || q.table === table));
const now = new Date("2026-10-27T10:00:00Z");

const row = (over: Record<string, unknown> = {}) => ({ id: "s1", dedupe_key: "strategy_icp:won_sector", status: "pending", priority: 2, created_at: "2026-10-01T00:00:00Z", snoozed_until: null, strategy: found(5).strategy, title: "Crea un ICP", body: "texto", ...over });

describe("CA-4: decidir registra fecha, autor y motivo, y cambia el estado una sola vez", () => {
  const s = row();
  it("accept: claims the pending row for this company and logs who, when and the evidence fingerprint", async () => {
    const { db, log } = fakeDb((q) => (q.table === "suggestions" && q.op === "update" ? { data: [{ id: "s1" }] } : undefined));
    const r = await decideStrategy({ db, orgId: ORG, userId: ME }, s, "accept", { now });
    expect(r).toMatchObject({ status: "approved" });
    const upd = writes(log, "suggestions")[0]!;
    expect(upd.payload).toMatchObject({ status: "approved", snoozed_until: null });
    expect(eq(upd, "org_id", ORG) && eq(upd, "id", "s1") && eq(upd, "status", "pending")).toBe(true);
    const ins = writes(log, "strategy_decisions")[0]!;
    expect(ins.op).toBe("insert");
    expect(ins.payload).toEqual({ org_id: ORG, suggestion_id: "s1", decision: "accepted", reason: null, remind_at: null, evidence_fingerprint: s.strategy.fingerprint, decided_by: ME });
    expect(ins.payload).not.toHaveProperty("decided_at"); // the database sets the date
  });
  it("postpone: the row sleeps until the reminder date (3 days by default) and the reason is kept", async () => {
    const { db, log } = fakeDb((q) => (q.op === "update" ? { data: [{ id: "s1" }] } : undefined));
    const r = await decideStrategy({ db, orgId: ORG, userId: ME }, s, "postpone", { now, reason: " Tras la reunión " });
    expect(r.status).toBe("snoozed");
    expect(writes(log, "suggestions")[0]!.payload).toMatchObject({ status: "snoozed", snoozed_until: "2026-10-30T10:00:00.000Z" });
    expect(writes(log, "strategy_decisions")[0]!.payload).toMatchObject({ decision: "postponed", reason: "Tras la reunión", remind_at: "2026-10-30T10:00:00.000Z" });
  });
  it("dismiss: status dismissed with the reason, and the message says it only returns with new evidence", async () => {
    const { db, log } = fakeDb((q) => (q.op === "update" ? { data: [{ id: "s1" }] } : undefined));
    const r = await decideStrategy({ db, orgId: ORG, userId: ME }, s, "dismiss", { now, reason: "No aplica" });
    expect(r.message).toMatch(/evidencia nueva/);
    expect(writes(log, "strategy_decisions")[0]!.payload).toMatchObject({ decision: "dismissed", reason: "No aplica" });
  });
  it("a suggestion someone else already handled is not decided twice and logs nothing", async () => {
    const { db, log } = fakeDb(() => ({ data: [] }));
    const r = await decideStrategy({ db, orgId: ORG, userId: ME }, s, "accept", { now });
    expect(r.message).toBe("Ya estaba gestionada");
    expect(writes(log, "strategy_decisions")).toHaveLength(0);
  });
  it("if the log cannot be written the row goes back to pending and the error is shown, never a silent half decision", async () => {
    const { db, log } = fakeDb((q) => (q.table === "strategy_decisions" ? { error: { message: "boom" } } : q.op === "update" ? { data: [{ id: "s1" }] } : undefined));
    await expect(decideStrategy({ db, orgId: ORG, userId: ME }, s, "dismiss", { now })).rejects.toThrow(/No pude registrar la decisión/);
    const ups = writes(log, "suggestions");
    expect(ups).toHaveLength(2);
    expect(ups[1]!.payload).toMatchObject({ status: "pending", snoozed_until: null });
  });
  it("a row without valid strategy data is refused", async () => {
    const { db } = fakeDb();
    await expect(decideStrategy({ db, orgId: ORG, userId: ME }, { ...s, strategy: null }, "accept", { now })).rejects.toThrow(/estratégica/);
  });
});

describe("CA-5 and CA-6: syncing what the detectors find, per company", () => {
  const decisions = (fp: string) => ({ data: [{ suggestion_id: "s1", evidence_fingerprint: fp, decided_at: "2026-10-20T00:00:00Z" }] });
  const run = async (existing: Record<string, unknown>[], fp: string | null, f = found(5)) => {
    const { db, log } = fakeDb((q) => (q.table === "suggestions" && q.op === "select" ? { data: existing } : q.table === "strategy_decisions" ? (fp ? decisions(fp) : { data: [] }) : undefined));
    await syncStrategySuggestions(db, ORG, [f], now);
    return writes(log);
  };
  it("a new suggestion is inserted for this company with its strategy data and no owner", async () => {
    const w = await run([], null);
    expect(w).toHaveLength(1);
    expect(w[0]!.op).toBe("upsert");
    expect(w[0]!.opts).toEqual({ onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
    expect(w[0]!.payload).toMatchObject([{ org_id: ORG, detector: "strategy_icp", dedupe_key: "strategy_icp:won_sector", user_id: null, strategy: found(5).strategy }]);
  });
  it("CA-5: dismissed with the same evidence is not written again", async () => {
    expect(await run([row({ status: "dismissed" })], found(5).strategy.fingerprint)).toHaveLength(0);
  });
  it("CA-5: dismissed, then new evidence: it reopens as pending with the new evidence", async () => {
    const w = await run([row({ status: "dismissed" })], found(5).strategy.fingerprint, found(6));
    expect(w).toHaveLength(1);
    expect(w[0]!.op).toBe("update");
    expect(w[0]!.payload).toMatchObject({ status: "pending", snoozed_until: null, strategy: found(6).strategy });
    expect(eq(w[0]!, "org_id", ORG) && eq(w[0]!, "id", "s1")).toBe(true);
  });
  it("CA-6: postponed with the same evidence stays asleep; with changed evidence it wakes up", async () => {
    const snoozed = row({ status: "snoozed", snoozed_until: "2026-10-30T10:00:00Z" });
    expect(await run([snoozed], found(5).strategy.fingerprint)).toHaveLength(0);
    const w = await run([snoozed], found(5).strategy.fingerprint, found(7));
    expect(w[0]!.payload).toMatchObject({ status: "pending", snoozed_until: null });
  });
  it("an accepted suggestion is never rewritten", async () => {
    expect(await run([row({ status: "approved" })], found(5).strategy.fingerprint, found(9))).toHaveLength(0);
  });
});

describe("the generic sync leaves strategy suggestions to their own rules", () => {
  it("strategy detectors are recognised and routed to the strategy sync, written once", async () => {
    expect(isStrategySuggestion(found(5))).toBe(true);
    expect(isStrategySuggestion({ detector: "stale_deal", dedupe_key: "x", priority: 1, title: "t", body: "b", link: null, action: null, user_id: null })).toBe(false);
    const { db, log } = fakeDb();
    await syncSuggestions(db, ORG, [found(5)]);
    const upserts = log.filter((q) => q.op === "upsert" && q.table === "suggestions");
    expect(upserts).toHaveLength(1);
    expect((upserts[0]!.payload as Payload[])[0]!.strategy).toEqual(found(5).strategy);
  });
  it("the automatic closing of detectors that stopped applying never touches strategy rows (F5 decides when evidence disappears)", async () => {
    const { db, log } = fakeDb();
    await syncSuggestions(db, ORG, []);
    const open = log.find((q) => q.table === "suggestions" && q.op === "select" && q.filters.some(([op, c]) => op === "in" && c === "status"))!;
    expect(open.filters).toContainEqual(["not", "detector", "like", STRATEGY_DETECTOR_LIKE]);
  });
});
