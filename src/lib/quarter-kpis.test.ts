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
// SDD-20261109-metrics-strategy-no-estimates (D1, D2, D5, D6, §15.8): NK-0068's paybackBasis gives way to the
// company payback Figures (k of m); the same six cases, read from the Figures.
describe("quarterKpis payback figures (was paybackBasis, CA-7)", () => {
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

  it("real (plan: «plan») when every weighted segment has a real margin and a real ACV", () => {
    const s = seg({ id: "a", acv_min: 0, gross_margin_pct: 50 });
    const [k] = quarterKpis(
      [s],
      [won(12000, "2026-05-10", "a")],
      [plan("a")],
      [cost("a")],
      ["2026-Q2"],
    );
    expect(k.figures.payback).toMatchObject({ state: "real", reason: null, k: 1, m: 1 });
    expect(k.figures.planPayback).toMatchObject({ state: "plan", reason: null, k: 1, m: 1 });
  });
  it("no margin (D1): no payback at all, never a 100 % margin", () => {
    const s = seg({ id: "a", acv_min: 0 });
    const [k] = quarterKpis(
      [s],
      [won(12000, "2026-05-10", "a")],
      [plan("a")],
      [cost("a")],
      ["2026-Q2"],
    );
    expect(k.figures.payback).toMatchObject({ value: null, reason: "ningún segmento con payback" });
    expect(k.figures.planPayback).toMatchObject({
      value: null,
      reason: "ningún segmento con payback",
    });
  });
  it("the plan payback says its ACV is the range midpoint (D5)", () => {
    const s = seg({ id: "a", acv_min: 10000, acv_max: 14000, gross_margin_pct: 50 });
    const [k] = quarterKpis([s], [], [plan("a")], [], ["2026-Q2"]);
    expect(k.figures.planPayback).toMatchObject({ state: "plan", reason: "punto medio del rango" });
    expect(k.figures.payback).toMatchObject({ value: null, reason: "ningún segmento con payback" });
  });
  it("the plan payback says its ACV is the open deals' average (D6, gate pass 3, note 1)", () => {
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
    expect(k.figures.planPayback).toMatchObject({
      state: "plan",
      reason: "media de deals abiertos",
    });
  });
  it("a segment with margin 0 % or negative is left out and the figure says on how many it rests (D2, §15.8)", () => {
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
    for (const f of [k.figures.payback, k.figures.planPayback])
      expect(f).toMatchObject({
        reason: "calculado sobre 1 de 2 segmentos con clientes",
        k: 1,
        m: 2,
      });
    // only segment a: 6000 / (12000 × 50 % / 12) = 12
    expect(k.actual.payback).toBeCloseTo(12);
  });
  it("sin dato when no segment enters the weighted payback; a segment without customers is left out", () => {
    const s = seg({ id: "a", acv_min: 0, gross_margin_pct: -5 });
    const [k] = quarterKpis([s], [], [], [], ["2026-Q2"]);
    for (const f of [k.figures.payback, k.figures.planPayback])
      expect(f).toEqual({
        value: null,
        state: "sin_dato",
        reason: "ningún segmento con payback",
        k: 0,
        m: 0,
      });
  });
});

// SDD-20261109-metrics-strategy-no-estimates · U-2 · CA-5 (D7, D11) and §15.8: one company CAC and payback.
describe("NK-0094 CA-5: company CAC and payback", () => {
  const costs = [
    { segment_id: "smb", channel: "Paid media", amount: 2000, period: "2026-Q4" },
    { segment_id: null, channel: "Eventos", amount: 4000, period: "2026-Q4" },
  ];
  const noSegment: DealLike = {
    ...won(1000, "2026-11-20T12:00:00Z", "smb"),
    segment_id: null,
    amount: null,
  };
  it("D11: CAC = every cost of the quarter / every deal won in it, also without segment", () => {
    const deals = [won(4000, "2026-10-05T12:00:00Z", "smb"), noSegment];
    const [k] = quarterKpis(segs, deals, [], costs, ["2026-Q4"]);
    expect(k.actual.acquisition).toBe(6000);
    expect(k.actual.cac).toBe(3000);
    expect(k.figures.cac).toEqual({ value: 3000, state: "real", reason: null });
    expect(k.unsegmentedWon).toBe(1);
  });
  it("D7: with nobody won the unsplit shared cost still counts in the company spend", () => {
    const [k] = quarterKpis(segs, [], [], costs, ["2026-Q4"]);
    expect(k.actual.acquisition).toBe(6000);
    expect(k.figures.cac).toEqual({
      value: null,
      state: "sin_dato",
      reason: "ningún deal ganado en 2026-Q4",
    });
  });
  it("§15.8: payback over the segments with one, marked «calculado sobre k de m»", () => {
    const deals = [
      won(4000, "2026-10-05T12:00:00Z", "smb"),
      won(20000, "2026-11-01T12:00:00Z", "mid"),
    ];
    const onlySmbCost = [
      { segment_id: "smb", channel: "Paid media", amount: 2000, period: "2026-Q4" },
    ];
    const [k] = quarterKpis(segs, deals, [], onlySmbCost, ["2026-Q4"]);
    expect(k.figures.payback).toMatchObject({
      state: "estimado",
      reason: "calculado sobre 1 de 2 segmentos con clientes",
    });
    // smb: 2000 / (4000 × 80 % / 12) = 7.5
    expect(k.actual.payback).toBeCloseTo(7.5);
  });
});
