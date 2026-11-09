import { describe, expect, it } from "vitest";
import {
  capacityPlan,
  coverage,
  engagementScore,
  forecastAccuracy,
  matchSegment,
  recommendMotion,
  registrationConflict,
  stageConversion,
  winRate,
} from "./metrics";

describe("recommendMotion by ACV", () => {
  it("<5K is product-led", () => expect(recommendMotion(4999)).toBe("plg"));
  it("5K–50K is inside sales", () => {
    expect(recommendMotion(5000)).toBe("inside");
    expect(recommendMotion(49999)).toBe("inside");
  });
  it("50K–250K is field sales", () => {
    expect(recommendMotion(50000)).toBe("field");
    expect(recommendMotion(250000)).toBe("field");
  });
  it(">250K is strategic", () => expect(recommendMotion(250001)).toBe("strategic"));
});

describe("pipeline coverage", () => {
  it("3x–4x is healthy", () => expect(coverage(350, 100).status).toBe("healthy"));
  it("under 3x is low", () => expect(coverage(250, 100).status).toBe("low"));
  it("over 4x is high", () => expect(coverage(450, 100).status).toBe("high"));
});

describe("forecast accuracy", () => {
  it("within 10% of commit is accurate", () =>
    expect(forecastAccuracy(100, 91).accurate).toBe(true));
  it("off by more than 10% is not", () => expect(forecastAccuracy(100, 85).accurate).toBe(false));
});

it("win rate = won / (won + lost)", () => expect(winRate(3, 1)).toBe(0.75));

it("stage conversion counts deals reaching the next stage", () => {
  const h = [
    { deal_id: "a", from_stage: null, to_stage: "discovery", changed_at: "2026-01-01" },
    { deal_id: "a", from_stage: "discovery", to_stage: "qualified", changed_at: "2026-01-05" },
    { deal_id: "b", from_stage: null, to_stage: "discovery", changed_at: "2026-01-01" },
  ];
  expect(stageConversion(h, ["discovery", "qualified", "demo"])[0].rate).toBe(0.5);
});

it("engagement ignores touches older than 90 days", () => {
  const now = new Date("2026-06-01");
  expect(
    engagementScore(
      [
        { channel: "event", occurred_at: "2026-05-20" },
        { channel: "event", occurred_at: "2026-01-01" },
      ],
      now,
    ),
  ).toBe(5);
});

it("partner registration conflicts with another partner's active registration on the same account", () => {
  const regs = [{ account_name: "Acme", status: "approved", expires_at: null, partner_id: "p1" }];
  expect(registrationConflict(" acme ", regs, "p2")).toBeTruthy();
  expect(registrationConflict("acme", regs, "p1")).toBeFalsy();
});

describe("segment matching for the strategy calculator", () => {
  const segs = [
    { name: "SMB", acv_min: 0, acv_max: 5000 },
    { name: "Mid", acv_min: 5000, acv_max: 50000 },
    { name: "Ent", acv_min: 50000, acv_max: null },
  ];
  it("finds the segment whose range contains the ACV", () =>
    expect(matchSegment(20000, segs)?.name).toBe("Mid"));
  it("on a shared boundary the upper segment wins", () =>
    expect(matchSegment(5000, segs)?.name).toBe("Mid"));
  it("an empty max has no upper limit", () =>
    expect(matchSegment(9_000_000, segs)?.name).toBe("Ent"));
  it("returns nothing when no segment covers the ACV", () =>
    expect(matchSegment(60000, segs.slice(0, 2))).toBeUndefined());
});

describe("capacity plan per AE", () => {
  it("deals per year = quota / ACV", () =>
    expect(capacityPlan({ acv: 20000, quota: 600000 }).dealsPerYear).toBe(30));
  it("opportunities = deals / win rate", () => {
    const p = capacityPlan({ acv: 20000, quota: 600000, winRatePct: 25 });
    expect(p.oppsPerYear).toBe(120);
    expect(p.oppsPerMonth).toBe(10);
  });
  it("payback = CAC / monthly gross-margin revenue", () =>
    expect(capacityPlan({ acv: 20000, cac: 10000, grossMarginPct: 80 }).paybackMonths).toBe(7.5));
  it("missing benchmarks give no figure", () =>
    expect(capacityPlan({ acv: 20000 }).oppsPerYear).toBeNull());
});

// SDD-20261106-metrics-honest-data U-3 · CA-7: capacityPlan says when the margin was assumed (100 %) or is not positive.
describe("capacityPlan margin flags (CA-7)", () => {
  // SDD-20261109-metrics-strategy-no-estimates D1: a missing margin no longer gives a payback at 100 %.
  it("missing margin: marginAssumed, and no payback (never 100 %)", () => {
    const r = capacityPlan({ acv: 12000, cac: 6000, grossMarginPct: null });
    expect(r.paybackMonths).toBeNull();
    expect(r.marginAssumed).toBe(true);
    expect(r.marginNonPositive).toBe(false);
    expect(capacityPlan({ acv: 12000, cac: 6000 }).marginAssumed).toBe(true);
  });
  // SDD-20261109-metrics-strategy-no-estimates D2: margin 0 or negative gives no payback (never Infinity or < 0).
  it("margin 0 and negative: marginNonPositive; no payback (null, never Infinity nor negative)", () => {
    const zero = capacityPlan({ acv: 12000, cac: 6000, grossMarginPct: 0 });
    expect(zero.paybackMonths).toBeNull();
    expect(zero).toMatchObject({ marginAssumed: false, marginNonPositive: true });
    const neg = capacityPlan({ acv: 12000, cac: 6000, grossMarginPct: -10 });
    expect(neg.paybackMonths).toBeNull();
    expect(neg).toMatchObject({ marginAssumed: false, marginNonPositive: true });
  });
  it("a real positive margin is neither assumed nor non-positive", () => {
    expect(capacityPlan({ acv: 12000, cac: 6000, grossMarginPct: 50 })).toMatchObject({
      paybackMonths: 12,
      marginAssumed: false,
      marginNonPositive: false,
    });
  });
});
