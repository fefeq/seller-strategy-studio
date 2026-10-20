import { describe, expect, it } from "vitest";
import { annualFromQuarters, deviation, grossMargin, marginFor, quarterlyBudget, segmentBudget, withBudgetMargin, withPeriodMargin, type BudgetLike, type QuarterBudgetLike } from "./segment-budget";
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

describe("quarterly budget", () => {
  const q = (period: string, o: Partial<QuarterBudgetLike> = {}): QuarterBudgetLike => ({ segment_id: "mid", period, plan_revenue: null, plan_cost_to_serve: null, plan_acquisition: null, plan_new_customers: null, actual_revenue: null, actual_cost_to_serve: null, ...o });

  it("the year is the sum of its quarters; a field nobody filled stays empty", () => {
    const [y] = annualFromQuarters([q("2026-Q1", { plan_revenue: 100, plan_new_customers: 2 }), q("2026-Q2", { plan_revenue: 150, plan_new_customers: 3 }), q("2025-Q4", { plan_revenue: 999 })], 2026);
    expect(y.plan_revenue).toBe(250);
    expect(y.plan_new_customers).toBe(5);
    expect(y.actual_revenue).toBeNull();
  });

  it("each quarter compares its own plan with its own costs and deals won", () => {
    const rows = [q("2026-Q2", { plan_acquisition: 10000, plan_new_customers: 2 }), q("2026-Q3", { plan_acquisition: 5000, plan_new_customers: 1 })];
    const costs = [{ segment_id: "mid", channel: "Eventos", amount: 12000, period: "2026-Q2" }];
    const r = quarterlyBudget([mid], [won()], rows, costs, 2026);
    const q2 = r.byQuarter["2026-Q2"][0];
    expect(q2.plan.cac).toBe(5000);
    expect(q2.actual.acquisition).toBe(12000);
    expect(q2.actual.newCustomers).toBe(1);
    expect(q2.actual.cac).toBe(12000);
    expect(r.byQuarter["2026-Q3"][0].actual.newCustomers).toBe(0);
    expect(r.year[0].plan.acquisition).toBe(15000);
    expect(r.year[0].plan.cac).toBe(5000);
  });

  it("quarter margin first, then its year; a real margin always beats a planned one", () => {
    const rows = [q("2026-Q1", { actual_revenue: 1000, actual_cost_to_serve: 500 }), q("2026-Q2", { plan_revenue: 1000, plan_cost_to_serve: 100 })];
    expect(withPeriodMargin([mid], rows, "2026-Q1")[0].gross_margin_pct).toBe(50);
    // Q2 only has a plan (90%), but the year already has a real margin (50%)
    expect(withPeriodMargin([mid], rows, "2026-Q2")[0]).toMatchObject({ gross_margin_pct: 50, margin_source: "real" });
    expect(withPeriodMargin([mid], [], "2026-Q2")[0]).toMatchObject({ gross_margin_pct: 80, margin_source: "objetivo" });
  });

  it("deviation is green when revenue goes up and red when costs go up", () => {
    expect(deviation(110, 100)).toEqual({ value: 10, good: true });
    expect(deviation(110, 100, { lowerIsBetter: true })).toEqual({ value: 10, good: false });
    expect(deviation(9, 12, { lowerIsBetter: true })).toEqual({ value: -25, good: true });
    expect(deviation(55, 60, { points: true })).toEqual({ value: -5, good: false });
    expect(deviation(null, 100)).toBeNull();
  });
});
