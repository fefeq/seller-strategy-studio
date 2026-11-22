// Agent turn record (SDD-20261121-agent-turn-metrics, NK-0191): the pure rules that turn what happened in one agent
// turn into its agent_turns row (migration 0109), plus the one insert that stores it. Diagnosis only: no request,
// answer, argument, result or error text. A cost is what the provider reported, or empty and `unknown`; it is never
// worked out from tokens. Recording must never break or slow a turn: keepTurn and saveTurn swallow every failure.
import { afterResponse } from "@/lib/after-response.server";
import { usageOf } from "@/lib/ai-pinned";
import type { AiProvider } from "@/lib/gemini";
import type { Db } from "@/lib/org-data";
import { safeErrorLog } from "./safe-error-log";

export type TurnChannel = "app" | "telegram";
export type TurnMode = "chat" | "interview";
export type TurnProvider = AiProvider | "none";
export type TurnOutcome = "answered" | "proposed" | "empty" | "failed" | "refused";
export type TurnCostKind = "measured" | "unknown";

/** What one model step reported. A missing or invalid value is «not reported», never zero. */
export type StepUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
};

export type TurnFacts = {
  id: string;
  orgId: string;
  userId: string;
  conversationId: string | null;
  channel: TurnChannel;
  mode: TurnMode;
  /** The provider of the last attempt; `none` when the turn reached no provider. */
  provider: TurnProvider;
  model?: string | null;
  /** Providers tried; 0 when none was reached. With 0 no model was called, so the cost is known: 0, measured. */
  attempts: number;
  /** The steps of the attempt that answered; null or undefined when they are not known. */
  steps?: StepUsage[] | null;
  durationMs: number;
  failed?: boolean;
  refused?: boolean;
  /** HTTP status of the failure, if it had one. */
  errorStatus?: number | null;
  proposedCount: number;
  /** The model wrote text (before any fixed fallback text). */
  hasText: boolean;
};

export type AgentTurnRow = {
  id: string;
  org_id: string;
  user_id: string;
  conversation_id: string | null;
  channel: TurnChannel;
  mode: TurnMode;
  provider: TurnProvider;
  model: string | null;
  attempts: number;
  steps: number | null;
  duration_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  cost_kind: TurnCostKind;
  outcome: TurnOutcome;
  error_status: number | null;
  proposed_count: number;
};

const MAX_MODEL = 200;
const reported = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const whole = (v: unknown) => (reported(v) ? Math.round(v) : 0);

/** How the turn ended. Priority: failed > refused > proposed > empty > answered. */
export function turnOutcome(
  f: Pick<TurnFacts, "failed" | "refused" | "proposedCount" | "hasText">,
): TurnOutcome {
  if (f.failed) return "failed";
  if (f.refused) return "refused";
  if (f.proposedCount > 0) return "proposed";
  return f.hasText ? "answered" : "empty";
}

/** A total only when every step reported the value: one missing step empties it, never a partial sum. */
function total(values: unknown[]): number | null {
  if (!values.length || !values.every(reported)) return null;
  return (values as number[]).reduce((a, b) => a + b, 0);
}

export function sumSteps(steps: StepUsage[] | null | undefined): {
  steps: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  costKind: TurnCostKind;
} {
  const list = steps ?? [];
  const costUsd = total(list.map((s) => s.costUsd));
  return {
    steps: steps ? steps.length : null,
    inputTokens: total(list.map((s) => s.inputTokens)),
    outputTokens: total(list.map((s) => s.outputTokens)),
    costUsd,
    costKind: costUsd === null ? "unknown" : "measured",
  };
}

/** The cost one raw OpenRouter stream chunk reports: undefined when the chunk carries no usage (not a step's
 *  closing chunk), null when it carries usage without a cost. Same billing rule as usageOf (ai-pinned.ts). */
export function rawStepCost(raw: unknown): number | null | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const usage = (raw as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return undefined;
  return usageOf(usage as Record<string, unknown>).costUsd;
}

/** Steps of an AI SDK result as StepUsage. `costs` holds one entry per usage chunk seen; they are paired with the
 *  steps only when there is exactly one per step, otherwise no step gets a cost. Null when the result has no steps. */
