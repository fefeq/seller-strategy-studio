// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tools";
import { saveToolTrace, traced, traceOutcome, type ToolTraceRow } from "@/lib/agent/tool-trace";

const READ = { name: "list_accounts", kind: "read" as const };
const WRITE = { name: "update_deal", kind: "write" as const };

function ctxWith(insert: (rows: unknown) => unknown): ToolCtx {
  return {
    db: { from: () => ({ insert }) } as unknown as ToolCtx["db"],
    orgId: "org-1",
    userId: "user-1",
    roles: ["ae"],
    currency: "EUR",
  };
}

afterEach(() => vi.restoreAllMocks());

describe("traceOutcome", () => {
  it("reads end ok, writes end pending, an error object ends error", () => {
    expect(traceOutcome("read", { filas: [] })).toBe("ok");
    expect(traceOutcome("write", { status: "pendiente_de_confirmacion" })).toBe("pending");
    expect(traceOutcome("read", { error: "No encontrado" })).toBe("error");
    expect(traceOutcome("write", { error: "permission denied" })).toBe("error");
    expect(traceOutcome("read", null)).toBe("ok");
  });
});

describe("traced", () => {
  it("notes the call and returns the result untouched", async () => {
    const rows: ToolTraceRow[] = [];
    const result = { filas: [1] };
    expect(await traced(rows, READ, async () => result)).toBe(result);
    expect(rows).toEqual([
      { tool: "list_accounts", kind: "read", outcome: "ok", duration_ms: expect.any(Number) },
    ]);
  });

  it("notes a throw as an error and rethrows it", async () => {
    const rows: ToolTraceRow[] = [];
    const boom = new Error("Tu rol no permite esta acción");
    await expect(traced(rows, WRITE, () => Promise.reject(boom))).rejects.toBe(boom);
    expect(rows.map((r) => r.outcome)).toEqual(["error"]);
  });
});

describe("saveToolTrace", () => {
  const row: ToolTraceRow = {
    tool: "update_deal",
    kind: "write",
    outcome: "pending",
    duration_ms: 12,
  };

  it("stores one row per call with no arguments, results or error text", async () => {
    const insert = vi.fn(async (_rows: unknown) => ({ error: null }));
    await saveToolTrace(
      ctxWith(insert),
      { source: "agent", provider: "openrouter", conversationId: "conv-1" },
      [row],
    );
    expect(insert).toHaveBeenCalledTimes(1);
    const stored = insert.mock.calls[0]![0] as Record<string, unknown>[];
    expect(stored).toEqual([
      {
        org_id: "org-1",
        user_id: "user-1",
        conversation_id: "conv-1",
        source: "agent",
        provider: "openrouter",
        tool: "update_deal",
        kind: "write",
        outcome: "pending",
        duration_ms: 12,
      },
    ]);
  });

  it("does nothing without calls", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    await saveToolTrace(ctxWith(insert), { source: "mcp" }, []);
    expect(insert).not.toHaveBeenCalled();
  });

  it("never throws and never logs the error text", async () => {
    const logged: unknown[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void logged.push(...a));
    const secret = "relation agent_tool_calls does not exist for Cliente Ficticio";
    await saveToolTrace(
      ctxWith(async () => ({ error: { message: secret, code: "42P01" } })),
      { source: "mcp" },
      [row],
    );
    await saveToolTrace(
      ctxWith(() => Promise.reject(new Error(secret))),
      { source: "mcp" },
      [row],
    );
    expect(logged.length).toBeGreaterThan(0);
    expect(JSON.stringify(logged)).not.toContain("Cliente Ficticio");
  });
});
