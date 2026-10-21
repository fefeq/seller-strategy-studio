import { describe, expect, it } from "vitest";
import { checkAcvRange, checkSegmentField } from "./segment-fields";

describe("checkSegmentField", () => {
  it("keeps 0 as a real value and empty as null", () => {
    expect(checkSegmentField("win_rate_target", "0")).toEqual({ ok: true, value: 0 });
    expect(checkSegmentField("ae_quota", "0")).toEqual({ ok: true, value: 0 });
    expect(checkSegmentField("win_rate_target", "")).toEqual({ ok: true, value: null });
    expect(checkSegmentField("win_rate_target", "  ")).toEqual({ ok: true, value: null });
  });
  it("accepts a decimal comma", () =>
    expect(checkSegmentField("gross_margin_pct", "97,5")).toEqual({ ok: true, value: 97.5 }));
  it("refuses a margin over 100 and names the field and segment", () => {
    const r = checkSegmentField("gross_margin_pct", "978397", "Agencias");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Margen bruto %");
      expect(r.error).toContain("Agencias");
      expect(r.error).toContain("entre 0 y 100");
    }
  });
  it("refuses negatives and decimals where an integer is expected", () => {
    expect(checkSegmentField("cac_target", "-5").ok).toBe(false);
    expect(checkSegmentField("cycle_days", "30.5").ok).toBe(false);
    expect(checkSegmentField("payback_months", "6")).toEqual({ ok: true, value: 6 });
  });
  it("refuses text", () => expect(checkSegmentField("ae_quota", "abc").ok).toBe(false));
});

describe("checkAcvRange", () => {
  it("flags min above max only when both are known", () => {
    expect(checkAcvRange(6000, 1000, "B2B")).toContain("B2B");
    expect(checkAcvRange(1000, 6000)).toBeNull();
    expect(checkAcvRange(6000, 6000)).toBeNull();
    expect(checkAcvRange(6000, null)).toBeNull();
  });
});