export function stepUsages(
  sdkSteps: unknown,
  costs: (number | null)[] | null | undefined,
): StepUsage[] | null {
  if (!Array.isArray(sdkSteps)) return null;
  const paired = costs?.length === sdkSteps.length ? costs : null;
  return sdkSteps.map((step, i) => {
    const usage = (step as { usage?: { inputTokens?: unknown; outputTokens?: unknown } } | null)
      ?.usage;
    const cost = paired?.[i];
    return {
      inputTokens: reported(usage?.inputTokens) ? usage.inputTokens : null,
      outputTokens: reported(usage?.outputTokens) ? usage.outputTokens : null,
      costUsd: reported(cost) ? cost : null,
    };
  });
}

export function turnRow(f: TurnFacts): AgentTurnRow {
  const sum = sumSteps(f.steps);
  const outcome = turnOutcome(f);
  const model = typeof f.model === "string" && f.model ? f.model.slice(0, MAX_MODEL) : null;
  const status = f.errorStatus;
  const attempts = whole(f.attempts);
  // No provider was reached (refused, failed before the first attempt, or answered by a rule): nothing was called, so
  // the cost is known to be zero. After one attempt a missing cost is unknown: a failed attempt may have been billed.
  const noCall = attempts === 0;
  return {
    id: f.id,
    org_id: f.orgId,
    user_id: f.userId,
    conversation_id: f.conversationId,
    channel: f.channel,
    mode: f.mode,
    provider: noCall ? "none" : f.provider,
    model: noCall ? null : model,
    attempts,
    steps: noCall ? null : sum.steps,
    duration_ms: whole(f.durationMs),
    input_tokens: noCall ? null : sum.inputTokens,
    output_tokens: noCall ? null : sum.outputTokens,
    cost_usd: noCall ? 0 : sum.costUsd,
    cost_kind: noCall ? "measured" : sum.costKind,
    outcome,
    error_status:
      outcome === "failed" && reported(status) && Number.isInteger(status) && status >= 100
        ? status
        : null,
    proposed_count: whole(f.proposedCount),
  };
}

/** What a turn knows while it runs; runAgent and the threshold rule fill it and keepTurn reads it at the end. */
export type TurnState = {
  id: string;
  startedAt: number;
  provider: TurnProvider;
  model: string | null;
  attempts: number;
  steps: StepUsage[] | null;
  errorStatus: number | null;
  refused: boolean;
  hasText: boolean;
};

export function newTurn(): TurnState {
  return {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    provider: "none",
    model: null,
    attempts: 0,
    steps: null,
    errorStatus: null,
    refused: false,
    hasText: false,
  };
}

/** Steps and model of a finished AI SDK stream. A result without them (or that rejects) gives nulls, never a throw. */
export async function streamFacts(
  result: { steps?: PromiseLike<unknown>; response?: PromiseLike<unknown> },
  costs: (number | null)[] | null,
): Promise<{ steps: StepUsage[] | null; model: string | null }> {
  let steps: StepUsage[] | null = null;
  let model: string | null = null;
  try {
    steps = stepUsages(await result.steps, costs);
  } catch {
    steps = null;
  }
  try {
    const id = ((await result.response) as { modelId?: unknown } | undefined)?.modelId;
    model = typeof id === "string" && id ? id : null;
  } catch {
    model = null;
  }
  return { steps, model };
}

/** Stores one turn in one insert. Never throws; the log carries a code or safe error fields, never text. */
export async function saveTurn(db: Db, row: AgentTurnRow) {
  try {
    const { error } = await db.from("agent_turns").insert(row);
    if (error) console.error("agent turn failed", { code: error.code ?? null });
  } catch (e) {
    console.error("agent turn failed", safeErrorLog(e));
  }
}

/** Hands the turn's row to afterResponse so the answer never waits for it. Never throws. */
export function keepTurn(
  ctx: { db: Db; orgId: string; userId: string },
  turn: TurnState,
  facts: {
    conversationId: string | null;
    channel: TurnChannel;
    mode: TurnMode;
    proposedCount: number;
    failed: boolean;
  },
) {
  try {
    const row = turnRow({
      ...facts,
      id: turn.id,
      orgId: ctx.orgId,
      userId: ctx.userId,
      provider: turn.provider,
      model: turn.model,
      attempts: turn.attempts,
      steps: turn.steps,
      durationMs: Date.now() - turn.startedAt,
      refused: turn.refused,
      errorStatus: turn.errorStatus,
      hasText: turn.hasText,
    });
    afterResponse("agent turn", () => saveTurn(ctx.db, row));
  } catch (e) {
    console.error("agent turn failed", safeErrorLog(e));
  }
}
