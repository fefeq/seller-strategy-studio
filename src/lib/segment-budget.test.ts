import { describe, expect, it } from "vitest";
import {
  annualFromQuarters,
  deviation,
  grossMargin,
  marginFor,
  quarterlyBudget,
  segmentBudget,
  withBudgetMargin,
  withPeriodMargin,
  type BudgetLike,
  type QuarterBudgetLike,
} from "./segment-budget";
import { paybackByQuarter, segmentCoverage, type DealLike, type SegLike } from "./segment-coverage";
import { quarterRange } from "./metrics";

const mid: SegLike = {
  id: "mid",
  name: "Mid-market",
  acv_min: 5000,
  acv_max: 50000,
  win_rate_target: 25,
  cac_target: 10000,
  gross_margin_pct: 80,
  payback_months: 12,
};
const budget = (o: Partial<BudgetLike>): BudgetLike => ({
  segment_id: "mid",
  year: 2026,
  plan_revenue: null,
  plan_cost_to_serve: null,
  plan_acquisition: null,
  plan_new_customers: null,
  actual_revenue: null,
  actual_cost_to_serve: null,
  ...o,
});
const won = (o: Partial<DealLike> = {}): DealLike => ({
  segment_id: "mid",
  amount: 20000,
  stage: "won",
  close_date: null,
  closed_at: "2026-05-10",
  updated_at: "2026-05-10",
  created_at: "2026-03-01",
  ...o,
});

describe("segment budget", () => {
  it("gross margin = (revenue − cost to serve) / revenue", () => {
    expect(grossMargin(1_000_000, 400_000)).toBe(60);
    expect(grossMargin(0, 100)).toBeNull();
    expect(grossMargin(1000, null)).toBeNull();
  });

  it("payback margin: actual of the year, then plan, then the segment target", () => {
    expect(
      marginFor(
        mid,
        budget({
          actual_revenue: 1000,
          actual_cost_to_serve: 400,
          plan_revenue: 1000,
          plan_cost_to_serve: 100,
        }),
      ),
    ).toEqual({ pct: 60, source: "real" });
    expect(marginFor(mid, budget({ plan_revenue: 1000, plan_cost_to_serve: 300 }))).toEqual({
      pct: 70,
      source: "plan",
    });
    expect(marginFor(mid, undefined)).toEqual({ pct: 80, source: "objetivo" });
  });

  it("plan CAC = planned acquisition / planned new customers; plan payback uses the plan margin", () => {
    const [r] = segmentBudget(
      [mid],
      [won()],
      [
        budget({
          plan_revenue: 1000,
          plan_cost_to_serve: 500,
          plan_acquisition: 100000,
          plan_new_customers: 10,
        }),
      ],
      [],
      2026,
    );
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
    const [r] = segmentBudget(
      [mid],
      deals,
      [budget({ actual_revenue: 100000, actual_cost_to_serve: 40000 })],
      costs,
      2026,
    );
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
    const segs = withBudgetMargin(
      [mid],
      [budget({ actual_revenue: 1000, actual_cost_to_serve: 600 })],
      2026,
    );
    const [after] = segmentCoverage(segs, [won()], {}, range, costs);
    expect(before.payback.real).toBeCloseTo(7.5);
    expect(after.payback.real).toBeCloseTo(15);
    expect(after.payback.ok).toBe(false);
  });

  // SDD-20261109 D15: paybackByQuarter takes the budget rows and runs the one margin chain itself (no segmentsFor).
  it("quarterly payback uses each quarter's year budget", () => {
    const costs = [{ segment_id: "mid", channel: "Eventos", amount: 10000, period: "2026-Q2" }];
    const rows: QuarterBudgetLike[] = [
      {
        segment_id: "mid",
        period: "2026-Q1",
        plan_revenue: null,
        plan_cost_to_serve: null,
        plan_acquisition: null,
        plan_new_customers: null,
        actual_revenue: 1000,
        actual_cost_to_serve: 500,
      },
    ];
    const [r] = paybackByQuarter([mid], [won()], costs, ["2026-Q2"], quarterRange, rows);
    // 10 000 / (20 000 × 50% / 12) = 12
    expect(r.byQuarter["2026-Q2"].payback).toBeCloseTo(12);
  });
});

