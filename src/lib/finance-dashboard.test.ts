import { describe, expect, it } from "vitest";
import { monthsActive, operatingCost, quarterFinance } from "@/lib/finance-dashboard";
import type { QuarterBudgetLike } from "@/lib/segment-budget";

const budget = (p: Partial<QuarterBudgetLike>): QuarterBudgetLike => ({
  segment_id: "s1", period: "2026-Q3", plan_revenue: null, plan_cost_to_serve: null, plan_acquisition: null,
  plan_new_customers: null, actual_revenue: null, actual_cost_to_serve: null, ...p,
});
const base = { quarter: "2026-Q3", lines: [], cac: [], invoices: [], budgets: [], deals: [] };

describe("monthsActive", () => {
  it("counts only the months of the quarter the cost is active", () => {
    expect(monthsActive({ starts_on: "2026-01-01", ends_on: null }, "2026-Q3")).toBe(3);
    expect(monthsActive({ starts_on: "2026-08-15", ends_on: null }, "2026-Q3")).toBe(2);
    expect(monthsActive({ starts_on: "2026-01-01", ends_on: "2026-07-31" }, "2026-Q3")).toBe(1);
    expect(monthsActive({ starts_on: "2026-10-01", ends_on: null }, "2026-Q3")).toBe(0);
  });
});

describe("operatingCost", () => {
  it("multiplies the monthly amount by the active months and groups by category", () => {
    const r = operatingCost([
      { amount: 1000, category: "team", starts_on: "2026-01-01", ends_on: null },
      { amount: 100, category: "tools", starts_on: "2026-09-01", ends_on: null },
    ], "2026-Q3");
    expect(r.total).toBe(3100);
    expect(r.byCategory[0]).toEqual({ category: "team", amount: 3000 });
  });
});

describe("quarterFinance", () => {
  it("real spend = acquisition + operating costs; ROI = revenue / total spend", () => {
    const r = quarterFinance({
      ...base,
      cac: [{ period: "2026-Q3", amount: 2000 }, { period: "2026-Q2", amount: 999 }],
      lines: [{ amount: 1000, category: "team", starts_on: "2026-01-01", ends_on: null }],
      invoices: [{ amount: 10000, issued_on: "2026-08-10", paid_on: null }],
    });
    expect(r.actual.spend).toBe(5000);
    expect(r.actual.revenue).toBe(10000);
    expect(r.actual.margin).toBe(5000);
    expect(r.actual.marginPct).toBe(0.5);
    expect(r.actual.roi).toBe(2);
  });

  it("revenue prefers invoices, then the budget's real revenue, then won deals", () => {
    const deals = [{ stage: "won", amount: 300, closed_at: "2026-07-20T12:00:00Z", updated_at: "2026-07-20T12:00:00Z" }];
    const budgets = [budget({ actual_revenue: 700 })];
    expect(quarterFinance({ ...base, deals }).actual).toMatchObject({ revenue: 300, revenueSource: "deals" });
    expect(quarterFinance({ ...base, deals, budgets }).actual).toMatchObject({ revenue: 700, revenueSource: "presupuesto" });
    expect(quarterFinance({ ...base, deals, budgets, invoices: [{ amount: 900, issued_on: "2026-09-30", paid_on: null }] }).actual)
      .toMatchObject({ revenue: 900, revenueSource: "facturas" });
  });

  it("budget spend = planned acquisition + cost to serve; overspend is a bad deviation", () => {
    const r = quarterFinance({
      ...base,
      budgets: [budget({ plan_revenue: 8000, plan_acquisition: 1500, plan_cost_to_serve: 500 }), budget({ segment_id: "s2", plan_acquisition: 1000 })],
      cac: [{ period: "2026-Q3", amount: 3300 }],
    });
    expect(r.budget.spend).toBe(3000);
    expect(r.budget.roi).toBeCloseTo(8000 / 3000);
    expect(r.spendDeviation).toMatchObject({ good: false });
    expect(r.spendDeviation!.value).toBeCloseTo(10);
  });

  it("without revenue there is no margin or ROI, never an invented number", () => {
    const r = quarterFinance({ ...base, cac: [{ period: "2026-Q3", amount: 100 }] });
    expect(r.actual.revenue).toBeNull();
    expect(r.actual.margin).toBeNull();
    expect(r.actual.roi).toBeNull();
    expect(r.budget.spend).toBeNull();
  });
});
