import { describe, expect, it } from "vitest";
import { funnelDiagnosis, type DiagnosisInput, type Measure, type SegmentInput } from "@/lib/funnel-diagnosis";
import type { DealLike } from "@/lib/segment-coverage";
import type { Trial } from "@/lib/self-service";

// Fictional data. Quarter 2026-Q3 = 1 July to 30 September 2026.
const Q = "2026-Q3";
const seg = (id: string, over: Partial<SegmentInput> = {}): SegmentInput => ({
  id, name: `Segmento ${id}`, acv_min: 0, acv_max: null, win_rate_target: null, cac_target: null, gross_margin_pct: 80, payback_months: null, acquisition_motion: null, ...over,
});
const deal = (segment_id: string, stage: "won" | "lost", amount = 6000, at = "2026-08-10T10:00:00Z"): DealLike =>
  ({ segment_id, amount, stage, close_date: at.slice(0, 10), closed_at: at, updated_at: at, created_at: "2026-07-01T10:00:00Z" });
const trial = (segment_id: string | null, over: Partial<Trial> = {}): Trial => ({ segment_id, signed_up_at: "2026-08-01T10:00:00Z", activated_at: null, converted_at: null, mrr: null, ...over });
const base = (over: Partial<DiagnosisInput> = {}): DiagnosisInput => ({ quarter: Q, segments: [], deals: [], leads: [], trials: [], costs: [], activationEvent: null, stripe: null, ...over });
const run = (over: Partial<DiagnosisInput>) => funnelDiagnosis(base(over))!;
const measure = (d: ReturnType<typeof run>, segment: string, phase: string, id: string): Measure =>
  d.segments.find((s) => s.segment_id === segment)!.phases.find((p) => p.id === phase)!.measures.find((m) => m.id === id)!;
const phaseOf = (d: ReturnType<typeof run>, segment: string, phase: string) => d.segments.find((s) => s.segment_id === segment)!.phases.find((p) => p.id === phase)!;

