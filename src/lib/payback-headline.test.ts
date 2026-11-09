// SDD-20261109-metrics-strategy-no-estimates · CA-7 (walkthrough fix NK-0094): the Inicio payback headline is a pure
// rule over the same summary as its table, and months are written the es-ES way. Fictional data.
import { describe, expect, it } from "vitest";
import { paybackHeadline } from "@/lib/segment-coverage";
import { fmtMonths } from "@/lib/unit-economics";

describe("paybackHeadline (CA-7)", () => {
  it("counts segments within their target when some have payback and target", () => {
    expect(paybackHeadline({ measured: 2, within: 1, withPayback: 3 }, 3)).toEqual({
      kind: "within",
      within: 1,
      measured: 2,
    });
  });
  it("with paybacks but no target it never says there is no payback", () => {
    expect(paybackHeadline({ measured: 0, within: 0, withPayback: 2 }, 2)).toEqual({
      kind: "no_target",
      withPayback: 2,
    });
  });
  it("says «none» only when no segment has a payback, and «no_segments» without segments", () => {
    expect(paybackHeadline({ measured: 0, within: 0, withPayback: 0 }, 2).kind).toBe("none");
    expect(paybackHeadline({ measured: 0, within: 0, withPayback: 0 }, 0).kind).toBe("no_segments");
  });
});

describe("fmtMonths", () => {
  it("uses the comma and at most one decimal", () => {
    expect(fmtMonths(1.84)).toBe("1,8");
    expect(fmtMonths(2.4)).toBe("2,4");
    expect(fmtMonths(3)).toBe("3");
  });
});