describe("quarterly budget", () => {
  const q = (period: string, o: Partial<QuarterBudgetLike> = {}): QuarterBudgetLike => ({
    segment_id: "mid",
    period,
    plan_revenue: null,
    plan_cost_to_serve: null,
    plan_acquisition: null,
    plan_new_customers: null,
    actual_revenue: null,
    actual_cost_to_serve: null,
    ...o,
  });

  it("the year is the sum of its quarters; a field nobody filled stays empty", () => {
    const [y] = annualFromQuarters(
      [
        q("2026-Q1", { plan_revenue: 100, plan_new_customers: 2 }),
        q("2026-Q2", { plan_revenue: 150, plan_new_customers: 3 }),
        q("2025-Q4", { plan_revenue: 999 }),
      ],
      2026,
    );
    expect(y.plan_revenue).toBe(250);
    expect(y.plan_new_customers).toBe(5);
    expect(y.actual_revenue).toBeNull();
  });

  it("each quarter compares its own plan with its own costs and deals won", () => {
    const rows = [
      q("2026-Q2", { plan_acquisition: 10000, plan_new_customers: 2 }),
      q("2026-Q3", { plan_acquisition: 5000, plan_new_customers: 1 }),
    ];
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
    const rows = [
      q("2026-Q1", { actual_revenue: 1000, actual_cost_to_serve: 500 }),
      q("2026-Q2", { plan_revenue: 1000, plan_cost_to_serve: 100 }),
    ];
    expect(withPeriodMargin([mid], rows, "2026-Q1")[0].gross_margin_pct).toBe(50);
    // Q2 only has a plan (90%), but the year already has a real margin (50%)
    expect(withPeriodMargin([mid], rows, "2026-Q2")[0]).toMatchObject({
      gross_margin_pct: 50,
      margin_source: "real",
    });
    expect(withPeriodMargin([mid], [], "2026-Q2")[0]).toMatchObject({
      gross_margin_pct: 80,
      margin_source: "objetivo",
    });
  });

  it("deviation is green when revenue goes up and red when costs go up", () => {
    expect(deviation(110, 100)).toEqual({ value: 10, good: true });
    expect(deviation(110, 100, { lowerIsBetter: true })).toEqual({ value: 10, good: false });
    expect(deviation(9, 12, { lowerIsBetter: true })).toEqual({ value: -25, good: true });
    expect(deviation(55, 60, { points: true })).toEqual({ value: -5, good: false });
    expect(deviation(null, 100)).toBeNull();
  });
});

describe("annual margin", () => {
  it("only quarters with both revenue and cost count, so a quarter without cost yet does not inflate it", () => {
    const base = {
      segment_id: "mid",
      plan_revenue: null,
      plan_cost_to_serve: null,
      plan_acquisition: null,
      plan_new_customers: null,
      actual_revenue: null,
      actual_cost_to_serve: null,
    };
    const [y] = annualFromQuarters(
      [
        { ...base, period: "2026-Q3", actual_revenue: 110000, actual_cost_to_serve: 40000 },
        { ...base, period: "2026-Q4", actual_revenue: 90000 },
      ],
      2026,
    );
    expect(y.actual_revenue).toBe(200000);
    expect(y.actual_margin).toBeCloseTo(63.64, 1);
    expect(marginFor(mid, y).pct).toBeCloseTo(63.64, 1);
  });
});

