import { describe, expect, it } from "vitest";
import { actualMonth, addMonths, arAging, cacRowsFor, costToServeFor, financeHeadline, forecast, monthlyCost, monthStatus, pipelineMrr, planVsActual, projectPlans, quarterMonths, runwayMonths, type CostLine } from "./finance";

const line = (o: Partial<CostLine>): CostLine => ({ name: "x", category: "other", amount: 0, starts_on: "2026-01-01", ends_on: null, segment_id: null, ...o });
const money = (n: number) => `${Math.round(n)} €`;

describe("months", () => {
  it("adds months across years and lists a quarter", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(quarterMonths("2026-Q4")).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
});

describe("monthlyCost", () => {
  it("counts a line only between its start and end month", () => {
    const lines = [line({ amount: 1000, category: "people" }), line({ amount: 300, category: "marketing", starts_on: "2026-03-15", ends_on: "2026-04-30" })];
    expect(monthlyCost(lines, "2026-02").total).toBe(1000);
    expect(monthlyCost(lines, "2026-03").total).toBe(1300);
    expect(monthlyCost(lines, "2026-05").total).toBe(1000);
    expect(monthlyCost(lines, "2026-04", ["marketing", "sales"]).total).toBe(300);
  });
});

describe("projectPlans", () => {
  const plan = { id: "p", name: "Pro", price: 100, billing: "monthly" };
  it("grows customers with adds and churn", () => {
    const rows = projectPlans([plan], { p: { customers: 10, adds: 2, churn_pct: 10, annual_share_pct: 0 } }, "2026-01", 3, 0);
    expect(rows.map((r) => r.revenue)).toEqual([1000, 1100, 1190]);
    expect(rows[2].customers).toBe(12);
  });
  it("collects twelve months when an annual customer signs, with the annual discount", () => {
    const rows = projectPlans([plan], { p: { customers: 0, adds: 1, churn_pct: 0, annual_share_pct: 100 } }, "2026-01", 2, 20);
    expect(rows[1].revenue).toBe(80);
    expect(rows[1].cash).toBe(960);
  });
  it("ignores one-off products and plans without assumptions", () => {
    const rows = projectPlans([{ id: "o", name: "Setup", price: 5000, billing: "one_off" }, plan], {}, "2026-01", 1, 0);
    expect(rows[0].revenue).toBe(0);
  });
  it("spreads an annual plan over twelve months", () => {
    const rows = projectPlans([{ id: "a", name: "Anual", price: 1200, billing: "annual" }], { a: { customers: 5, adds: 0, churn_pct: 0, annual_share_pct: 0 } }, "2026-01", 1, 0);
    expect(rows[0].revenue).toBe(500);
  });
});

describe("pipelineMrr", () => {
  it("adds ACV/12 × probability from the close month and counts undated deals", () => {
    const r = pipelineMrr([
      { amount: 12000, probability: 50, close_date: "2026-02-10", stage: "proposal" },
      { amount: 24000, probability: 50, close_date: null, stage: "discovery" },
      { amount: 12000, probability: 100, close_date: "2026-01-05", stage: "won" },
    ], "2026-01", 3);
    expect(r.mrr).toEqual([0, 500, 500]);
    expect(r.undated).toBe(1);
  });
});

describe("forecast", () => {
  it("moves cash with revenue minus costs and finds the runway", () => {
    const f = forecast({ plans: [], assumptions: {}, discountPct: 0, deals: [], includePipeline: true, lines: [line({ amount: 1000 })], openingCash: 2500, start: "2026-01", horizon: 4, spreadPct: 25 });
    expect(f.months.map((m) => m.cash.base)).toEqual([1500, 500, -500, -1500]);
    expect(f.runway.base).toBe(2);
    expect(f.summary.burnStart).toBe(1000);
  });
  it("keeps the low band under the high band", () => {
    const f = forecast({ plans: [{ id: "p", name: "Pro", price: 100, billing: "monthly" }], assumptions: { p: { customers: 10, adds: 4, churn_pct: 5, annual_share_pct: 0 } }, discountPct: 0, deals: [], includePipeline: false, lines: [], openingCash: 0, start: "2026-01", horizon: 6, spreadPct: 25 });
    const last = f.months[5].cash;
    expect(last.low).toBeLessThan(last.base);
    expect(last.base).toBeLessThan(last.high);
  });
});

describe("runway and headline", () => {
  it("does not give a runway when the company makes cash", () => {
    expect(runwayMonths(10000, 0)).toBeNull();
    expect(runwayMonths(10000, 3000)).toBe(3);
    expect(financeHeadline({ configured: true, burn: -500, runway: null, cash: 1 }, money)).toBe("Generas caja: 500 € al mes");
    expect(financeHeadline({ configured: true, burn: 3000, runway: 3, cash: 1 }, money)).toBe("Caja para 3 meses al ritmo actual");
    expect(financeHeadline({ configured: false, burn: 0, runway: null, cash: 0 }, money)).toBe("Finanzas");
  });
});

describe("arAging", () => {
  it("buckets unpaid invoices by days overdue", () => {
    const a = arAging([
      { amount: 100, issued_on: "2026-10-01", due_on: "2026-11-01", paid_on: null },
      { amount: 200, issued_on: "2026-08-01", due_on: "2026-09-01", paid_on: null },
      { amount: 300, issued_on: "2026-01-01", due_on: null, paid_on: null },
      { amount: 999, issued_on: "2026-01-01", due_on: null, paid_on: "2026-02-01" },
    ], "2026-10-24");
    expect(a.buckets.current.amount).toBe(100);
    expect(a.buckets.d60.amount).toBe(200);
    expect(a.buckets.over90.amount).toBe(300);
    expect(a.open).toBe(600);
    expect(a.overdue).toBe(500);
  });
});

describe("actual months and plan vs real", () => {
  const invoices = [{ amount: 3000, issued_on: "2026-10-05", due_on: null, paid_on: "2026-10-20" }, { amount: 2000, issued_on: "2026-11-05", due_on: null, paid_on: null }];
  const lines = [line({ amount: 500, category: "marketing" }), line({ amount: 200, category: "cogs", segment_id: "s1" })];
  it("a closed month uses its closed figures", () => {
    const closes = [{ month: "2026-10", revenue: 3500, costs: 900, cash_end: null, closed_at: "2026-11-02" }];
    expect(actualMonth("2026-10", invoices, closes, lines).revenue).toBe(3500);
    expect(actualMonth("2026-11", invoices, closes, lines).revenue).toBe(2000);
    expect(actualMonth("2026-10", invoices, [], lines).collected).toBe(3000);
    expect(monthStatus("2026-10", closes, "2026-11")).toBe("closed");
    expect(monthStatus("2026-12", closes, "2026-11")).toBe("projected");
  });
  it("compares the quarter budget with real figures; less cost is good", () => {
    const r = planVsActual("2026-Q4", [{ period: "2026-Q4", plan_revenue: 6000, plan_cost_to_serve: 900, plan_acquisition: 1200 }], invoices, [], lines);
    const by = Object.fromEntries(r.rows.map((x) => [x.key, x]));
    expect(by.revenue.actual).toBe(5000);
    expect(by.revenue.good).toBe(false);
    expect(by.acquisition.actual).toBe(1500);
    expect(by.acquisition.good).toBe(false);
    expect(by.cost_to_serve.actual).toBe(600);
    expect(by.cost_to_serve.good).toBe(true);
    expect(r.hasPlan).toBe(true);
  });
  it("turns acquisition lines into CAC rows and segment cost lines into cost to serve", () => {
    expect(cacRowsFor(lines, "2026-Q4")).toEqual([{ segment_id: null, channel: "Finanzas · Marketing", amount: 1500 }]);
    expect(costToServeFor(lines, "2026-Q4")).toEqual([{ segment_id: "s1", amount: 600 }]);
  });
});
