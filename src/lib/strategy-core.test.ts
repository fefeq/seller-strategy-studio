// SDD-20261027 strategic-suggestions-engine, F0 · H-1: writing a decision (CA-4) and re-evaluating what a detector finds again
// (CA-5, CA-6) with a recording fake client. Fictional data only.
import { describe, expect, it } from "vitest";
import { buildStrategySuggestion } from "./strategy-suggestions";
import {
  decideStrategy,
  isStrategySuggestion,
  STRATEGY_DETECTOR_LIKE,
  syncStrategySuggestions,
} from "./strategy-core";
import { syncSuggestions, type Db } from "./org-data";

type Q = {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
  payload?: unknown;
  opts?: unknown;
  filters: unknown[][];
};
type Payload = Record<string, unknown>;
type Reply = { data?: unknown; error?: { message: string } | null } | undefined;
function fakeDb(reply: (q: Q) => Reply = () => undefined) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            log.push(q);
            const r = reply(q) ?? {};
            const res = { data: r.data ?? null, error: r.error ?? null, count: null };
            return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) =>
              Promise.resolve(res).then(a, b);
          }
          return (...args: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
              q.op = prop;
              q.payload = args[0];
              q.opts = args[1];
            } else if (!["select", "single", "maybeSingle", "order", "limit"].includes(prop))
              q.filters.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  const rpc = (name: string, args: unknown) => {
    const q: Q = { table: name, op: "rpc", payload: args, filters: [] };
    log.push(q);
    const r = reply(q) ?? {};
    return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
  };
  return { db: { from, rpc } as unknown as Db, log };
}

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const ev = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    table: "deals",
    id: `d${i + 1}`,
    label: `Deal ${i + 1}`,
  }));
const found = (n: number) =>
  buildStrategySuggestion({
    element: "icp",
    kind: "create",
    action_type: "strategy_change",
    cause: "won_sector",
    priority: 2,
    title: "Crea un ICP",
    body: "texto",
    evidence: ev(n),
  });
const eq = (q: Q, c: string, v: unknown) =>
  q.filters.some(([op, col, val]) => op === "eq" && col === c && val === v);
const writes = (log: Q[], table?: string) =>
  log.filter((q) => q.op !== "select" && q.op !== "rpc" && (!table || q.table === table));
const now = new Date("2026-10-27T10:00:00Z");

const row = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  dedupe_key: "strategy_icp:won_sector",
  status: "pending",
  priority: 2,
  created_at: "2026-10-01T00:00:00Z",
  snoozed_until: null,
  strategy: found(5).strategy,
  title: "Crea un ICP",
  body: "texto",
  ...over,
});

describe("CA-4: decidir registra fecha, autor y motivo, y cambia el estado una sola vez (una función SQL, una transacción)", () => {
  const s = row();
  const RPC = "decide_strategy_suggestion";
  const ok = (status: string) => (q: Q) => (q.op === "rpc" ? { data: status } : undefined);
  const call = (log: Q[]) => log.find((q) => q.op === "rpc")!.payload as Record<string, unknown>;
  it("accept: one call to the database function for this company and this author; the app writes nothing else", async () => {
    const { db, log } = fakeDb(ok("approved"));
    const r = await decideStrategy({ db, orgId: ORG, userId: ME }, s, "accept", { now });
    expect(r).toMatchObject({ status: "approved", message: "Aceptada" });
    expect(log).toHaveLength(1);
    expect(log[0]!.table).toBe(RPC);
    expect(call(log)).toEqual({
      p_suggestion_id: "s1",
      p_org_id: ORG,
      p_decision: "accept",
      p_reason: null,
      p_remind_at: null,
      p_by: ME,
    });
    expect(writes(log)).toHaveLength(0); // no separate update or insert: the date and the fingerprint are set by the database
  });
  it("postpone: the reminder date (3 days by default) and the trimmed reason travel with the call", async () => {
    const { db, log } = fakeDb(ok("snoozed"));
    const r = await decideStrategy({ db, orgId: ORG, userId: ME }, s, "postpone", {
      now,
      reason: " Tras la reunión ",
    });
    expect(r).toMatchObject({ status: "snoozed", message: "Pospuesta hasta el 2026-10-30" });
    expect(call(log)).toMatchObject({
      p_decision: "postpone",
      p_reason: "Tras la reunión",
      p_remind_at: "2026-10-30T10:00:00.000Z",
    });
  });
  it("dismiss: carries the reason, and the message says it only returns with new evidence", async () => {
    const { db, log } = fakeDb(ok("dismissed"));
    const r = await decideStrategy({ db, orgId: ORG, userId: ME }, s, "dismiss", {
      now,
      reason: "No aplica",
    });
    expect(r.message).toMatch(/evidencia nueva/);
    expect(call(log)).toMatchObject({ p_decision: "dismiss", p_reason: "No aplica" });
  });
  it("a suggestion someone else already handled (the function returns nothing) is reported as handled", async () => {
    const { db } = fakeDb(() => ({ data: null }));
    expect(
      (await decideStrategy({ db, orgId: ORG, userId: ME }, s, "accept", { now })).message,
    ).toBe("Ya estaba gestionada");
  });
  it("if the database refuses (log or status), the error is shown and nothing is left half done", async () => {
    const { db, log } = fakeDb((q) =>
      q.op === "rpc" ? { error: { message: "boom" } } : undefined,
    );
    await expect(
      decideStrategy({ db, orgId: ORG, userId: ME }, s, "dismiss", { now }),
    ).rejects.toThrow(/No pude registrar la decisión/);
    expect(writes(log)).toHaveLength(0); // no compensating update from the app: the transaction already rolled back
  });
  it("a reason over 500 characters or a row without valid strategy data is refused before calling the database", async () => {
    const { db, log } = fakeDb();
    await expect(
      decideStrategy({ db, orgId: ORG, userId: ME }, s, "accept", { now, reason: "x".repeat(501) }),
    ).rejects.toThrow(/500/);
    await expect(
      decideStrategy({ db, orgId: ORG, userId: ME }, { ...s, strategy: null }, "accept", { now }),
    ).rejects.toThrow(/estratégica/);
    expect(log).toHaveLength(0);
  });
});