// SDD-20261106-metrics-honest-data U-3 · CA-5 to CA-8: new top-level fields of each budget row (segmentBudget and quarterlyBudget).
describe("budget row labels (CA-5 to CA-8)", () => {
  const seg = (o: Partial<SegLike> & { id: string }): SegLike => ({
    name: o.id,
    acv_min: null,
    acv_max: null,
    win_rate_target: null,
    cac_target: null,
    gross_margin_pct: null,
    payback_months: null,
    ...o,
  });
  const dl = (o: Partial<DealLike>): DealLike => ({
    segment_id: null,
    amount: null,
    stage: "discovery",
    close_date: null,
    closed_at: null,
    updated_at: "2026-05-10",
    created_at: "2026-03-01",
    ...o,
  });
  const qb = (
    o: Partial<QuarterBudgetLike> & { segment_id: string; period: string },
  ): QuarterBudgetLike => ({
    plan_revenue: null,
    plan_cost_to_serve: null,
    plan_acquisition: null,
    plan_new_customers: null,
    actual_revenue: null,
    actual_cost_to_serve: null,
    ...o,
  });

  it("CA-5 / CA-6: wonInPeriod, inferredWonInPeriod, acvSource and acvRangeBasis of the period", () => {
    const a = seg({ id: "a", acv_min: 0, acv_max: 10000 });
    const deals = [
      dl({ segment_id: "a", amount: 5000, stage: "won", closed_at: "2026-05-10" }),
      dl({ amount: 4000, stage: "won", closed_at: "2026-08-10" }),
      dl({ segment_id: "borrado", amount: 3000, stage: "won", closed_at: "2026-11-10" }),
      dl({ amount: 3000, stage: "won", closed_at: "2025-11-10" }),
    ];
    const [y] = segmentBudget([a], deals, [], [], 2026);
    expect(y).toMatchObject({
      wonInPeriod: 3,
      inferredWonInPeriod: 2,
      acvSource: "ganados",
      acvRangeBasis: null,
    });
    expect(y.wonInPeriod).toBe(y.actual.newCustomers);
    expect(y).not.toHaveProperty("wonInQuarter");
    const q = quarterlyBudget([a], deals, [], [], 2026);
    expect(q.byQuarter["2026-Q3"][0]).toMatchObject({ wonInPeriod: 1, inferredWonInPeriod: 1 });
    expect(q.byQuarter["2026-Q1"][0]).toMatchObject({ wonInPeriod: 0, inferredWonInPeriod: 0 });
    const [r] = segmentBudget([seg({ id: "r", acv_min: 1000, acv_max: 3000 })], [], [], [], 2026);
    expect(r).toMatchObject({ acvSource: "rango", acvRangeBasis: "punto_medio" });
    const [s] = segmentBudget([seg({ id: "s" })], [], [], [], 2026);
    expect(s).toMatchObject({ acvSource: "rango", acvRangeBasis: "sin_rango" });
  });

  it("CA-7 payback figures { plan, actual }", () => {
    const deal = (id: string) =>
      dl({ segment_id: id, amount: 12000, stage: "won", closed_at: "2026-05-10" });
    const costs = ["falta", "neg", "dato"].map((id) => ({
      segment_id: id,
      channel: "Eventos",
      amount: 6000,
      period: "2026-Q2",
    }));
    const rows = [
      qb({ segment_id: "falta", period: "2026-Q2", plan_acquisition: 3000, plan_new_customers: 1 }),
      qb({
        segment_id: "neg",
        period: "2026-Q2",
        plan_acquisition: 3000,
        plan_new_customers: 1,
        plan_revenue: 100,
        plan_cost_to_serve: 150,
        actual_revenue: 100,
        actual_cost_to_serve: 120,
      }),
      qb({
        segment_id: "dato",
        period: "2026-Q2",
        plan_acquisition: 3000,
        plan_new_customers: 1,
        plan_revenue: 100,
        plan_cost_to_serve: 50,
      }),
    ];
    const segs = [
      seg({ id: "falta", acv_min: 0 }),
      seg({ id: "neg", acv_min: 0 }),
      seg({ id: "dato", acv_min: 0, gross_margin_pct: 40 }),
      seg({ id: "vacio", acv_min: 0 }),
    ];
    const q2 = quarterlyBudget(segs, ["falta", "neg", "dato"].map(deal), rows, costs, 2026)
      .byQuarter["2026-Q2"];
    const by = Object.fromEntries(q2.map((r) => [r.segment.id, r]));
    // SDD-20261109 D1, D2: paybackMarginBasis gives way to the payback Figures; no margin and margin ≤ 0 give none.
    expect(by.falta.figures.payback.reason).toBe("falta margen");
    expect(by.falta.figures.planPayback.reason).toBe("falta margen");
    expect(by.falta.actual.payback).toBeNull();
    expect(by.neg.figures.payback.reason).toBe("margen 0 % o negativo");
    expect(by.neg.figures.planPayback.reason).toBe("margen 0 % o negativo");
    expect(by.neg.actual.payback).toBeNull();
    expect(by.dato.figures.payback.state).toBe("real");
    expect(by.dato.figures.planPayback.state).toBe("plan");
    expect(by.vacio.figures.payback.reason).toBe("sin costes en 2026-Q2");
    expect(by.vacio.figures.planPayback.reason).toBe("sin plan de captación en 2026-Q2");
    expect(Object.keys(by.dato.payback).sort()).toEqual(["planOk", "realOk", "target"]);
  });

  it("CA-8 sharedSplit of the period", () => {
    const segs = [seg({ id: "a", acv_min: 0, acv_max: 10000 }), seg({ id: "b", acv_min: 10001 })];
    const costs = [
      { segment_id: null, channel: "Paid media", amount: 1000, period: "2026-Q1" },
      { segment_id: null, channel: "Paid media", amount: 800, period: "2026-Q2" },
    ];
    const q = quarterlyBudget(
      segs,
      [dl({ segment_id: "a", amount: 500, stage: "won", closed_at: "2026-02-10" })],
      [],
      costs,
      2026,
    );
    expect(q.byQuarter["2026-Q1"].map((r) => r.sharedSplit)).toEqual(["clientes", "clientes"]);
    // SDD-20261109 D7: nobody won in Q2 → the shared cost is not split.
    expect(q.byQuarter["2026-Q2"].map((r) => r.sharedSplit)).toEqual([
      "sin_reparto",
      "sin_reparto",
    ]);
    expect(q.byQuarter["2026-Q3"].map((r) => r.sharedSplit)).toEqual([null, null]);
    expect(q.year.map((r) => r.sharedSplit)).toEqual(["clientes", "clientes"]);
  });
});

