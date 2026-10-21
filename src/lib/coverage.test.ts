import { describe, expect, it } from "vitest";
import { formatRatio, quarterCoverage } from "./coverage";

// The Postin V2 case: quota 9.500, one deal dated in Q4 for 468 and two imported deals without a close date.
const deals = [
  { stage: "discovery", amount: 468, close_date: "2026-11-15" },
  { stage: "discovery", amount: 500, close_date: null },
  { stage: "discovery", amount: 457, close_date: null },
  { stage: "won", amount: 9999, close_date: "2026-11-01" },
  { stage: "proposal", amount: 1000, close_date: "2027-01-10" },
];

describe("quarterCoverage", () => {
  it("counts only open deals closing in the quarter and reports undated ones apart", () => {
    const c = quarterCoverage(deals, 9500, "2026-Q4");
    expect(c.pipeline).toBe(468);
    expect(c.ratio).toBeCloseTo(0.0493, 3);
    expect(c.status).toBe("low");
    expect(c.undated).toEqual({ count: 2, amount: 957 });
    expect(c.totalOpen).toBe(2425);
    expect(c.gapTo3x).toBe(9500 * 3 - 468);
  });
  it("with no quota the ratio is 0 and nothing is missing", () => {
    const c = quarterCoverage(deals, 0, "2026-Q4");
    expect(c.ratio).toBe(0);
    expect(c.gapTo3x).toBe(0);
  });
});

describe("formatRatio", () => {
  it("never rounds a real coverage to 0,0x", () => {
    expect(formatRatio(0.0493)).toBe("0,05x");
    expect(formatRatio(0)).toBe("0,0x");
    expect(formatRatio(2.44)).toBe("2,4x");
  });
});
