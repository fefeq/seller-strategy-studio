import { describe, expect, it } from "vitest";
import { grossMargin, marginFor, segmentBudget, withBudgetMargin, type BudgetLike } from "./segment-budget";
import { paybackByQuarter, segmentCoverage, type DealLike, type SegLike } from "./segment-coverage";
import { quarterRange } from "./metrics";

const mid: SegLike = { id: "mid", name: "Mid-market", acv_min: 5000, acv_max: 50000, win_rate_target: 25, cac_target: 10000, gross_margin_pct: 80, payback_months: 12 };
const budget = (o: Partial<BudgetLike>): BudgetLike => ({ segment_id: "mid", year: 2026, plan_revenue: null, plan_cost_to_serve: null, plan_acquisition: null, plan_new_customers: null, actual_revenue: null, actual_cost_to_serve: null, ...o });
const won = (o: Partial<DealLike> = {}): DealLike => ({ segment_id: "mid", amount: 20000, stage: "won", close_date: null, closed_at: "2026-05-10", updated_at: "2026-05-10", created_at: "2026-03-01", ...o });

describe("segment budget", () => {
  it("gross margin = (revenue − cost to serve) / revenue", () => {
    expect(grossMargin(1_000_000, 400_000)).toBe(60);
    expect(grossMargin(0, 100)).toBeNull();
    expect(grossMargin(1000, null)).toBeNull();
  });

  it("payback margin: actual of the year, then plan, then the segment target", () => {
    expect(marginFor(mid, budget({ actual_revenue: 1000, actual_cost_to_serve: 400, plan_revenue: 1000, plan_cost_to_serve: 100 }))).toEqual({ pct: 60, source: "real" });
    expect(marginFor(mid, budget({ plan_revenue: 1000, plan_cost_to_serve: 300 }))).toEqual({ pct: 70, source: "plan" });
    expect(marginFor(mid, undefined)).toEqual({ pct: 80, source: "objetivo" });
  });

  it("plan CAC = planned acquisition / planned new customers; plan payback uses the plan margin", () => {
    const [r] = segmentBudget([mid], [won()], [budget({ plan_revenue: 1000, plan_cost_to_serve: 500, plan_acquisition: 100000, plan_new_customers: 10 })], [], 2026);
    expect(r.plan.cac).toBe(10000);
    // 10 000 / (20 000 × 50% / 12) = 12 months
    expect(r.plan.payback).toBeCloseTo(12);
    expect(r.payback.planOk).toBe(true);
  });

  it("actual acquisition = costs of the year's quarters; customers = deals won that year; payback uses the real margin", () => {
    const costs = [
      { segment_id: "mid", channel: "Eventos", amount: 6000, period: "2026-Q1" },
      { segment_id: "mid", channel: "Eventos", amount: 6000, period: "2026-Q3" },
      { segment_id: "mid", channel: "Eventos", amount: 9999, period: "2025-Q4" },
    ];
    const deals = [won(), won({ closed_at: "2025-11-01" })];
    const [r] = segmentBudget([mid], deals, [budget({ actual_revenue: 100000, actual_cost_to_serve: 40000 })], costs, 2026);
    expect(r.actual.acquisition).toBe(12000);
    expect(r.actual.newCustomers).toBe(1);
    expect(r.actual.cac).toBe(12000);
    // 12 000 / (20 000 × 60% / 12) = 12 months
    expect(r.actual.payback).toBeCloseTo(12);
  });

  it("coverage payback switches from the 80% target margin to the real 40% margin of the budget", () => {
    const range = { start: new Date("2026-04-01"), end: new Date("2026-07-01") };
    const costs = [{ segment_id: "mid", channel: "Eventos", amount: 10000 }];
    const [before] = segmentCoverage([mid], [won()], {}, range, costs);
    const segs = withBudgetMargin([mid], [budget({ actual_revenue: 1000, actual_cost_to_serve: 600 })], 2026);
    const [after] = segmentCoverage(segs, [won()], {}, range, costs);
    expect(before.payback.real).toBeCloseTo(7.5);
    expect(after.payback.real).toBeCloseTo(15);
    expect(after.payback.ok).toBe(false);
  });

  it("quarterly payback uses each quarter's year budget", () => {
    const costs = [{ segment_id: "mid", channel: "Eventos", amount: 10000, period: "2026-Q2" }];
    const budgets = [budget({ year: 2026, actual_revenue: 1000, actual_cost_to_serve: 500 })];
    const [r] = paybackByQuarter([mid], [won()], costs, ["2026-Q2"], quarterRange, (q) => withBudgetMargin([mid], budgets, Number(q.slice(0, 4))));
    // 10 000 / (20 000 × 50% / 12) = 12
    expect(r.byQuarter["2026-Q2"].payback).toBeCloseTo(12);
  });
});
