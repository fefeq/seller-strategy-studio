// Tool trace (0108): one row per tool call of a turn, so «it picked the wrong tool» can be diagnosed from data.
// Only the tool name, how it ended and how long it took. Never arguments, results or error text: those can hold
// customer text. Tracing must never break or slow a turn: saveToolTrace swallows every failure.
import { safeErrorLog } from "./safe-error-log";
import { withTurnId } from "./turn-id";
import type { ToolCtx } from "./tool-kit";

export type ToolOutcome = "ok" | "error" | "pending";
export type ToolTraceRow = {
  tool: string;
  kind: "read" | "write";
  outcome: ToolOutcome;
  duration_ms: number;
};
export type ToolTraceMeta = {
  source: "agent" | "mcp";
  provider?: string | null;
  conversationId?: string | null;
  /** The agent turn the calls belong to (0109, no foreign key). MCP calls have none. */
  turnId?: string | null;
};

/** How a call ended, from what the tool wrapper returned: reads answer `{error}` instead of throwing. */
export function traceOutcome(kind: "read" | "write", result: unknown): ToolOutcome {
  const failed =
    typeof result === "object" && result !== null && "error" in result && Boolean(result.error);
  if (failed) return "error";
  return kind === "write" ? "pending" : "ok";
}

/** Runs one tool call and notes it in `rows`. A throw is noted as an error and rethrown untouched. */
export async function traced<T>(
  rows: ToolTraceRow[],
  tool: { name: string; kind: "read" | "write" },
  call: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const note = (outcome: ToolOutcome) =>
    rows.push({ tool: tool.name, kind: tool.kind, outcome, duration_ms: Date.now() - start });
  try {
    const result = await call();
    note(traceOutcome(tool.kind, result));
    return result;
  } catch (e) {
    note("error");
    throw e;
  }
}

/** Stores the calls of a turn in one insert. Never throws. */
export async function saveToolTrace(ctx: ToolCtx, meta: ToolTraceMeta, rows: ToolTraceRow[]) {
  if (!rows.length) return;
  try {
    // While migration 0109 is not applied the trace is still saved: without the column, once more without turn_id.
    const { error } = await withTurnId((withTurn) =>
      ctx.db.from("agent_tool_calls").insert(
        rows.map((r) => ({
          org_id: ctx.orgId,
          user_id: ctx.userId,
          conversation_id: meta.conversationId ?? null,
          source: meta.source,
          provider: meta.provider ?? null,
          ...(withTurn && meta.turnId ? { turn_id: meta.turnId } : {}),
          ...r,
        })),
      ),
    );
    if (error) console.error("tool trace failed", { code: error.code ?? null });
  } catch (e) {
    console.error("tool trace failed", safeErrorLog(e));
  }
}
