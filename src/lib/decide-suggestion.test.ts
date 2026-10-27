// SDD-20261027 strategic-suggestions-engine, F0 · CA-4: the server join of a decision, decideSuggestionCore in agent.functions.ts:
// who may act (canActOnSuggestion, also for the privileged client of Telegram), the route of strategy_* suggestions to the atomic
// database function, the reason that travels with it, and rememberDecision. Fake client; fictional data; no network.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";
import type { ToolCtx } from "@/lib/agent/tools";

const remember = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => {
  const chain: object = new Proxy(() => chain, { get: () => () => chain, apply: () => chain });
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/memory.server", () => ({ rememberDecision: remember }));

import { decideSuggestionCore } from "@/lib/agent.functions";

type Call = {
  kind: "select" | "update" | "rpc";
  table: string;
  payload?: unknown;
  filters: unknown[][];
};
function fakeDb(suggestion: Record<string, unknown> | null, rpcData: string | null = "approved") {
  const calls: Call[] = [];
  const from = (table: string) => {
    const c: Call = { kind: "select", table, filters: [] };
    calls.push(c);
    const p: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (f: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null }).then(f);
          return (...a: unknown[]) => {
            if (prop === "maybeSingle") return Promise.resolve({ data: suggestion, error: null });
            if (prop === "update") {
              c.kind = "update";
              c.payload = a[0];
            } else if (!["select", "single", "order", "limit"].includes(prop))
              c.filters.push([prop, ...a]);
            return p;
          };
        },
      },
    );
    return p;
  };
  const rpc = (name: string, args: unknown) => {
    calls.push({ kind: "rpc", table: name, payload: args, filters: [] });
    return Promise.resolve({ data: rpcData, error: null });
  };
  return { db: { from, rpc } as unknown as ToolCtx["db"], calls };
}

const ORG = "org-1",
  ME = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222";
const ctx = (db: ToolCtx["db"], roles = ["ae"], userId = ME): ToolCtx => ({
  db,
  orgId: ORG,
  userId,
  roles,
  currency: "EUR",
});
const b = buildStrategySuggestion({
  element: "icp",
  kind: "create",
  action_type: "strategy_change",
  cause: "c",
  priority: 2,
  title: "Crea un ICP",
  body: "t",
  evidence: [{ table: "deals", id: "d1", label: "Deal 1" }],
});
const strat = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  org_id: ORG,
  user_id: null,
  status: "pending",
  detector: b.detector,
  title: b.title,
  action: null,
  strategy: b.strategy,
  ...over,
});
const operational = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  org_id: ORG,
  user_id: null,
  status: "pending",
  detector: "meddpicc_gaps",
  title: "Completa MEDDPICC",
  action: null,
  strategy: null,
  ...over,
});
const rpcCall = (calls: Call[]) => calls.find((c) => c.kind === "rpc");

beforeEach(() => remember.mockReset());

describe("decideSuggestionCore: strategic suggestions", () => {
  it("approve goes to the atomic function with this company and this user, and the decision is remembered", async () => {
    const { db, calls } = fakeDb(strat(), "approved");
    const r = await decideSuggestionCore(ctx(db), "s1", "approve");
    expect(r).toMatchObject({ status: "approved", message: "Aceptada" });
    expect(rpcCall(calls)).toMatchObject({
      table: "decide_strategy_suggestion",
      payload: { p_suggestion_id: "s1", p_org_id: ORG, p_decision: "accept", p_by: ME },
    });
    expect(calls.some((c) => c.kind === "update")).toBe(false); // no direct status write: the function does it
    expect(remember).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG }),
      expect.objectContaining({ id: "s1" }),
      "approve",
    );
  });
  it("snooze maps to postpone and is not remembered; dismiss maps to dismiss and is", async () => {
    const a = fakeDb(strat(), "snoozed");
    await decideSuggestionCore(ctx(a.db), "s1", "snooze");
    expect(rpcCall(a.calls)!.payload).toMatchObject({ p_decision: "postpone" });
    expect(remember).not.toHaveBeenCalled();
    const d = fakeDb(strat(), "dismissed");
    await decideSuggestionCore(ctx(d.db), "s1", "dismiss");
    expect(rpcCall(d.calls)!.payload).toMatchObject({ p_decision: "dismiss" });
    expect(remember).toHaveBeenCalledWith(expect.anything(), expect.anything(), "dismiss");
  });
  it("the reason typed by the person travels to the log", async () => {
    const { db, calls } = fakeDb(strat(), "dismissed");
    await decideSuggestionCore(ctx(db), "s1", "dismiss", { reason: "  No aplica  " });
    expect(rpcCall(calls)!.payload).toMatchObject({ p_reason: "No aplica" });
  });
  it("a suggestion someone else already handled is not decided again nor remembered", async () => {
    const closed = fakeDb(strat({ status: "dismissed" }));
    expect(await decideSuggestionCore(ctx(closed.db), "s1", "approve")).toEqual({
      status: "dismissed",
      message: "Ya estaba gestionada",
    });
    expect(rpcCall(closed.calls)).toBeUndefined();
    const race = fakeDb(strat(), null); // pending when read, handled by the time the function ran
    expect((await decideSuggestionCore(ctx(race.db), "s1", "approve")).message).toBe(
      "Ya estaba gestionada",
    );
    expect(remember).not.toHaveBeenCalled();
  });
  it("is searched only inside the caller's company", async () => {
    const { db, calls } = fakeDb(strat());
    await decideSuggestionCore(ctx(db), "s1", "approve");
    const sel = calls.find((c) => c.kind === "select")!;
    expect(sel.filters).toEqual(
      expect.arrayContaining([
        ["eq", "id", "s1"],
        ["eq", "org_id", ORG],
      ]),
    );
  });
});

describe("decideSuggestionCore: who may act (Telegram and the privileged client skip RLS)", () => {
  it("someone else's suggestion is refused to a plain member, before anything is written or remembered", async () => {
    const { db, calls } = fakeDb(strat({ user_id: OTHER }));
    await expect(decideSuggestionCore(ctx(db, ["ae"]), "s1", "approve")).rejects.toThrow(
      /no encontrada/,
    );
    expect(rpcCall(calls)).toBeUndefined();
    expect(remember).not.toHaveBeenCalled();
  });
  it("a leader or owner may decide it; the suggestion's own assignee and an unassigned one too", async () => {
    for (const [roles, uid] of [
      [["sales_leader"], OTHER],
      [["owner"], OTHER],
      [["ae"], ME],
      [["ae"], null],
    ] as const) {
      const { db, calls } = fakeDb(strat({ user_id: uid }), "approved");
      await decideSuggestionCore(ctx(db, [...roles]), "s1", "approve");
      expect(rpcCall(calls), `${roles} ${uid}`).toBeDefined();
    }
  });
  it("a suggestion that does not exist is «no encontrada»", async () => {
    const { db } = fakeDb(null);
    await expect(decideSuggestionCore(ctx(db), "nope", "approve")).rejects.toThrow(/no encontrada/);
  });
});

describe("decideSuggestionCore: operational suggestions keep their own path", () => {
  it("dismiss writes the status directly and never touches the strategic function", async () => {
    const { db, calls } = fakeDb(operational());
    const r = await decideSuggestionCore(ctx(db), "o1", "dismiss");
    expect(r.status).toBe("dismissed");
    expect(rpcCall(calls)).toBeUndefined();
    expect(calls.find((c) => c.kind === "update")!.payload).toMatchObject({ status: "dismissed" });
  });
});
