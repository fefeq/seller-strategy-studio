import { describe, expect, it } from "vitest";
import {
  checkLineField,
  dealTotals,
  lineFromProduct,
  lineRevenue,
  productMarginPct,
  wonDealsMargin,
  type DealLine,
} from "./deal-lines";
import { withPeriodMargin } from "./segment-budget";
import type { SegLike } from "./segment-coverage";

const monthly: DealLine = {
  name: "Plan Pro",
  quantity: 3,
  unit_price: 49,
  unit_cost: 9,
  discount_pct: 10,
  billing: "monthly",
};
const setup: DealLine = {
  name: "Puesta en marcha",
  quantity: 1,
  unit_price: "500",
  unit_cost: "200",
  discount_pct: 0,
  billing: "one_off",
};

describe("deal lines", () => {
  it("a monthly line counts twelve times and the discount applies to the price", () => {
    expect(lineRevenue(monthly)).toBeCloseTo(3 * 49 * 0.9 * 12);
  });
  it("totals ACV and margin like the database trigger; one-off lines stay out of both", () => {
    const t = dealTotals([monthly, setup]);
    expect(t.amount).toBe(1587.6);
    expect(t.oneOff).toBe(500);
    expect(t.cost).toBe(324); // 3 × 9 × 12
    expect(t.margin).toBe(1263.6);
    expect(Math.round(t.marginPct!)).toBe(80);
  });
  it("a recurring line without cost leaves the margin unknown; a one-off without cost doesn't", () => {
    const t = dealTotals([{ ...monthly, unit_cost: null }, setup]);
    expect(t.margin).toBeNull();
    expect(t.unknownCost).toBe(1);
    expect(dealTotals([monthly, { ...setup, unit_cost: null }]).margin).toBe(1263.6);
    expect(dealTotals([setup])).toMatchObject({ amount: 0, oneOff: 500, margin: null });
    expect(dealTotals([]).amount).toBe(0);
  });
  it("copies price, cost and billing from the product", () => {
    const l = lineFromProduct(
      { id: "p", name: "Plan", price: "49", cost: null, billing: "monthly", active: true },
      2,
    );
    expect(l).toEqual({
      product_id: "p",
      name: "Plan",
      quantity: 2,
      unit_price: 49,
      unit_cost: null,
      discount_pct: 0,
      billing: "monthly",
    });
    expect(
      productMarginPct({
        id: "p",
        name: "Plan",
        price: 50,
        cost: 10,
        billing: "annual",
        active: true,
      }),
    ).toBe(80);
    expect(
      productMarginPct({
        id: "p",
        name: "Plan",
        price: 50,
        cost: null,
        billing: "annual",
        active: true,
      }),
    ).toBeNull();
  });
  it("validates what the person types", () => {
    expect(checkLineField("unit_price", "49,5")).toEqual({ ok: true, value: 49.5 });
    expect(checkLineField("unit_cost", "")).toEqual({ ok: true, value: null });
    expect(checkLineField("quantity", "0")).toMatchObject({ ok: false });
    expect(checkLineField("discount_pct", "120")).toMatchObject({ ok: false });
    expect(checkLineField("unit_price", "")).toMatchObject({ ok: false });
    expect(checkLineField("price", "-1")).toMatchObject({ ok: false });
  });
});

describe("margin of won deals", () => {
  const deals = [
    {
      stage: "won",
      amount: 1000,
      gross_margin: 800,
      segment_id: "a",
      closed_at: "2026-08-01T00:00:00Z",
    },
    {
      stage: "won",
      amount: 3000,
      gross_margin: 1500,
      segment_id: "a",
      closed_at: "2026-09-01T00:00:00Z",
    },
    {
      stage: "won",
      amount: 2000,
      gross_margin: null,
      segment_id: "a",
      closed_at: "2026-09-01T00:00:00Z",
    },
    { stage: "proposal", amount: 9000, gross_margin: 9000, segment_id: "a", closed_at: null },
    {
      stage: "won",
      amount: 1000,
      gross_margin: 900,
      segment_id: "b",
      closed_at: "2026-12-15T00:00:00Z",
    },
  ];
  it("weights by amount and ignores open deals and deals without margin", () => {
    const m = wonDealsMargin(deals, new Date("2027-01-01"));
    expect(m.bySegment.a.deals).toBe(2);
    expect(m.bySegment.a.pct).toBeCloseTo(57.5);
    expect(m.all!.deals).toBe(3);
  });
  it("only counts deals closed in the 12 months before the period ends", () => {
    expect(wonDealsMargin(deals, new Date("2026-10-01")).bySegment.b).toBeUndefined();
    expect(wonDealsMargin(deals, new Date("2027-09-02")).bySegment.a).toBeUndefined();
  });
  it("places a deal without segment by its amount, like CAC and coverage", () => {
    const segs = [
      {
        id: "smb",
        name: "SMB",
        acv_min: 0,
        acv_max: 5000,
        win_rate_target: null,
        cac_target: null,
        gross_margin_pct: null,
        payback_months: null,
      },
      {
        id: "mid",
        name: "Mid",
        acv_min: 5000,
        acv_max: null,
        win_rate_target: null,
        cac_target: null,
        gross_margin_pct: null,
        payback_months: null,
      },
    ] as SegLike[];
    const m = wonDealsMargin(
      [
        {
          stage: "won",
          amount: 3000,
          gross_margin: 1500,
          segment_id: null,
          closed_at: "2026-09-01T00:00:00Z",
        },
      ],
      new Date("2026-10-01"),
      segs,
    );
    expect(m.bySegment.smb).toEqual({ pct: 50, deals: 1 });
  });
  it("comes after the budget's real margin and before plan and target", () => {
    const segs = [
      {
        id: "a",
        name: "A",
        acv_min: 0,
        acv_max: null,
        win_rate_target: null,
        cac_target: null,
        gross_margin_pct: 90,
        payback_months: null,
      },
      {
        id: "b",
        name: "B",
        acv_min: 0,
        acv_max: null,
        win_rate_target: null,
        cac_target: null,
        gross_margin_pct: 90,
        payback_months: null,
      },
    ] as SegLike[];
    const rows = [
      { segment_id: "b", period: "2026-Q3", actual_revenue: 100, actual_cost_to_serve: 40 },
    ] as never[];
    const out = withPeriodMargin(segs, rows, "2026-Q3", { a: { pct: 57.5 }, b: { pct: 10 } });
    expect(out[0]).toMatchObject({
      gross_margin_pct: 57.5,
      margin_source: "deals",
      margin_target: 90,
    });
    expect(out[1]).toMatchObject({ gross_margin_pct: 60, margin_source: "real" });
    expect(withPeriodMargin(segs, [], "2026-Q3")[0]).toMatchObject({
      gross_margin_pct: 90,
      margin_source: "objetivo",
    });
  });
});
