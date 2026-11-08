import { describe, expect, it } from "vitest";
import { costByChannel, previousQuarter, segmentCac } from "./cac";
import { segmentCoverage, type DealLike, type SegLike } from "./segment-coverage";
import { sharedSplitBasis } from "./cac";

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

describe("calculator real CAC (last 4 quarters)", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  it("uses costs of the current and previous 3 quarters and deals won since then", async () => {
    const { trailingCac, lastQuarters } = await import("./pipeline-real");
    expect(lastQuarters(now)).toEqual(["2026-Q4", "2026-Q3", "2026-Q2", "2026-Q1"]);
    const costs = [
      { segment_id: "mid", channel: "Eventos", amount: 20000, period: "2026-Q1" },
      { segment_id: "mid", channel: "Eventos", amount: 20000, period: "2026-Q4" },
      { segment_id: "mid", channel: "Eventos", amount: 99999, period: "2025-Q4" },
    ];
    const deals = [won({ closed_at: "2026-02-10" }), won({ closed_at: "2026-10-20" }), won({ closed_at: "2025-12-01" })];
    const r = trailingCac([mid], deals, costs, now);
    expect(r.mid.cost).toBe(40000);
    expect(r.mid.customers).toBe(2);
    expect(r.mid.cac).toBe(20000);
  });
});

describe("channel × quarter table", () => {
  it("lists the selected quarter and the 3 before it, oldest first", async () => {
    const { quartersUpTo } = await import("./cac");
    expect(quartersUpTo("2026-Q2")).toEqual(["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"]);
  });
  it("adds every segment per channel and quarter and keeps shared costs apart", async () => {
    const { channelQuarterTable } = await import("./cac");
    const t = channelQuarterTable([
      { segment_id: "a", channel: "Eventos", amount: 1000, period: "2026-Q1" },
      { segment_id: null, channel: "Eventos", amount: 500, period: "2026-Q1" },
      { segment_id: null, channel: "Herramientas", amount: 300, period: "2026-Q2" },
      { segment_id: "a", channel: "Eventos", amount: 9999, period: "2025-Q1" },
    ], ["2026-Q1", "2026-Q2"]);
    expect(t.rows[0]).toEqual({ channel: "Eventos", byQuarter: { "2026-Q1": 1500, "2026-Q2": 0 }, total: 1500 });
    expect(t.shared).toEqual({ "2026-Q1": 500, "2026-Q2": 300 });
    expect(t.total).toEqual({ "2026-Q1": 1500, "2026-Q2": 300 });
  });
});

describe("real payback by quarter", () => {
  it("each quarter uses only its own costs and deals won, compared with the target payback", async () => {
    const { paybackByQuarter } = await import("./segment-coverage");
    const { quarterRange } = await import("./metrics");
    const costs = [
      { segment_id: "mid", channel: "Eventos", amount: 30000, period: "2026-Q3" },
      { segment_id: "mid", channel: "Eventos", amount: 60000, period: "2026-Q4" },
    ];
    const deals = [won({ closed_at: "2026-08-10" }), won({ closed_at: "2026-08-20" }), won({ closed_at: "2026-10-20" })];
    const [row] = paybackByQuarter([mid], deals, costs, ["2026-Q2", "2026-Q3", "2026-Q4"], quarterRange);
    // ACV 20.000 × 80% / 12 = 1.333,33 per month
    expect(row.byQuarter["2026-Q3"].payback).toBeCloseTo(11.25);
    expect(row.byQuarter["2026-Q3"].ok).toBe(true);
    expect(row.byQuarter["2026-Q4"].payback).toBeCloseTo(45);
    expect(row.byQuarter["2026-Q4"].ok).toBe(false);
    expect(row.byQuarter["2026-Q2"].status).toBe("no_costs");
    expect(row.target).toBe(12);
  });
  it("costs without deals won give no real payback (never the target CAC)", async () => {
    const { paybackByQuarter } = await import("./segment-coverage");
    const { quarterRange } = await import("./metrics");
    const [row] = paybackByQuarter([mid], [], [{ segment_id: "mid", channel: "Eventos", amount: 5000, period: "2026-Q4" }], ["2026-Q4"], quarterRange);
    expect(row.byQuarter["2026-Q4"]).toMatchObject({ payback: null, status: "no_wins" });
  });
});

// SDD-20261106-metrics-honest-data U-3 · CA-8: how the shared cost was split, with the rule of segmentCac.
describe("sharedSplitBasis (CA-8)", () => {
  const shared = [{ segment_id: null, channel: "Paid media", amount: 9000 }];
  it("by customers when someone was won", () => {
    expect(sharedSplitBasis(shared, { a: 1, b: 0 }, ["a", "b"])).toBe("clientes");
  });
  it("equally when nobody was won, and segmentCac indeed splits it equally", () => {
    expect(sharedSplitBasis(shared, { a: 0, b: 0 }, ["a", "b"])).toBe("partes_iguales");
    expect(sharedSplitBasis(shared, {}, ["a", "b"])).toBe("partes_iguales");
    const r = segmentCac(shared, {}, ["a", "b"]);
    expect(r.a.shared).toBe(4500);
  });
  it("null without shared cost or without segments", () => {
    expect(sharedSplitBasis([{ segment_id: "a", channel: "Eventos", amount: 100 }], {}, ["a"])).toBeNull();
    expect(sharedSplitBasis([{ segment_id: null, channel: "Eventos", amount: 0 }], {}, ["a"])).toBeNull();
    expect(sharedSplitBasis(shared, {}, [])).toBeNull();
  });
});
