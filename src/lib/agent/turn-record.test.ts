// @vitest-environment node
// SDD-20261121-agent-turn-metrics (NK-0191), U-1: the pure rules that turn what happened in an agent turn into its row.
// Fictional ids and figures; no provider is called.
import { describe, expect, it } from "vitest";
import {
  rawStepCost,
  stepUsages,
  sumSteps,
  turnOutcome,
  turnRow,
  type TurnFacts,
} from "@/lib/agent/turn-record";

const base: TurnFacts = {
  id: "00000000-0000-4000-8000-000000000001",
  orgId: "00000000-0000-4000-8000-0000000000aa",
  userId: "00000000-0000-4000-8000-0000000000a1",
  conversationId: "00000000-0000-4000-8000-0000000000c1",
  channel: "app",
  mode: "chat",
  provider: "openrouter",
  model: "vendor/model-x",
  attempts: 1,
  steps: [{ inputTokens: 100, outputTokens: 20, costUsd: 0.001 }],
  durationMs: 1234,
  proposedCount: 0,
  hasText: true,
};

describe("turnRow", () => {
  it("CA-1: an answered turn is one row with channel, mode, provider, duration and steps", () => {
    expect(turnRow(base)).toEqual({
      id: base.id,
      org_id: base.orgId,
      user_id: base.userId,
      conversation_id: base.conversationId,
      channel: "app",
      mode: "chat",
      provider: "openrouter",
      model: "vendor/model-x",
      attempts: 1,
      steps: 1,
      duration_ms: 1234,
      input_tokens: 100,
      output_tokens: 20,
      cost_usd: 0.001,
      cost_kind: "measured",
      outcome: "answered",
      error_status: null,
      proposed_count: 0,
    });
  });

  it("CA-1: duration is a whole, non-negative number of milliseconds and the model is cut to 200 characters", () => {
    const row = turnRow({ ...base, durationMs: 12.7, model: "m".repeat(500) });
    expect(row.duration_ms).toBe(13);
    expect(row.model).toHaveLength(200);
    expect(turnRow({ ...base, durationMs: -5 }).duration_ms).toBe(0);
    expect(turnRow({ ...base, model: "" }).model).toBeNull();
    expect(turnRow({ ...base, model: undefined }).model).toBeNull();
  });

  it("CA-2: the cost is measured only when the provider reports it; otherwise null and unknown", () => {
    const reported = turnRow(base);
    expect([reported.cost_usd, reported.cost_kind]).toEqual([0.001, "measured"]);
    const silent = turnRow({ ...base, steps: [{ inputTokens: 100, outputTokens: 20 }] });
    expect([silent.cost_usd, silent.cost_kind]).toEqual([null, "unknown"]);
    // A reported zero is a measurement, not a missing value.
    const free = turnRow({ ...base, steps: [{ inputTokens: 1, outputTokens: 1, costUsd: 0 }] });
    expect([free.cost_usd, free.cost_kind]).toEqual([0, "measured"]);
  });

  it("CA-2: a cost is never computed from tokens, whatever the token counts are", () => {
    for (const tokens of [1, 1_000, 1_000_000]) {
      const row = turnRow({
        ...base,
        provider: "gemini",
        steps: [{ inputTokens: tokens, outputTokens: tokens }],
      });
      expect(row.cost_usd).toBeNull();
      expect(row.cost_kind).toBe("unknown");
      expect(row.input_tokens).toBe(tokens);
    }
  });

  it("CA-2: steps that are not known leave steps, tokens and cost empty, never zero", () => {
    for (const steps of [null, undefined]) {
      const row = turnRow({ ...base, steps });
      expect(row.steps).toBeNull();
      expect(row.input_tokens).toBeNull();
      expect(row.output_tokens).toBeNull();
      expect([row.cost_usd, row.cost_kind]).toEqual([null, "unknown"]);
    }
  });

  it("CA-2/CA-13 (rule): a turn that reached no provider is cost 0 measured, provider `none`, no tokens", () => {
    const row = turnRow({ ...base, provider: "none", model: null, attempts: 0, steps: null });
    expect([row.cost_usd, row.cost_kind]).toEqual([0, "measured"]);
    expect([row.input_tokens, row.output_tokens, row.steps]).toEqual([null, null, null]);
    expect(row.provider).toBe("none");
    // No attempt means no provider and no usage, whatever the caller left in the facts.
    const stale = turnRow({ ...base, attempts: 0 });
    expect([stale.provider, stale.cost_usd, stale.cost_kind]).toEqual(["none", 0, "measured"]);
    expect([stale.input_tokens, stale.output_tokens, stale.steps]).toEqual([null, null, null]);
  });

  it("CA-2/CA-5: a refused turn reached no provider, so its cost is known: 0 measured", () => {
    const row = turnRow({ ...base, provider: "none", attempts: 0, steps: null, refused: true });
    expect([row.outcome, row.provider, row.cost_usd, row.cost_kind]).toEqual([
      "refused",
      "none",
      0,
      "measured",
    ]);
  });

  it("CA-2/CA-6: a turn that failed before any attempt is 0 measured; after one attempt it is unknown", () => {
    const before = turnRow({ ...base, provider: "none", attempts: 0, steps: null, failed: true });
    expect([before.outcome, before.cost_usd, before.cost_kind]).toEqual(["failed", 0, "measured"]);
    // A failed attempt may have been billed: nothing reported is unknown, never zero.
    for (const attempts of [1, 2]) {
      const after = turnRow({ ...base, attempts, steps: null, failed: true, errorStatus: 500 });
      expect([after.provider, after.cost_usd, after.cost_kind]).toEqual([
        "openrouter",
        null,
        "unknown",
      ]);
    }
  });

  it("CA-4: the row names the provider that answered and counts the attempts", () => {
    const row = turnRow({ ...base, provider: "gemini", attempts: 2 });
    expect(row.provider).toBe("gemini");
    expect(row.attempts).toBe(2);
    const none = turnRow({ ...base, provider: "none", attempts: 0, steps: null, failed: true });
    expect([none.provider, none.attempts]).toEqual(["none", 0]);
  });

  it("CA-5/CA-6 (rule): the HTTP status is kept only on a failed turn and only when it is one", () => {
    expect(turnRow({ ...base, failed: true, errorStatus: 429 }).error_status).toBe(429);
    expect(turnRow({ ...base, failed: true, errorStatus: 0 }).error_status).toBeNull();
    expect(turnRow({ ...base, failed: true, errorStatus: Number.NaN }).error_status).toBeNull();
    expect(turnRow({ ...base, failed: true }).error_status).toBeNull();
    expect(turnRow({ ...base, errorStatus: 500 }).error_status).toBeNull();
  });
});

