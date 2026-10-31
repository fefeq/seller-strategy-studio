// SDD-20261031 suggestion-accept-needs-form-outside-ui (NK-0041), CA-1: confirming a pending agent action (agent, MCP, Telegram «a:»)
// that accepts a test or a commercial action ends as «failed» with the reason, never as «Hecho». Fake client per table; fictional data.
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

import { decidePending } from "@/lib/agent.functions";

type Call = { kind: "select" | "update" | "insert" | "rpc"; table: string; payload?: unknown };
function fakeDbByTable(rows: Record<string, unknown>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const c: Call = { kind: "select", table };
    calls.push(c);
    let selected = false;
    const p: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (f: (v: unknown) => unknown) =>
              Promise.resolve({
                data: c.kind === "update" && selected ? [{ id: "x" }] : null,
                error: null,
              }).then(f);
          return (...a: unknown[]) => {
            if (prop === "maybeSingle")
              return Promise.resolve({ data: rows[table] ?? null, error: null });
            if (prop === "single") return Promise.resolve({ data: null, error: null });
            if (prop === "update" || prop === "insert") {
              c.kind = prop;
              c.payload = a[0];
            } else if (prop === "select") selected = true;
            return p;
          };
        },
      },
    );
    return p;
  };
  const rpc = (name: string, args: unknown) => {
    calls.push({ kind: "rpc", table: name, payload: args });
    return Promise.resolve({ data: "approved", error: null });
  };
  return { db: { from, rpc } as unknown as ToolCtx["db"], calls };
}

const ORG = "org-1",
  ME = "11111111-1111-4111-8111-111111111111",
  SUG = "33333333-3333-4333-8333-333333333333";
const ctx = (db: ToolCtx["db"]): ToolCtx => ({
  db,
  orgId: ORG,
  userId: ME,
  roles: ["ae"],
  currency: "EUR",
});
const suggestion = (action_type: "experiment" | "commercial_action" | "data_to_complete") => {
  const m = buildStrategySuggestion({
    element: "pipeline",
    kind: "validate",
    action_type,
    cause: "c",
    priority: 1,
    title: "Prueba algo",
    body: "t",
    evidence: [{ table: "deals", id: "d1", label: "Deal 1" }],
  });
  return {
    id: SUG,
    org_id: ORG,
    user_id: null,
    status: "pending",
    detector: m.detector,
    title: m.title,
    action: null,
    strategy: m.strategy,
  };
};
const pendingAction = {
  id: "a1",
  user_id: ME,
  org_id: ORG,
  status: "pending",
  tool: "decide_suggestion",
  args: { suggestion_id: SUG, decision: "approve" },
  summary: "Aprobar la sugerencia",
  conversation_id: null,
};

beforeEach(() => remember.mockReset());

describe("decidePending: accepting a test or a commercial action from the agent, the MCP or Telegram", () => {
  for (const type of ["experiment", "commercial_action"] as const)
    it(`${type}: ends as failed with the reason, not as «Hecho», and decides nothing`, async () => {
      const { db, calls } = fakeDbByTable({
        agent_pending_actions: pendingAction,
        suggestions: suggestion(type),
      });
      const r = await decidePending(ctx(db), "a1", "confirm");
      expect(r.status).toBe("failed");
      expect(r.result).toMatch(/^No la he aceptado\./);
      expect(r.result).not.toMatch(/^Hecho/);
      expect(calls.some((c) => c.kind === "rpc")).toBe(false);
      expect(
        calls.some(
          (c) =>
            c.table === "agent_pending_actions" &&
            c.kind === "update" &&
            (c.payload as { status?: string }).status === "failed",
        ),
      ).toBe(true);
    });
  it("guard: another type is still confirmed as done", async () => {
    const { db, calls } = fakeDbByTable({
      agent_pending_actions: pendingAction,
      suggestions: suggestion("data_to_complete"),
    });
    const r = await decidePending(ctx(db), "a1", "confirm");
    expect(r.status).toBe("confirmed");
    expect(r.result).toMatch(/^Hecho/);
    expect(calls.some((c) => c.kind === "rpc")).toBe(true);
  });
});
