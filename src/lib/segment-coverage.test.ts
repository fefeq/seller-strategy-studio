import { describe, expect, it } from "vitest";
import {
  paybackByQuarter,
  paybackSummary,
  segmentAcv,
  segmentCoverage,
  type DealLike,
  type SegLike,
} from "./segment-coverage";
import { quarterRange } from "./metrics";

const range = { start: new Date("2026-10-01"), end: new Date("2027-01-01") };
const mid: SegLike = {
  id: "mid",
  name: "Mid-market",
  acv_min: 5000,
  acv_max: 50000,
  win_rate_target: 25,
  cac_target: 10000,
  gross_margin_pct: 80,
  payback_months: 12,
};
const ent: SegLike = {
  id: "ent",
  name: "Enterprise",
  acv_min: 50000,
  acv_max: 250000,
  win_rate_target: 20,
  cac_target: null,
  gross_margin_pct: 80,
  payback_months: 18,
};
const d = (o: Partial<DealLike>): DealLike => ({
  segment_id: null,
  amount: 20000,
  stage: "discovery",
  close_date: "2026-11-15",
  closed_at: null,
  updated_at: "2026-10-10",
  created_at: "2026-10-05",
  ...o,
});

describe("segment coverage", () => {
  it("coverage = open pipeline closing in the quarter / segment target; 3–4x is healthy", () => {
    const deals = [
      d({ amount: 100000, segment_id: "mid" }),
      d({ amount: 50000, segment_id: "mid" }),
      d({ amount: 30000, segment_id: "mid", close_date: "2027-02-01" }),
    ];
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
  // SDD-20261109 D9: the payback needs the real CAC (cost 10 000 / 1 won), no longer the target CAC (also 10 000).
  it("payback = CAC / (ACV × margin / 12) compared with the segment target", () => {
    const deals = [d({ amount: 20000, stage: "won", segment_id: "mid", closed_at: "2026-10-20" })];
    const [row] = segmentCoverage([mid], deals, {}, range, [
      { segment_id: "mid", channel: "Eventos", amount: 10000 },
    ]);
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

// SDD-20261106-metrics-honest-data U-3 · CA-5, CA-6, CA-7, CA-8: new top-level fields of each coverage row.
describe("coverage row labels (CA-5 to CA-8)", () => {
  const q4 = { start: new Date("2026-10-01"), end: new Date("2027-01-01") };
  const seg = (o: Partial<SegLike> & { id: string }): SegLike => ({
    name: o.id,
    acv_min: null,
    acv_max: null,
    win_rate_target: null,
    cac_target: null,
    gross_margin_pct: null,
    payback_months: null,
    ...o,
  });
  const dl = (o: Partial<DealLike>): DealLike => ({
    segment_id: null,
    amount: null,
    stage: "discovery",
    close_date: null,
    closed_at: null,
    updated_at: "2026-10-10",
    created_at: "2026-10-05",
    ...o,
  });

  // SDD-20261109 D3, D4: minimum without maximum and no range give no ACV (null), never minimum × 1.5 or 0.
  it("segmentAcv.rangeBasis separates the range cases; null for ganados / abiertos", () => {
    expect(segmentAcv(seg({ id: "a", acv_min: 1000, acv_max: 3000 }), [])).toEqual({
      acv: 2000,
      source: "rango",
      rangeBasis: "punto_medio",
      figure: {
        value: 2000,
        state: "estimado",
        reason: "punto medio del rango",
        source: "rango",
        sample: 0,
      },
    });
    expect(segmentAcv(seg({ id: "a", acv_min: 1000 }), [])).toEqual({
      acv: null,
      source: "rango",
      rangeBasis: "sin_maximo",
      figure: {
        value: null,
        state: "sin_dato",
        reason: "falta el máximo del rango de ACV",
        source: null,
        sample: 0,
      },
    });
    expect(segmentAcv(seg({ id: "a" }), [])).toEqual({
      acv: null,
      source: "rango",
      rangeBasis: "sin_rango",
      figure: {
        value: null,
        state: "sin_dato",
        reason: "falta rango de ACV",
        source: null,
        sample: 0,
      },
    });
    // decided by the fields, not by the resulting ACV (gate pass 3, note 5)
    expect(segmentAcv(seg({ id: "a", acv_min: 0 }), [])).toEqual({
      acv: null,
      source: "rango",
      rangeBasis: "sin_maximo",
      figure: {
        value: null,
        state: "sin_dato",
        reason: "falta el máximo del rango de ACV",
        source: null,
        sample: 0,
      },
    });
    expect(segmentAcv(seg({ id: "a", acv_max: 4000 }), [])).toEqual({
      acv: 2000,
      source: "rango",
      rangeBasis: "punto_medio",
      figure: {
        value: 2000,
        state: "estimado",
        reason: "punto medio del rango",
        source: "rango",
        sample: 0,
      },
    });
    expect(segmentAcv(seg({ id: "a" }), [dl({ amount: 500, stage: "won" })]).rangeBasis).toBeNull();
    expect(segmentAcv(seg({ id: "a" }), [dl({ amount: 500 })]).rangeBasis).toBeNull();
  });

  it("CA-5 assignedDeals (M), inferredDeals (N), wonInQuarter and inferredWon", () => {
    const a = seg({ id: "a", acv_min: 0, acv_max: 10000 });
    const deals = [
      dl({ segment_id: "a", amount: 5000, stage: "won", closed_at: "2026-10-20" }),
      dl({ amount: 4000, stage: "won", closed_at: "2026-11-20" }), // no segment → by amount
      dl({ segment_id: "borrado", amount: 3000, stage: "lost", closed_at: "2026-11-21" }), // deleted segment → by amount
      dl({ amount: 2000, stage: "won", closed_at: "2026-02-01" }), // by amount, won outside the quarter
      dl({ segment_id: "a", amount: 1000 }),
    ];
    const [r] = segmentCoverage([a], deals, {}, q4);
    expect(r).toMatchObject({
      assignedDeals: 5,
      inferredDeals: 3,
      wonInQuarter: 2,
      inferredWon: 1,
    });
    expect(r.wonInQuarter).toBe(r.won.deals);
  });

  // SDD-20261109 D3: a minimum without maximum gives no ACV.
  it("CA-6 acvSource and acvRangeBasis on the row", () => {
    const [r] = segmentCoverage([seg({ id: "a", acv_min: 20000 })], [], {}, q4);
    expect(r).toMatchObject({ acvSource: "rango", acvRangeBasis: "sin_maximo", acv: null });
    const [w] = segmentCoverage(
      [seg({ id: "a", acv_min: 0, acv_max: 9000 })],
      [dl({ segment_id: "a", amount: 5000, stage: "won", closed_at: "2026-10-20" })],
      {},
      q4,
    );
    expect(w).toMatchObject({ acvSource: "ganados", acvRangeBasis: null });
  });

  // SDD-20261109 D1, D2, D9: paybackMarginBasis is replaced by the payback Figure (state and reason); a missing
  // margin or a margin ≤ 0 gives no payback, and `payback.source` is gone.
  it("CA-7 payback figure: real, falta margen, margen 0 % o negativo, no CAC", () => {
    const won = (id: string) =>
      dl({ segment_id: id, amount: 12000, stage: "won", closed_at: "2026-10-20" });
    const costs = ["dato", "falta", "cero", "neg", "nada"].map((id) => ({
      segment_id: id,
      channel: "Eventos",
      amount: 6000,
    }));
    const segs = [
      seg({ id: "dato", acv_min: 0, gross_margin_pct: 50 }),
      seg({ id: "falta", acv_min: 0 }),
      seg({ id: "cero", acv_min: 0, gross_margin_pct: 0 }),
      seg({ id: "neg", acv_min: 0, gross_margin_pct: -20 }),
      seg({ id: "nada", acv_min: 0, gross_margin_pct: 50 }),
    ];
    const rows = segmentCoverage(segs, ["dato", "falta", "cero", "neg"].map(won), {}, q4, costs);
    const by = Object.fromEntries(rows.map((r) => [r.segment.id, r]));
    expect(by.dato.figures.payback.state).toBe("real");
    expect(by.falta.figures.payback.reason).toBe("falta margen");
    expect(by.falta.payback.real).toBeNull();
    expect(by.cero.figures.payback.reason).toBe("margen 0 % o negativo");
    expect(by.cero.payback.real).toBeNull();
    expect(by.neg.figures.payback.reason).toBe("margen 0 % o negativo");
    expect(by.nada.payback.real).toBeNull();
    expect(by.nada.figures.payback.reason).toBe("ningún deal ganado en 2026-Q4");
    expect(Object.keys(by.dato.payback).sort()).toEqual([
      "ok",
      "real",
      "reason",
      "state",
      "target",
    ]);
  });

  it("CA-8 sharedSplit on every row", () => {
    const segs = [seg({ id: "a", acv_min: 0, acv_max: 10000 }), seg({ id: "b", acv_min: 10001 })];
    const shared = [{ segment_id: null, channel: "Paid media", amount: 1000 }];
    // SDD-20261109 D7: nobody won → the shared cost is not split.
    expect(segmentCoverage(segs, [], {}, q4, shared).map((r) => r.sharedSplit)).toEqual([
      "sin_reparto",
      "sin_reparto",
    ]);
    const wonA = [dl({ segment_id: "a", amount: 500, stage: "won", closed_at: "2026-10-20" })];
    expect(segmentCoverage(segs, wonA, {}, q4, shared).map((r) => r.sharedSplit)).toEqual([
      "clientes",
      "clientes",
    ]);
    expect(segmentCoverage(segs, wonA, {}, q4, []).map((r) => r.sharedSplit)).toEqual([null, null]);
  });
});

// SDD-20261109-metrics-strategy-no-estimates · U-2 · CA-5: an assumption never becomes a number (D1-D9).
describe("NK-0094 CA-5: segmentCoverage and paybackByQuarter without assumptions", () => {
  const q4 = { start: new Date("2026-10-01"), end: new Date("2027-01-01") };
  const s = (o: Partial<SegLike> & { id: string }): SegLike => ({
    name: o.id,
    acv_min: null,
    acv_max: null,
    win_rate_target: null,
    cac_target: null,
    gross_margin_pct: null,
    payback_months: 12,
    ...o,
  });
  const wonIn = (id: string, amount: number | null = 12000) => ({
    segment_id: id,
    amount,
    stage: "won",
    close_date: null,
    closed_at: "2026-10-20",
    updated_at: "2026-10-20",
    created_at: "2026-10-05",
  });
  const cost = (id: string | null, amount = 6000) => ({
    segment_id: id,
    channel: "Eventos",
    amount,
  });
  const rowOf = (seg: SegLike, deals: DealLike[], costs = [cost(seg.id)]) =>
    segmentCoverage([seg], deals, { [seg.id]: 60000 }, q4, costs)[0];

  it("D1: no margin anywhere → payback null, «Sin dato · falta margen», never 100 %", () => {
    const r = rowOf(s({ id: "a", acv_min: 0, acv_max: 20000 }), [wonIn("a")]);
    expect(r.payback.real).toBeNull();
    expect(r.figures.payback).toEqual({ value: null, state: "sin_dato", reason: "falta margen" });
    expect(r.payback.ok).toBeNull();
  });
  it("D2: margin 0 or negative → payback null, «margen 0 % o negativo», ok null (never green or red)", () => {
    for (const m of [0, -20]) {
      const r = rowOf(s({ id: "a", acv_min: 0, acv_max: 20000, gross_margin_pct: m }), [
        wonIn("a"),
      ]);
      expect(r.payback).toMatchObject({ real: null, ok: null });
      expect(r.figures.payback.reason).toBe("margen 0 % o negativo");
    }
  });
  it("D3: minimum without maximum → no ACV, no deals or opportunities target, payback says why", () => {
    const r = rowOf(s({ id: "a", acv_min: 20000, gross_margin_pct: 50, win_rate_target: 25 }), [
      wonIn("a", null),
    ]);
    expect(r.acv).toBeNull();
    expect(r.figures.acv).toMatchObject({
      state: "sin_dato",
      reason: "falta el máximo del rango de ACV",
    });
    expect(r.won.target).toBeNull();
    expect(r.opps.target).toBeNull();
    expect(r.figures.payback).toEqual({
      value: null,
      state: "sin_dato",
      reason: "falta el máximo del rango de ACV",
    });
  });
  it("D4: no range and no deals → ACV null (not 0), «falta rango de ACV»", () => {
    const r = rowOf(s({ id: "a" }), []);
    expect(r.acv).toBeNull();
    expect(r.figures.acv).toMatchObject({ state: "sin_dato", reason: "falta rango de ACV" });
  });
  it("D5 / D6: midpoint and open deals stay as «Estimado» with their reason", () => {
    expect(rowOf(s({ id: "a", acv_min: 1000, acv_max: 3000 }), []).figures.acv).toMatchObject({
      value: 2000,
      state: "estimado",
      reason: "punto medio del rango",
    });
    const open = { ...wonIn("a", 8000), stage: "demo", closed_at: null };
    expect(rowOf(s({ id: "a" }), [open]).figures.acv).toMatchObject({
      value: 8000,
      state: "estimado",
      reason: "media de deals abiertos",
    });
  });
  it("D7: shared cost with nobody won is not split: shared 0 per segment, «sin_reparto»", () => {
    const segs = [s({ id: "a", acv_min: 0, acv_max: 100 }), s({ id: "b", acv_min: 101 })];
    const rows = segmentCoverage(segs, [], {}, q4, [cost(null, 1000)]);
    expect(rows.map((r) => r.cac.shared)).toEqual([0, 0]);
    expect(rows.map((r) => r.sharedSplit)).toEqual(["sin_reparto", "sin_reparto"]);
    expect(rows[0].figures.cac).toEqual({
      value: null,
      state: "sin_dato",
      reason: "ningún deal ganado en 2026-Q4",
    });
  });
  it("D9: without a real CAC there is no payback (never with the target CAC) and no `source`", () => {
    const r = rowOf(
      s({ id: "a", acv_min: 0, acv_max: 20000, gross_margin_pct: 80, cac_target: 3000 }),
      [wonIn("a")],
      [],
    );
    expect(r.payback.real).toBeNull();
    expect(r.figures.payback).toEqual({
      value: null,
      state: "sin_dato",
      reason: "sin costes en 2026-Q4",
    });
    expect(r.payback).not.toHaveProperty("source");
  });
  it("D8: paybackByQuarter carries the deals assigned by amount, like Cobertura", () => {
    const a = s({ id: "a", acv_min: 0, acv_max: 20000, gross_margin_pct: 50 });
    const deals = [wonIn("a"), { ...wonIn("a"), segment_id: null }];
    const [r] = paybackByQuarter(
      [a],
      deals,
      [{ ...cost("a"), period: "2026-Q4" }],
      ["2026-Q4"],
      quarterRange,
    );
    expect(r.byQuarter["2026-Q4"]).toMatchObject({ wonInQuarter: 2, inferredWon: 1 });
    expect(r.byQuarter["2026-Q4"].figures.payback).toMatchObject({ state: "real" });
  });
  it("the margin comes from the budget rows and the won deals with lines (one chain, D15)", () => {
    const a = s({ id: "a", acv_min: 0, acv_max: 20000, gross_margin_pct: 80 });
    const withLines = { ...wonIn("a"), gross_margin: 6000 };
    const r = segmentCoverage([a], [withLines], {}, q4, [cost("a")], [])[0];
    expect(r.figures.margin).toMatchObject({ value: 50, source: "deals" });
    expect(r.figures.payback.value).toBeCloseTo(12);
  });
});
