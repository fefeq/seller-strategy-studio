// From gtm-lab@44f385b packages/core/src/ice.test.ts
import { describe, expect, it } from "vitest";
import { iceScore, rankBacklog } from "./index";

describe("iceScore (CA-5)", () => {
  it("is the mean of impact, confidence and ease", () => {
    expect(iceScore({ impact: 5, confidence: 7, ease: 8 })).toBeCloseTo(6.667, 3);
    expect(iceScore({ impact: 10, confidence: 10, ease: 10 })).toBe(10);
  });

  it("rejects values outside 1-10", () => {
    expect(() => iceScore({ impact: 0, confidence: 5, ease: 5 })).toThrow(/impact/);
    expect(() => iceScore({ impact: 5, confidence: 11, ease: 5 })).toThrow(/confidence/);
    expect(() => iceScore({ impact: 5, confidence: 5, ease: 5.5 })).toThrow(/ease/);
    expect(() => iceScore({ impact: 1, confidence: 1, ease: 1 })).not.toThrow();
  });
});

describe("rankBacklog (CA-5)", () => {
  it("orders by score desc and breaks ties by creation date asc", () => {
    const items = [
      { id: "low", impact: 2, confidence: 2, ease: 2, createdAt: "2026-01-01" },
      { id: "tie-late", impact: 8, confidence: 8, ease: 8, createdAt: "2026-03-01" },
      { id: "top", impact: 10, confidence: 9, ease: 10, createdAt: "2026-04-01" },
      { id: "tie-early", impact: 8, confidence: 8, ease: 8, createdAt: "2026-02-01" },
    ];
    expect(rankBacklog(items).map((i) => i.id)).toEqual(["top", "tie-early", "tie-late", "low"]);
  });

  it("compares creation dates as instants, not as text", () => {
    const items = [
      { id: "later", impact: 5, confidence: 5, ease: 5, createdAt: "2026-01-01T09:30:00Z" },
      { id: "earlier", impact: 5, confidence: 5, ease: 5, createdAt: "2026-01-01T10:00:00+02:00" },
    ];
    expect(rankBacklog(items).map((i) => i.id)).toEqual(["earlier", "later"]);
  });
});