// SDD-20261109-metrics-strategy-no-estimates · U-2 · CA-5, D15: Presupuesto vs real and the KPI use the one margin
// chain (with the won deals with lines), never a 100 % margin, and a margin ≤ 0 gives no payback and no colour.
describe("NK-0094 CA-5: periodBudget without assumptions", () => {
  const q = (period: string, o: Partial<QuarterBudgetLike> = {}): QuarterBudgetLike => ({
    segment_id: "mid",
    period,
    plan_revenue: null,
    plan_cost_to_serve: null,
    plan_acquisition: null,
    plan_new_customers: null,
    actual_revenue: null,
    actual_cost_to_serve: null,
    ...o,
  });
  const noMargin: SegLike = { ...mid, gross_margin_pct: null };
  const costs = [{ segment_id: "mid", channel: "Eventos", amount: 10000, period: "2026-Q2" }];

  it("D15: the real payback uses the margin of the won deals with lines when the budget has no real one", () => {
    const deal = { ...won(), gross_margin: 5000 };
    const r = quarterlyBudget([noMargin], [deal], [], costs, 2026).byQuarter["2026-Q2"][0];
    expect(r.figures.margin).toMatchObject({ value: 25, source: "deals" });
    expect(r.margin).toEqual({ pct: 25, source: "deals" });
    // 10 000 / (20 000 × 25 % / 12) = 24
    expect(r.actual.payback).toBeCloseTo(24);
  });
  it("D1: nothing in the chain → no real payback and no planned payback (never 100 %)", () => {
    const rows = [q("2026-Q2", { plan_acquisition: 6000, plan_new_customers: 3 })];
    const r = quarterlyBudget([noMargin], [won()], rows, costs, 2026).byQuarter["2026-Q2"][0];
    expect(r.actual.payback).toBeNull();
    expect(r.plan.payback).toBeNull();
    expect(r.figures.payback).toEqual({ value: null, state: "sin_dato", reason: "falta margen" });
    expect(r.figures.planPayback).toEqual({
      value: null,
      state: "sin_dato",
      reason: "falta margen",
    });
    expect(r.payback).toMatchObject({ planOk: null, realOk: null });
  });
  it("D2: margin ≤ 0 → no payback, planOk and realOk null", () => {
    const rows = [
      q("2026-Q2", {
        plan_revenue: 100,
        plan_cost_to_serve: 120,
        plan_acquisition: 6000,
        plan_new_customers: 3,
        actual_revenue: 100,
        actual_cost_to_serve: 130,
      }),
    ];
    const r = quarterlyBudget([mid], [won()], rows, costs, 2026).byQuarter["2026-Q2"][0];
    expect(r.actual.payback).toBeNull();
    expect(r.plan.payback).toBeNull();
    expect(r.payback).toMatchObject({ planOk: null, realOk: null });
    expect(r.figures.payback.reason).toBe("margen 0 % o negativo");
  });
  it("D3: minimum without maximum → no ACV behind the paybacks", () => {
    const open = { ...mid, acv_max: null };
    const r = quarterlyBudget([open], [{ ...won(), amount: null }], [], costs, 2026).byQuarter[
      "2026-Q2"
    ][0];
    expect(r.acv).toBeNull();
    expect(r.figures.payback.reason).toBe("falta el máximo del rango de ACV");
  });
  it("D7: shared cost with nobody won is not split; the plan CAC has its own «plan» state", () => {
    const shared = [{ segment_id: null, channel: "Paid media", amount: 4000, period: "2026-Q3" }];
    const rows = [q("2026-Q3", { plan_acquisition: 6000, plan_new_customers: 3 })];
    const r = quarterlyBudget([mid], [], rows, shared, 2026).byQuarter["2026-Q3"][0];
    expect(r.actual.acquisition).toBe(0);
    expect(r.sharedSplit).toBe("sin_reparto");
    expect(r.figures.planCac).toEqual({ value: 2000, state: "plan", reason: null });
  });
});
