import { describe, expect, it } from "vitest";
import { quarterKpis } from "./quarter-kpis";
import type { DealLike, SegLike } from "./segment-coverage";
import type { QuarterBudgetLike } from "./segment-budget";

const smb: SegLike = {
  id: "smb",
  name: "SMB",
  acv_min: 0,
  acv_max: 5000,
  win_rate_target: null,
  cac_target: null,
  gross_margin_pct: 80,
  payback_months: 6,
};
const mid: SegLike = {
  id: "mid",
  name: "Mid",
  acv_min: 5000,
  acv_max: 50000,
  win_rate_target: null,
  cac_target: null,
  gross_margin_pct: 80,
  payback_months: 12,
};
const segs = [smb, mid];
const won = (amount: number, closed_at: string, segment_id: string): DealLike => ({
  segment_id,
  amount,
  stage: "won",
  close_date: null,
  closed_at,
  updated_at: closed_at,
  created_at: "2026-01-01",
});
const budget = (
  segment_id: string,
  period: string,
  o: Partial<QuarterBudgetLike>,
): QuarterBudgetLike => ({
  segment_id,
  period,
  plan_revenue: null,
  plan_cost_to_serve: null,
  plan_acquisition: null,
  plan_new_customers: null,
  actual_revenue: null,
  actual_cost_to_serve: null,
  ...o,
});

describe("quarterKpis", () => {
  const deals = [
    won(4000, "2026-10-05T12:00:00Z", "smb"),
    won(4000, "2026-10-06T12:00:00Z", "smb"),
    won(20000, "2026-11-01T12:00:00Z", "mid"),
  ];
  const rows = [
    budget("smb", "2026-Q4", {
      plan_revenue: 10000,
      plan_cost_to_serve: 2000,
      plan_acquisition: 3000,
      plan_new_customers: 3,
      actual_revenue: 12000,
      actual_cost_to_serve: 3000,
    }),
    budget("mid", "2026-Q4", {
      plan_revenue: 30000,
      plan_cost_to_serve: 6000,
      plan_acquisition: 12000,
      plan_new_customers: 1,
      actual_revenue: 18000,
    }),
  ];
  const costs = [
    { segment_id: "smb", channel: "Paid media", amount: 2000, period: "2026-Q4" },
    { segment_id: "mid", channel: "Eventos", amount: 9000, period: "2026-Q4" },
  ];
  const [k] = quarterKpis(segs, deals, rows, costs, ["2026-Q4"]);

  it("adds revenue and cost to serve across segments", () => {
    expect(k.plan.revenue).toBe(40000);
    expect(k.actual.revenue).toBe(30000);
    expect(k.actual.costToServe).toBe(3000);
  });
  it("computes margin only over segments with revenue and cost", () => {
    expect(k.plan.margin).toBeCloseTo(80);
    expect(k.actual.margin).toBeCloseTo(75); // only SMB has a real cost: (12000 − 3000) / 12000
  });
  it("real CAC = entered costs / deals won in the quarter", () => {
    expect(k.actual.acquisition).toBe(11000);
    expect(k.actual.newCustomers).toBe(3);
    expect(k.actual.cac).toBeCloseTo(11000 / 3);
    expect(k.actual.wonAmount).toBe(28000);
  });
  it("plan CAC = planned acquisition / planned customers", () =>
    expect(k.plan.cac).toBe(15000 / 4));
  it("payback is the customer-weighted average of segment paybacks", () => {
    expect(k.actual.payback).not.toBeNull();
    expect(k.plan.payback).not.toBeNull();
  });
  it("no costs means no real CAC, not a CAC of 0", () => {
    const [empty] = quarterKpis(segs, deals, rows, [], ["2026-Q4"]);
    expect(empty.actual.acquisition).toBeNull();
    expect(empty.actual.cac).toBeNull();
    expect(empty.actual.payback).toBeNull();
  });
  it("covers quarters of two years and leaves empty ones null", () => {
    const out = quarterKpis(segs, deals, rows, costs, ["2025-Q4", "2026-Q4"]);
    expect(out.map((x) => x.quarter)).toEqual(["2025-Q4", "2026-Q4"]);
    expect(out[0].actual.revenue).toBeNull();
    expect(out[0].actual.newCustomers).toBe(0);
    expect(out[1].actual.revenue).toBe(30000);
  });
});

