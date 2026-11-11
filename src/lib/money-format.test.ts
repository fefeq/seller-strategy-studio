// NK-0133 CA-2: pct1 is the shared percentage with one decimal and the es-ES comma.
import { describe, expect, it } from "vitest";
import { pct1 } from "@/lib/money";

describe("pct1", () => {
  it("uses the decimal comma and at most one decimal", () => {
    expect(pct1(1 / 3)).toBe("33,3%");
    expect(pct1(0.5)).toBe("50%");
    expect(pct1(1)).toBe("100%");
    expect(pct1(0)).toBe("0%");
    expect(pct1(0.0449)).toBe("4,5%");
  });
});
