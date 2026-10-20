import { describe, expect, it } from "vitest";
import { paybackByQuarter, paybackSummary, segmentAcv, segmentCoverage, type DealLike, type SegLike } from "./segment-coverage";
import { quarterRange } from "./metrics";

const range = { start: new Date("2026-10-01"), end: new Date("2027-01-01") };
const mid: SegLike = { id: "mid", name: "Mid-market", acv_min: 5000, acv_max: 50000, win_rate_target: 25, cac_target: 10000, gross_margin_pct: 80, payback_months: 12 };
const ent: SegLike = { id: "ent", name: "Enterprise", acv_min: 50000, acv_max: 250000, win_rate_target: 20, cac_target: null, gross_margin_pct: 80, payback_months: 18 };
const d = (o: Partial<DealLike>): DealLike => ({ segment_id: null, amount: 20000, stage: "discovery", close_date: "2026-11-15", closed_at: null, updated_at: "2026-10-10", created_at: "2026-10-05", ...o });

describe("segment coverage", () => {
  it("coverage = open pipeline closing in the quarter / segment target; 3–4x is healthy", () => {
    const deals = [d({ amount: 100000, segment_id: "mid" }), d({ amount: 50000, segment_id: "mid" }), d({ amount: 30000, segment_id: "mid", close_date: "2027-02-01" })];
    const [row] = segmentCoverage([mid], deals, { mid: 50000 }, range);
    expect(row.pipeline).toBe(150000);
    expect(row.coverage?.ratio).toBe(3);
    expect(row.coverage?.status).toBe("healthy");
  });
  it("deals target = target / ACV and opportunities target = deals / win rate", () => {
    const deals = [d({ amount: 20000, stage: "won", segment_id: "mid", closed_at: "2026-10-20" })];
    const [row] = segmentCoverage([mid], deals, { mid: 100000 }, range);
    expect(row.acv).toBe(20000);
    expect(row.won.target).toBe(5);
    expect(row.opps.target).toBe(20);
    expect(row.won.attainment).toBeCloseTo(0.2);
  });
  it("payback = CAC / (ACV × margin / 12) compared with the segment target", () => {
    const deals = [d({ amount: 20000, stage: "won", segment_id: "mid", closed_at: "2026-10-20" })];
    const [row] = segmentCoverage([mid], deals, {}, range);
    expect(row.payback.real).toBeCloseTo(7.5);
    expect(row.payback.ok).toBe(true);
    expect(row.coverage).toBeNull();
  });
  it("deals without segment are assigned by ACV range", () => {
    const [m, e] = segmentCoverage([mid, ent], [d({ amount: 120000 })], { ent: 100000 }, range);
    expect(m.pipeline).toBe(0);
    expect(e.pipeline).toBe(120000);
  });
  it("ACV falls back to the range midpoint without deals", () => {
    expect(segmentAcv(mid, []).acv).toBe(27500);
  });
});

describe("payback summary for the dashboard", () => {
  it("takes each segment's latest quarter with real payback, its trend, and counts segments within target", () => {
    const deals = [
      d({ amount: 20000, stage: "won", segment_id: "mid", closed_at: "2026-05-10" }),
      d({ amount: 20000, stage: "won", segment_id: "mid", closed_at: "2026-08-10" }),
      d({ amount: 100000, stage: "won", segment_id: "ent", closed_at: "2026-08-10" }),
    ];
    const costs = [
      { segment_id: "mid", channel: "Eventos", amount: 10000, period: "2026-Q2" },
      { segment_id: "mid", channel: "Eventos", amount: 20000, period: "2026-Q3" },
      { segment_id: "ent", channel: "Eventos", amount: 200000, period: "2026-Q3" },
    ];
    const qs = ["2026-Q2", "2026-Q3", "2026-Q4"];
    const s = paybackSummary(paybackByQuarter([mid, ent], deals, costs, qs, quarterRange), qs);
    const [m, e] = s.latest;
    // Mid Q3: 20 000 / (20 000 × 80% / 12) = 15 m (target 12), Q2 was 7.5 m
    expect(m.quarter).toBe("2026-Q3");
    expect(m.cell?.payback).toBeCloseTo(15);
    expect(m.trend).toBeCloseTo(7.5);
    // Ent Q3: 200 000 / (100 000 × 80% / 12) = 30 m (target 18)
    expect(e.cell?.ok).toBe(false);
    expect([s.within, s.measured]).toEqual([0, 2]);
  });
});