// SDD-20261106-metrics-honest-data U-3 · CA-7: paybackBasis over the segments that enter the weighted payback.
describe("quarterKpis paybackBasis (CA-7)", () => {
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
  const cost = (segment_id: string, period = "2026-Q2") => ({
    segment_id,
    channel: "Eventos",
    amount: 6000,
    period,
  });
  const plan = (segment_id: string) =>
    budget(segment_id, "2026-Q2", { plan_acquisition: 3000, plan_new_customers: 1 });

  it("dato when every weighted segment has a real margin and a real ACV", () => {
    const s = seg({ id: "a", acv_min: 0, gross_margin_pct: 50 });
    const [k] = quarterKpis(
      [s],
      [won(12000, "2026-05-10", "a")],
      [plan("a")],
      [cost("a")],
      ["2026-Q2"],
    );
    expect(k.paybackBasis).toEqual({ plan: "dato", actual: "dato" });
  });
  it("estimado when a weighted segment assumes the margin (100 %)", () => {
    const s = seg({ id: "a", acv_min: 0 });
    const [k] = quarterKpis(
      [s],
      [won(12000, "2026-05-10", "a")],
      [plan("a")],
      [cost("a")],
      ["2026-Q2"],
    );
    expect(k.paybackBasis).toEqual({ plan: "estimado", actual: "estimado" });
  });
  it("estimado when a weighted segment takes its ACV from the range (plan side)", () => {
    const s = seg({ id: "a", acv_min: 10000, acv_max: 14000, gross_margin_pct: 50 });
    const [k] = quarterKpis([s], [], [plan("a")], [], ["2026-Q2"]);
    expect(k.paybackBasis.plan).toBe("estimado");
    expect(k.paybackBasis.actual).toBeNull();
  });
  it("estimado when a weighted segment takes its ACV from open deals (gate pass 3, note 1)", () => {
    const s = seg({ id: "a", acv_min: 0, gross_margin_pct: 50 });
    const open: DealLike = {
      segment_id: "a",
      amount: 12000,
      stage: "demo",
      close_date: "2026-06-30",
      closed_at: null,
      updated_at: "2026-05-01",
      created_at: "2026-04-01",
    };
    const [k] = quarterKpis([s], [open], [plan("a")], [], ["2026-Q2"]);
    expect(k.paybackBasis.plan).toBe("estimado");
  });
  it("sin_dato when a weighted segment has margin 0 % or negative, even if the weighted value looks fine", () => {
    const good = seg({ id: "a", acv_min: 0, acv_max: 50000, gross_margin_pct: 50 });
    const bad = seg({ id: "b", acv_min: 50001, gross_margin_pct: -5 });
    const deals = [won(12000, "2026-05-10", "a"), won(60000, "2026-05-11", "b")];
    const [k] = quarterKpis(
      [good, bad],
      deals,
      [plan("a"), plan("b")],
      [cost("a"), cost("b")],
      ["2026-Q2"],
    );
    expect(k.paybackBasis).toEqual({ plan: "sin_dato", actual: "sin_dato" });
  });
  it("null when no segment enters the weighted payback; a segment without customers is left out", () => {
    const s = seg({ id: "a", acv_min: 0, gross_margin_pct: -5 });
    const [k] = quarterKpis([s], [], [], [], ["2026-Q2"]);
    expect(k.paybackBasis).toEqual({ plan: null, actual: null });
  });
});
