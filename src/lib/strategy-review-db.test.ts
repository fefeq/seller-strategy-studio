import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.fn(async () => {});
vi.mock("@/lib/strategy-core", () => ({
  syncStrategySuggestions: (...a: unknown[]) => sync(...(a as [])),
}));
vi.mock("@/lib/orchestrator/runner", () => ({
  monthBudget: vi.fn(async () => ({ limit: null, spent: 0 })),
}));
vi.mock("@/lib/strategy-review-load", () => ({
  loadReviewSources: vi.fn(async () => [
    { table: "icp_profiles", id: "i1", label: "ICP", facts: { industrias: "SaaS" } },
    { table: "deals", id: "d1", label: "Deal", facts: { etapa: "lost" } },
  ]),
}));
import { executeReview, REVIEW_FORBIDDEN } from "@/lib/strategy-review-db";

const answer = JSON.stringify({
  suggestions: [
    {
      element: "icp",
      kind: "change",
      action_type: "strategy_change",
      priority: 2,
      title: "Revisa el ICP",
      body: "Hay una pérdida.",
      evidence_refs: ["R1", "R2"],
      invalidates_if: "Si cambia.",
      missing: [],
    },
    {
      element: "segment",
      kind: "validate",
      action_type: "experiment",
      priority: 2,
      title: "Valida el segmento",
      body: "Falta muestra.",
      evidence_refs: ["R2"],
      invalidates_if: "Si sube.",
      missing: [],
    },
  ],
});

type Chain = Record<string, (...a: never[]) => unknown>;
function fakeDb(state: { last?: unknown; open?: unknown[] }) {
  const inserted: Record<string, unknown[]> = {};
  const builder = (t: string): Chain => {
    const b: Chain = {
      select: () => b,
      eq: () => b,
      order: () => b,
      limit: () => b,
      like: () => b,
      maybeSingle: async () => ({ data: t === "strategy_reviews" ? (state.last ?? null) : null }),
      insert: async (row: unknown) => {
        (inserted[t] ??= []).push(row);
        return { error: null };
      },
      then: (res: (v: unknown) => unknown) =>
        res({ data: t === "suggestions" ? (state.open ?? []) : [] }),
    };
    return b;
  };
  return { db: { from: builder } as never, inserted };
}
const ctx = (db: never, roles = ["owner"]) => ({
  db,
  orgId: "o1",
  userId: "u1",
  roles,
  currency: "EUR",
});
beforeEach(() => sync.mockClear());

describe("executeReview", () => {
  it("only the Owner and the Sales Leader may ask (CA-40)", async () => {
    const { db } = fakeDb({});
    const ask = vi.fn();
    await expect(
      executeReview(ctx(db, ["ae"]), { mode: "normal", depth: "low" }, ask),
    ).rejects.toThrow(REVIEW_FORBIDDEN);
    expect(ask).not.toHaveBeenCalled();
  });
  it("saves the review, logs the AI usage and writes the suggestions, dropping the one an open fixed suggestion already covers (CA-47)", async () => {
    const fixed = {
      dedupe_key: "strategy_segment:x",
      strategy: {
        element: "segment",
        kind: "validate",
        evidence: [{ table: "deals", id: "d1", label: "D", link: "/deals?deal=d1" }],
        evidence_level: "low",
        sample_size: 1,
        action_type: "experiment",
        fingerprint: "00000000",
      },
    };
    const { db, inserted } = fakeDb({ open: [fixed] });
    const out = await executeReview(
      ctx(db),
      { mode: "normal", depth: "low" },
      vi.fn(async () => answer),
    );
    expect(out.status).toBe("fresh");
    expect(out.suggestions.map((s) => s.strategy.element)).toEqual(["icp"]);
    expect(
      (inserted.strategy_reviews![0] as { suggestions: unknown[]; cost: number }).suggestions,
    ).toHaveLength(1);
    expect(inserted.integration_usage![0]).toMatchObject({
      service: "ai",
      need: "strategy_review",
      trigger: "manual",
    });
    expect(sync).toHaveBeenCalledTimes(1);
  });
  it("a reused or failed review writes nothing (CA-44, CA-46)", async () => {
    const a = fakeDb({});
    const out = await executeReview(
      ctx(a.db),
      { mode: "normal", depth: "low" },
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    expect(out.status).toBe("error");
    expect(a.inserted).toEqual({});
    expect(sync).not.toHaveBeenCalled();
  });
});
