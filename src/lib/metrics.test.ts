import { describe, expect, it } from "vitest";
import { coverage, engagementScore, forecastAccuracy, recommendMotion, registrationConflict, stageConversion, winRate } from "./metrics";

describe("recommendMotion by ACV", () => {
  it("<5K is product-led", () => expect(recommendMotion(4999)).toBe("plg"));
  it("5K–50K is inside sales", () => { expect(recommendMotion(5000)).toBe("inside"); expect(recommendMotion(49999)).toBe("inside"); });
  it("50K–250K is field sales", () => { expect(recommendMotion(50000)).toBe("field"); expect(recommendMotion(250000)).toBe("field"); });
  it(">250K is strategic", () => expect(recommendMotion(250001)).toBe("strategic"));
});

describe("pipeline coverage", () => {
  it("3x–4x is healthy", () => expect(coverage(350, 100).status).toBe("healthy"));
  it("under 3x is low", () => expect(coverage(250, 100).status).toBe("low"));
  it("over 4x is high", () => expect(coverage(450, 100).status).toBe("high"));
});

describe("forecast accuracy", () => {
  it("within 10% of commit is accurate", () => expect(forecastAccuracy(100, 91).accurate).toBe(true));
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
  expect(engagementScore([{ channel: "event", occurred_at: "2026-05-20" }, { channel: "event", occurred_at: "2026-01-01" }], now)).toBe(5);
});

it("partner registration conflicts with another partner's active registration on the same account", () => {
  const regs = [{ account_name: "Acme", status: "approved", expires_at: null, partner_id: "p1" }];
  expect(registrationConflict(" acme ", regs, "p2")).toBeTruthy();
  expect(registrationConflict("acme", regs, "p1")).toBeFalsy();
});