describe("sumSteps", () => {
  it("CA-3: tokens and cost are the sum of every step", () => {
    expect(
      sumSteps([
        { inputTokens: 100, outputTokens: 10, costUsd: 0.001 },
        { inputTokens: 200, outputTokens: 20, costUsd: 0.002 },
        { inputTokens: 300, outputTokens: 30, costUsd: 0.003 },
      ]),
    ).toEqual({
      steps: 3,
      inputTokens: 600,
      outputTokens: 60,
      costUsd: expect.closeTo(0.006, 10),
      costKind: "measured",
    });
  });

  it("CA-3: one step without cost makes the whole cost unknown, never a partial sum", () => {
    const s = sumSteps([
      { inputTokens: 100, outputTokens: 10, costUsd: 0.001 },
      { inputTokens: 200, outputTokens: 20 },
    ]);
    expect([s.costUsd, s.costKind]).toEqual([null, "unknown"]);
    expect([s.inputTokens, s.outputTokens]).toEqual([300, 30]);
    expect(sumSteps([{ costUsd: 0.001 }, { costUsd: null }]).costUsd).toBeNull();
  });

  it("CA-3: one step without tokens makes the turn's tokens empty, never a partial sum", () => {
    const s = sumSteps([
      { inputTokens: 100, outputTokens: 10, costUsd: 0.001 },
      { costUsd: 0.002 },
    ]);
    expect([s.inputTokens, s.outputTokens]).toEqual([null, null]);
    expect([s.costUsd, s.costKind]).toEqual([expect.closeTo(0.003, 10), "measured"]);
    const half = sumSteps([
      { inputTokens: 100, outputTokens: 10 },
      { inputTokens: 5, outputTokens: undefined },
    ]);
    expect([half.inputTokens, half.outputTokens]).toEqual([105, null]);
  });

  it("CA-3: values that are not finite, non-negative numbers count as missing", () => {
    const s = sumSteps([
      { inputTokens: Number.NaN, outputTokens: -1, costUsd: Number.POSITIVE_INFINITY },
    ]);
    expect(s).toEqual({
      steps: 1,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      costKind: "unknown",
    });
  });

  it("CA-3: no steps at all is nothing reported, not a zero", () => {
    expect(sumSteps([])).toEqual({
      steps: 0,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      costKind: "unknown",
    });
    expect(sumSteps(null).steps).toBeNull();
  });
});

