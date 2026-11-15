// A2: approving a suggestion whose action spends prepares a pending action with its estimate; nothing runs.
import { describe, expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tools";

const exec = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => {
  const chain: object = new Proxy(() => chain, { get: () => () => chain, apply: () => chain });
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/memory.server", () => ({ rememberDecision: vi.fn() }));
vi.mock("@/lib/agent/tools", async (orig) => ({ ...(await orig<object>()), executeTool: exec }));

import { decideSuggestionCore } from "@/lib/agent.functions";

const ME = "11111111-1111-4111-8111-111111111111";
const sug = {
  id: "s1", org_id: "o1", user_id: ME, status: "pending", detector: "x", title: "Busca empresas",
  action: { tool: "clay_find_companies", args: { keywords: ["agencias"] } }, strategy: null,
};
function fakeDb() {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    let op = "select";
    const p: Record<string, unknown> = {};
    const self = new Proxy(p, {
      get(_t, prop: string) {
        if (prop === "then") {
          const data = op === "claim" ? [{ id: "s1" }] : table === "integration_usage" ? [] : null;
          return (f: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(f);
        }
        return (...a: unknown[]) => {
          if (prop === "maybeSingle") return Promise.resolve({ data: table === "suggestions" ? sug : null, error: null });
          if (prop === "insert") inserts.push({ table, row: a[0] as Record<string, unknown> });
          if (prop === "update") op = "update";
          if (prop === "select" && op === "update") op = "claim";
          return self;
        };
      },
    });
    return self;
  };
  return { db: { from, rpc: async () => ({ data: null, error: null }) } as unknown as ToolCtx["db"], inserts };
}

describe("spending suggestion approval", () => {
  it("creates a pending action with «coste aprox.» and does not execute the tool", async () => {
    const { db, inserts } = fakeDb();
    const r = await decideSuggestionCore({ db, orgId: "o1", userId: ME, roles: ["owner"], currency: "EUR" }, "s1", "approve");
    expect(exec).not.toHaveBeenCalled();
    const pending = inserts.find((i) => i.table === "agent_pending_actions");
    expect(pending?.row.tool).toBe("clay_find_companies");
    expect(String(pending?.row.summary)).toContain("coste aprox.: sin dato");
    expect(r.message).toContain("confírmalo");
  });
});
