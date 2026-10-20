import { describe, expect, it } from "vitest";
import { costByChannel, previousQuarter, segmentCac } from "./cac";
import { segmentCoverage, type DealLike, type SegLike } from "./segment-coverage";

const range = { start: new Date("2026-10-01"), end: new Date("2027-01-01") };
const mid: SegLike = { id: "mid", name: "Mid-market", acv_min: 5000, acv_max: 50000, win_rate_target: 25, cac_target: 10000, gross_margin_pct: 80, payback_months: 12 };
const won = (o: Partial<DealLike> = {}): DealLike => ({ segment_id: "mid", amount: 20000, stage: "won", close_date: "2026-11-15", closed_at: "2026-10-20", updated_at: "2026-10-20", created_at: "2026-10-05", ...o });

describe("real CAC", () => {
  it("CAC = costs of the segment / deals won in the quarter", () => {
    const r = segmentCac([{ segment_id: "mid", channel: "Eventos", amount: 20000 }, { segment_id: "mid", channel: "Paid media", amount: 10000 }], { mid: 2 }, ["mid"]);
    expect(r.mid.cost).toBe(30000);
    expect(r.mid.cac).toBe(15000);
  });
  it("shared costs are split by each segment's share of deals won", () => {
    const r = segmentCac([{ segment_id: null, channel: "Herramientas", amount: 9000 }], { a: 1, b: 2 }, ["a", "b"]);
    expect(r.a.shared).toBe(3000);
    expect(r.b.shared).toBe(6000);
  });
  it("with no deals won, shared costs split equally and there is no real CAC", () => {
    const r = segmentCac([{ segment_id: null, channel: "Otros", amount: 1000 }], {}, ["a", "b"]);
    expect(r.a.shared).toBe(500);
    expect(r.a.cac).toBeNull();
  });
  it("payback uses the real CAC: 30.000 cost, 2 deals of 20.000, 80% margin → 11,25 months", () => {
    const [row] = segmentCoverage([mid], [won(), won()], {}, range, [{ segment_id: "mid", channel: "Eventos", amount: 30000 }]);
    expect(row.cac.real).toBe(15000);
    expect(row.payback.source).toBe("real");
    expect(row.payback.real).toBeCloseTo(11.25);
    expect(row.payback.ok).toBe(true);
  });
  it("without costs, payback falls back to the target CAC", () => {
    const [row] = segmentCoverage([mid], [won()], {}, range, []);
    expect(row.payback.source).toBe("objetivo");
    expect(row.payback.real).toBeCloseTo(7.5);
  });
  it("deals won outside the quarter do not count as customers", () => {
    const [row] = segmentCoverage([mid], [won({ closed_at: "2026-09-20" })], {}, range, [{ segment_id: "mid", channel: "Eventos", amount: 30000 }]);
    expect(row.cac.customers).toBe(0);
    expect(row.cac.real).toBeNull();
  });
  it("cost by channel adds every segment and sorts largest first", () => {
    const r = costByChannel([{ segment_id: "a", channel: "Eventos", amount: 1000 }, { segment_id: null, channel: "Eventos", amount: 1000 }, { segment_id: "a", channel: "SEO", amount: 500 }]);
    expect(r[0]).toEqual({ channel: "Eventos", amount: 2000, share: 0.8 });
  });
  it("previous quarter wraps the year", () => {
    expect(previousQuarter("2026-Q1")).toBe("2025-Q4");
    expect(previousQuarter("2026-Q3")).toBe("2026-Q2");
  });
});