describe("funnelDiagnosis", () => {
  it("a quarter that is not AAAA-QN gives null", () => {
    expect(funnelDiagnosis(base({ quarter: "2026-T3" }))).toBeNull();
    expect(funnelDiagnosis(base({ quarter: "2026-Q5" }))).toBeNull();
  });

  it("CA-6: a company with no data says «sin datos» in every measured phase, never 0, and Referral is «no medido»", () => {
    const d = run({ segments: [seg("a")] });
    const phases = d.segments[0]!.phases;
    expect(phases.map((p) => p.id)).toEqual(["acquisition", "activation", "retention", "revenue", "referral"]);
    for (const p of phases.filter((x) => x.id !== "referral")) {
      expect(p.status, p.id).toBe("sin_datos");
      for (const m of p.measures) { expect(m.value, m.id).toBeNull(); expect(m.verdict, m.id).toBeNull(); expect(m.missing, m.id).toBeTruthy(); }
    }
    expect(phases[4]!.status).toBe("no_medido");
    expect(d.company.retention.status).toBe("sin_datos");
  });

  it("CA-5: a complete phase carries value, numerator, denominator and source", () => {
    const trials = [trial("a", { activated_at: "2026-08-02T10:00:00Z", converted_at: "2026-08-20T10:00:00Z" }), trial("a", { activated_at: "2026-08-03T10:00:00Z" }), trial("a"), trial("a")];
    const d = run({ segments: [seg("a", { acquisition_motion: "plg" })], trials, activationEvent: "workspace_created",
      leads: [{ segment_id: "a", created_at: "2026-07-15T10:00:00Z" }, { segment_id: "a", created_at: "2026-09-30T10:00:00Z" }] });
    expect(measure(d, "a", "acquisition", "leads")).toMatchObject({ status: "ok", value: 2, unit: "leads" });
    expect(measure(d, "a", "activation", "activation")).toMatchObject({ status: "ok", value: 50, numerator: 2, denominator: 4 });
    expect(measure(d, "a", "activation", "activation").source).toContain("workspace_created");
    expect(measure(d, "a", "revenue", "trial_to_paid")).toMatchObject({ status: "ok", value: 25, numerator: 1, denominator: 4, verdict: null });
  });

  it("CA-6: activation without a configured PostHog event is «sin datos» and says what is missing, even with trials", () => {
    const d = run({ segments: [seg("a")], trials: [trial("a", { activated_at: "2026-08-02T10:00:00Z" })], activationEvent: null });
    expect(measure(d, "a", "activation", "activation")).toMatchObject({ status: "sin_datos", value: null });
    expect(measure(d, "a", "activation", "activation").missing).toMatch(/PostHog/);
  });

  it("only counts what falls in the quarter and in the segment", () => {
    const d = run({ segments: [seg("a"), seg("b")], activationEvent: "x",
      leads: [{ segment_id: "a", created_at: "2026-06-30T23:59:59Z" }, { segment_id: "a", created_at: "2026-10-01T00:00:00Z" }, { segment_id: "b", created_at: "2026-08-01T00:00:00Z" }, { segment_id: null, created_at: "2026-08-01T00:00:00Z" }],
      trials: [trial("a", { signed_up_at: "2026-06-30T10:00:00Z" }), trial("b"), trial(null)] });
    expect(measure(d, "a", "acquisition", "leads").status).toBe("sin_datos");
    expect(measure(d, "b", "acquisition", "leads").value).toBe(1);
    expect(measure(d, "a", "activation", "activation").status).toBe("sin_datos");
    expect(measure(d, "b", "activation", "activation").denominator).toBe(1);
  });

  it("CA-7: slg judges win rate against win_rate_target (any value below it is a leak) and shows the denominator", () => {
    const deals = [deal("a", "won"), deal("a", "lost"), deal("a", "lost")];
    const below = run({ segments: [seg("a", { acquisition_motion: "slg", win_rate_target: 50 })], deals });
    expect(measure(below, "a", "revenue", "win_rate")).toMatchObject({ value: 33.3, numerator: 1, denominator: 3, target: 50, verdict: "fuga" });
    const met = run({ segments: [seg("a", { acquisition_motion: "slg", win_rate_target: 33 })], deals });
    expect(measure(met, "a", "revenue", "win_rate").verdict).toBe("en_objetivo");
    expect(measure(below, "a", "revenue", "won")).toMatchObject({ value: 1, denominator: 3 });
  });

  it("CA-7: a segment without a target shows the value and no verdict", () => {
    const d = run({ segments: [seg("a", { acquisition_motion: "slg", win_rate_target: null })], deals: [deal("a", "won"), deal("a", "lost")] });
    expect(measure(d, "a", "revenue", "win_rate")).toMatchObject({ status: "ok", value: 50, target: null, verdict: null });
  });

  it("slg judges payback only with a real CAC: with no costs it is «sin datos», not a comparison of the target with itself", () => {
    const s = seg("a", { acquisition_motion: "slg", payback_months: 12, cac_target: 100 });
    const noCosts = run({ segments: [s], deals: [deal("a", "won")] });
    expect(measure(noCosts, "a", "revenue", "payback")).toMatchObject({ status: "sin_datos", verdict: null });
    // CAC 3000 / (ACV 6000 × 80 % / 12 = 400 a month) = 7.5 months
    const costs = [{ segment_id: "a", channel: "Paid media", amount: 3000 }];
    const ok = run({ segments: [s], deals: [deal("a", "won")], costs });
    expect(measure(ok, "a", "revenue", "payback")).toMatchObject({ value: 7.5, target: 12, verdict: "en_objetivo" });
    const leak = run({ segments: [{ ...s, payback_months: 6 }], deals: [deal("a", "won")], costs });
    expect(measure(leak, "a", "revenue", "payback").verdict).toBe("fuga");
    const noTarget = run({ segments: [{ ...s, payback_months: null }], deals: [deal("a", "won")], costs });
    expect(measure(noTarget, "a", "revenue", "payback")).toMatchObject({ value: 7.5, verdict: null });
  });

  it("plg shows only trial to paid; no motion or marketing shows both sources with no verdict even with a target", () => {
    const trials = [trial("a", { converted_at: "2026-08-20T10:00:00Z" }), trial("a")];
    const deals = [deal("a", "won"), deal("a", "lost")];
    const plg = run({ segments: [seg("a", { acquisition_motion: "plg", win_rate_target: 90 })], trials, deals });
    expect(phaseOf(plg, "a", "revenue").measures.map((m) => m.id)).toEqual(["trial_to_paid"]);
    for (const motion of [null, "marketing", "partner"]) {
      const d = run({ segments: [seg("a", { acquisition_motion: motion, win_rate_target: 90 })], trials, deals });
      expect(phaseOf(d, "a", "revenue").measures.map((m) => m.id), String(motion)).toEqual(["trial_to_paid", "won", "win_rate"]);
      expect(phaseOf(d, "a", "revenue").measures.every((m) => m.verdict === null), String(motion)).toBe(true);
    }
  });

  it("a value outside the closed set of motions counts as «sin definir»", () => {
    const d = run({ segments: [seg("a", { acquisition_motion: "inside" })] });
    expect(d.segments[0]!.acquisition_motion).toBeNull();
  });

  it("CA-5: retention is company-level from Stripe, with its window; the segment says it cannot split it", () => {
    const d = run({ segments: [seg("a")], stripe: { logo_churn_pct: "3.456", churned_customers: 2, window_days: 30, taken_at: "2026-09-20T08:00:00Z" } });
    expect(d.company.retention).toMatchObject({ status: "ok", value: 3.5, numerator: 2 });
    expect(d.company.retention.source).toContain("30 días");
    expect(measure(d, "a", "retention", "logo_churn")).toMatchObject({ status: "sin_datos", value: null });
    expect(run({ stripe: { logo_churn_pct: null, churned_customers: null, window_days: 30, taken_at: "2026-09-20T08:00:00Z" } }).company.retention.status).toBe("sin_datos");
  });
});
