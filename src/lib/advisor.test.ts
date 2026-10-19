import { describe, expect, it } from "vitest";
import { buildSnapshot, canUseAdvisor, sortRecommendations, type AdvisorRecommendation } from "./advisor";

describe("GTM advisor access", () => {
  it("Owner and Sales Leader can use it", () => {
    expect(canUseAdvisor(["owner"])).toBe(true);
    expect(canUseAdvisor(["sales_leader"])).toBe(true);
  });
  it("other roles cannot", () => {
    for (const r of ["ae", "sdr", "marketing", "deal_desk", "cs", "se", "enablement"]) expect(canUseAdvisor([r])).toBe(false);
  });
});

const rec = (p: Partial<AdvisorRecommendation>): AdvisorRecommendation => ({
  priority: 1, title: "x", rationale: "", impact: "medium", effort: "medium", window: "30d", owner_role: "ae", kpi: "", target: "", actions: [], ...p,
});

describe("recommendation order", () => {
  it("priority 1 goes first", () => expect(sortRecommendations([rec({ priority: 2, title: "b" }), rec({ priority: 1, title: "a" })])[0].title).toBe("a"));
  it("same priority: higher impact, then lower effort", () => {
    const out = sortRecommendations([
      rec({ title: "low-impact", impact: "low" }),
      rec({ title: "high-impact-hard", impact: "high", effort: "high" }),
      rec({ title: "high-impact-easy", impact: "high", effort: "low" }),
    ]);
    expect(out.map((r) => r.title)).toEqual(["high-impact-easy", "high-impact-hard", "low-impact"]);
  });
});

describe("snapshot sent to the AI", () => {
  const base = { probability: 50, health: "green", close_date: null, closed_at: null, updated_at: "2026-10-01", source: "inbound", slip_count: 0, forecast_category: null, meddpicc: {}, partner_id: null };
  const snap = buildSnapshot({
    currency: "EUR",
    now: new Date("2026-10-15"),
    deals: [
      { ...base, id: "1", name: "A", stage: "won", amount: 20000, segment_id: "s" },
      { ...base, id: "2", name: "B", stage: "lost", amount: 10000, segment_id: "s" },
      { ...base, id: "3", name: "C", stage: "proposal", amount: 30000, segment_id: "s", close_date: "2026-11-10", health: "red" },
    ],
    segments: [{ id: "s", name: "Mid", acv_min: 5000, acv_max: 50000, motion: "inside", cycle_days: 60, sdr_per_ae: 2, ae_per_se: null, cac_target: 15000, payback_months: 12, win_rate_target: 30, ae_quota: 600000, gross_margin_pct: 80 }],
    history: [],
    quotas: [{ period: "2026-Q4", amount: 10000 }],
  });
  it("uses the company currency", () => expect(snap.moneda).toBe("EUR"));
  it("compares segment win rate with its target", () => {
    expect(snap.segmentos[0].real.win_rate_pct).toBe(50);
    expect(snap.segmentos[0].benchmarks.win_rate_objetivo_pct).toBe(30);
  });
  it("coverage = quarter pipeline / quota", () => expect(snap.trimestre.cobertura).toBe("3x (sana, 3–4x)"));
  it("counts at-risk pipeline", () => expect(snap.pipeline.en_riesgo).toEqual({ deals: 1, importe: 30000 }));
});