describe("CA-5 and CA-6: syncing what the detectors find, per company", () => {
  const decisions = (fp: string) => ({
    data: [{ suggestion_id: "s1", evidence_fingerprint: fp, decided_at: "2026-10-20T00:00:00Z" }],
  });
  const run = async (existing: Record<string, unknown>[], fp: string | null, f = found(5)) => {
    const { db, log } = fakeDb((q) =>
      q.table === "suggestions" && q.op === "select"
        ? { data: existing }
        : q.table === "strategy_decisions"
          ? fp
            ? decisions(fp)
            : { data: [] }
          : undefined,
    );
    await syncStrategySuggestions(db, ORG, [f], now);
    return writes(log);
  };
  it("a new suggestion is inserted for this company with its strategy data and no owner", async () => {
    const w = await run([], null);
    expect(w).toHaveLength(1);
    expect(w[0]!.op).toBe("upsert");
    expect(w[0]!.opts).toEqual({ onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
    expect(w[0]!.payload).toMatchObject([
      {
        org_id: ORG,
        detector: "strategy_icp",
        dedupe_key: "strategy_icp:won_sector",
        user_id: null,
        strategy: found(5).strategy,
      },
    ]);
  });
  it("CA-5: dismissed with the same evidence is not written again", async () => {
    expect(await run([row({ status: "dismissed" })], found(5).strategy.fingerprint)).toHaveLength(
      0,
    );
  });
  it("CA-5: dismissed, then new evidence: it reopens as pending with the new evidence", async () => {
    const w = await run([row({ status: "dismissed" })], found(5).strategy.fingerprint, found(6));
    expect(w).toHaveLength(1);
    expect(w[0]!.op).toBe("update");
    expect(w[0]!.payload).toMatchObject({
      status: "pending",
      snoozed_until: null,
      strategy: found(6).strategy,
    });
    expect(eq(w[0]!, "org_id", ORG) && eq(w[0]!, "id", "s1")).toBe(true);
  });
  it("CA-6: postponed with the same evidence stays asleep; with changed evidence it wakes up", async () => {
    const snoozed = row({ status: "snoozed", snoozed_until: "2026-10-30T10:00:00Z" });
    expect(await run([snoozed], found(5).strategy.fingerprint)).toHaveLength(0);
    const w = await run([snoozed], found(5).strategy.fingerprint, found(7));
    expect(w[0]!.payload).toMatchObject({ status: "pending", snoozed_until: null });
  });
  it("CA-5: dismissed, then the evidence only shrinks (a deal deleted or no longer fitting): nothing is written, it stays dismissed", async () => {
    expect(
      await run([row({ status: "dismissed" })], found(5).strategy.fingerprint, found(4)),
    ).toHaveLength(0);
    expect(
      await run([row({ status: "dismissed" })], found(5).strategy.fingerprint, found(1)),
    ).toHaveLength(0);
  });
  it("CA-5: a record swapped for another one counts as new evidence even if the number of records is the same", async () => {
    const swapped = buildStrategySuggestion({
      element: "icp",
      kind: "create",
      action_type: "strategy_change",
      cause: "won_sector",
      priority: 2,
      title: "Crea un ICP",
      body: "texto",
      evidence: [...ev(4), { table: "deals", id: "d9", label: "Deal 9" }],
    });
    const w = await run([row({ status: "dismissed" })], found(5).strategy.fingerprint, swapped);
    expect(w[0]!.payload).toMatchObject({ status: "pending" });
  });
  it("an accepted suggestion is never rewritten", async () => {
    expect(
      await run([row({ status: "approved" })], found(5).strategy.fingerprint, found(9)),
    ).toHaveLength(0);
  });
});

describe("the generic sync leaves strategy suggestions to their own rules", () => {
  it("strategy detectors are recognised and routed to the strategy sync, written once", async () => {
    expect(isStrategySuggestion(found(5))).toBe(true);
    expect(
      isStrategySuggestion({
        detector: "stale_deal",
        dedupe_key: "x",
        priority: 1,
        title: "t",
        body: "b",
        link: null,
        action: null,
        user_id: null,
      }),
    ).toBe(false);
    const { db, log } = fakeDb();
    await syncSuggestions(db, ORG, [found(5)]);
    const upserts = log.filter((q) => q.op === "upsert" && q.table === "suggestions");
    expect(upserts).toHaveLength(1);
    expect((upserts[0]!.payload as Payload[])[0]!.strategy).toEqual(found(5).strategy);
  });
  it("the automatic closing of detectors that stopped applying never touches strategy rows (F5 decides when evidence disappears)", async () => {
    const { db, log } = fakeDb();
    await syncSuggestions(db, ORG, []);
    const open = log.find(
      (q) =>
        q.table === "suggestions" &&
        q.op === "select" &&
        q.filters.some(([op, c]) => op === "in" && c === "status"),
    )!;
    expect(open.filters).toContainEqual(["not", "detector", "like", STRATEGY_DETECTOR_LIKE]);
  });
});
