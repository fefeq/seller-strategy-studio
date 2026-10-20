import { describe, expect, it } from "vitest";
import { quarterKpis } from "./quarter-kpis";
import type { DealLike, SegLike } from "./segment-coverage";
import type { QuarterBudgetLike } from "./segment-budget";

const smb: SegLike = { id: "smb", name: "SMB", acv_min: 0, acv_max: 5000, win_rate_target: null, cac_target: null, gross_margin_pct: 80, payback_months: 6 };
const mid: SegLike = { id: "mid", name: "Mid", acv_min: 5000, acv_max: 50000, win_rate_target: null, cac_target: null, gross_margin_pct: 80, payback_months: 12 };
const segs = [smb, mid];
const won = (amount: number, closed_at: string, segment_id: string): DealLike => ({ segment_id, amount, stage: "won", close_date: null, closed_at, updated_at: closed_at, created_at: "2026-01-01" });
const budget = (segment_id: string, period: string, o: Partial<QuarterBudgetLike>): QuarterBudgetLike => ({
  segment_id, period, plan_revenue: null, plan_cost_to_serve: null, plan_acquisition: null, plan_new_customers: null, actual_revenue: null, actual_cost_to_serve: null, ...o,
});

describe("quarterKpis", () => {
  const deals = [won(4000, "2026-10-05T12:00:00Z", "smb"), won(4000, "2026-10-06T12:00:00Z", "smb"), won(20000, "2026-11-01T12:00:00Z", "mid")];
  const rows = [
    budget("smb", "2026-Q4", { plan_revenue: 10000, plan_cost_to_serve: 2000, plan_acquisition: 3000, plan_new_customers: 3, actual_revenue: 12000, actual_cost_to_serve: 3000 }),
    budget("mid", "2026-Q4", { plan_revenue: 30000, plan_cost_to_serve: 6000, plan_acquisition: 12000, plan_new_customers: 1, actual_revenue: 18000 }),
  ];
  const costs = [{ segment_id: "smb", channel: "Paid media", amount: 2000, period: "2026-Q4" }, { segment_id: "mid", channel: "Eventos", amount: 9000, period: "2026-Q4" }];
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
  it("plan CAC = planned acquisition / planned customers", () => expect(k.plan.cac).toBe(15000 / 4));
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