describe("turnOutcome", () => {
  const o = (f: Partial<TurnFacts>) => turnOutcome({ ...base, ...f });

  it("CA-5: the result is one of a closed set", () => {
    expect(o({})).toBe("answered");
    expect(o({ proposedCount: 2 })).toBe("proposed");
    expect(o({ hasText: false })).toBe("empty");
    expect(o({ refused: true })).toBe("refused");
    expect(o({ failed: true })).toBe("failed");
  });

  it("CA-5: failed wins over everything, also after proposing", () => {
    expect(o({ failed: true, proposedCount: 3, refused: true, hasText: false })).toBe("failed");
  });

  it("CA-5: refused wins over proposed, empty and answered", () => {
    expect(o({ refused: true, proposedCount: 1, hasText: false })).toBe("refused");
  });

  it("CA-5: proposed wins over empty: a turn with proposals and no text still proposed", () => {
    expect(o({ proposedCount: 1, hasText: false })).toBe("proposed");
  });

  it("CA-5: empty is only a turn with no text and no proposal", () => {
    expect(o({ proposedCount: 0, hasText: false })).toBe("empty");
    expect(o({ proposedCount: 0, hasText: true })).toBe("answered");
  });
});

describe("rawStepCost", () => {
  it("CA-2: reads the cost of an OpenRouter usage chunk with the billing rule of usageOf", () => {
    expect(rawStepCost({ usage: { is_byok: false, cost: 0.004 } })).toBe(0.004);
    expect(
      rawStepCost({
        usage: { is_byok: true, cost: 0.0001, cost_details: { upstream_inference_cost: 0.02 } },
      }),
    ).toBe(0.02);
  });

  it("CA-2: a usage chunk that does not say how it was billed has no cost; tokens never give one", () => {
    expect(rawStepCost({ usage: { prompt_tokens: 900, completion_tokens: 100 } })).toBeNull();
    expect(rawStepCost({ usage: { cost: 0.004 } })).toBeNull();
    expect(rawStepCost({ usage: { is_byok: true, cost: 0.004 } })).toBeNull();
  });

  it("CA-2: a chunk without usage is not a step's cost at all", () => {
    expect(rawStepCost({ choices: [{ delta: { content: "x" } }] })).toBeUndefined();
    expect(rawStepCost({ usage: null })).toBeUndefined();
    expect(rawStepCost(null)).toBeUndefined();
    expect(rawStepCost("texto")).toBeUndefined();
  });
});

describe("stepUsages", () => {
  const sdk = [
    { usage: { inputTokens: 10, outputTokens: 1 } },
    { usage: { inputTokens: 20, outputTokens: 2 } },
  ];

  it("CA-3: pairs each step with its reported cost when there is exactly one per step", () => {
    expect(stepUsages(sdk, [0.001, 0.002])).toEqual([
      { inputTokens: 10, outputTokens: 1, costUsd: 0.001 },
      { inputTokens: 20, outputTokens: 2, costUsd: 0.002 },
    ]);
  });

  it("CA-3: with fewer or more costs than steps no step gets a cost", () => {
    for (const costs of [[0.001], [0.001, 0.002, 0.003], [], null]) {
      const steps = stepUsages(sdk, costs);
      expect(steps?.map((s) => s.costUsd)).toEqual([null, null]);
      expect(sumSteps(steps).costKind).toBe("unknown");
    }
  });

  it("CA-15 (rule): a result without steps gives null, and a step without usage gives empty tokens", () => {
    expect(stepUsages(undefined, null)).toBeNull();
    expect(stepUsages("x", null)).toBeNull();
    expect(stepUsages([{}], null)).toEqual([
      { inputTokens: null, outputTokens: null, costUsd: null },
    ]);
  });
});
