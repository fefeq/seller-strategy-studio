import { describe, expect, it, vi } from "vitest";
import { runReview, REVIEW_COST_EUR, type ReviewDeps } from "@/lib/strategy-review-core";
import { buildReviewInput, inputFingerprint, type ReviewSource } from "@/lib/strategy-review";

const SOURCES: ReviewSource[] = [
  { table: "icp_profiles", id: "i1", label: "ICP", facts: { industries: "SaaS" } },
  { table: "deals", id: "d1", label: "Deal", facts: { stage: "lost" } },
];
const good = JSON.stringify({
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
  ],
});
const last = (over: Partial<NonNullable<ReviewDeps["last"]>> = {}) => ({
  id: "r0",
  created_at: "2026-10-20T10:00:00Z",
  fingerprint: "x",
  suggestions: [],
  ...over,
});
const deps = (over: Partial<ReviewDeps> = {}): ReviewDeps => ({
  sources: SOURCES,
  mode: "normal",
  depth: "low",
  last: null,
  budget: { limit: null, spent: 0 },
  ask: vi.fn(async () => good),
  names: [],
  ...over,
});

describe("runReview", () => {
  it("makes exactly one structured call, effort low by default, and returns the suggestions with the fingerprint (CA-40)", async () => {
    const d = deps();
    const r = await runReview(d);
    expect(d.ask).toHaveBeenCalledTimes(1);
    expect((d.ask as ReturnType<typeof vi.fn>).mock.calls[0][2]).toMatchObject({
      effort: "low",
      schema: { name: "strategy_review" },
    });
    expect(r.status).toBe("fresh");
    expect(r.suggestions).toHaveLength(1);
    expect(r.fingerprint).toBe(
      inputFingerprint(buildReviewInput(SOURCES).payload, "normal", "low"),
    );
    expect(r.cost).toBe(REVIEW_COST_EUR.low);
  });
  it("«A fondo» uses effort medium and costs more", async () => {
    const d = deps({ depth: "medium" });
    await runReview(d);
    expect((d.ask as ReturnType<typeof vi.fn>).mock.calls[0][2]).toMatchObject({
      effort: "medium",
    });
    expect(REVIEW_COST_EUR.medium).toBeGreaterThan(REVIEW_COST_EUR.low);
  });
  it("reuses the last review without calling the AI when the input has not changed (CA-44)", async () => {
    const fp = inputFingerprint(buildReviewInput(SOURCES).payload, "normal", "low");
    const d = deps({ last: last({ fingerprint: fp, suggestions: [] }) });
    const r = await runReview(d);
    expect(d.ask).not.toHaveBeenCalled();
    expect(r.status).toBe("reused");
    expect(r.notice).toMatch(/no han cambiado/i);
    expect(r.cost).toBe(0);
  });
  it("with the budget exhausted, warns and shows the last review without calling the AI (CA-45)", async () => {
    const d = deps({ budget: { limit: 10, spent: 10 }, last: last() });
    const r = await runReview(d);
    expect(d.ask).not.toHaveBeenCalled();
    expect(r.status).toBe("budget");
    expect(r.notice).toMatch(/presupuesto/i);
    expect(r.suggestions).toEqual(last().suggestions);
  });
  it("when the AI fails, keeps the last review and shows a readable error (CA-46)", async () => {
    const d = deps({
      last: last(),
      ask: vi.fn(async () => {
        throw new Error("502 upstream");
      }),
    });
    const r = await runReview(d);
    expect(r.status).toBe("error");
    expect(r.notice).not.toMatch(/502|upstream/);
    expect(r.notice).toMatch(/inténtalo/i);
    expect(r.cost).toBe(0);
  });
  it("an invalid answer counts as a failure and is not saved", async () => {
    const r = await runReview(deps({ ask: vi.fn(async () => "basura") }));
    expect(r.status).toBe("error");
    expect(r.suggestions).toEqual([]);
  });
  it("with nothing to read it does not call the AI and says what is missing (CA-42)", async () => {
    const d = deps({ sources: [] });
    const r = await runReview(d);
    expect(d.ask).not.toHaveBeenCalled();
    expect(r.status).toBe("no_data");
  });
  it("warns at 80 % of the budget but still runs", async () => {
    const r = await runReview(deps({ budget: { limit: 10, spent: 8.5 } }));
    expect(r.status).toBe("fresh");
    expect(r.notice).toMatch(/80/);
  });
});
