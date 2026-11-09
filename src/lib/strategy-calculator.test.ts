// SDD-20261109-metrics-strategy-no-estimates · U-4 · CA-9, CA-3 (calculator), CA-14: the Modelos de venta calculator
// as a pure function. No example ACV (D12); the mean of the ranges is «Estimado» (D13); with basis «real» the plan's
// payback row is the very same Figure as the real payback of the table, whatever ACV is typed (D14a); with basis
// «objetivo» it is a scenario marked «Estimado · con el ACV de la calculadora y el CAC objetivo» (D14b).
import { describe, expect, it } from "vitest";
import { strategyCalculator } from "@/lib/strategy-calculator";
import { acvFor, cacOf, paybackOf, segmentMargin, LAST_4_QUARTERS } from "@/lib/unit-economics";
import { assignSegment, type SegLike } from "@/lib/segment-coverage";
import { lastQuarters } from "@/lib/pipeline-real";
import { quarterRange } from "@/lib/metrics";
import {
  BUDGET_ROWS,
  CALC_ACV,
  COSTS,
  EXT_DEALS,
  NOW,
  SEGMENTS,
  seg,
} from "@/test/metrics-fixture";

const segs = SEGMENTS.map((s) => ({ ...s, ae_quota: 100000 }));
const base = {
  segments: segs,
  deals: EXT_DEALS,
  costs: COSTS,
  budgetRows: BUDGET_ROWS,
  acvManual: null as number | null,
  basis: "real" as "real" | "target",
  forced: "s-pyme",
  now: NOW,
};

describe("strategyCalculator: the ACV of the calculator (D12, D13)", () => {
  it("D12: no deals and no ranges → the ACV stays empty and deals, opportunities and payback say «falta ACV»", () => {
    const empty = seg({ id: "x", name: "X", gross_margin_pct: 50 });
    const c = strategyCalculator({ ...base, segments: [empty], deals: [], costs: [], forced: "x" });
    expect(c.acv).toEqual({ value: null, state: "sin_dato", reason: "falta ACV" });
    expect(c.deals).toMatchObject({ value: null, state: "sin_dato", reason: "falta ACV" });
    expect(c.opps).toMatchObject({ value: null, state: "sin_dato", reason: "falta ACV" });
    expect(c.planPayback).toMatchObject({ value: null, state: "sin_dato" });
    expect(JSON.stringify(c)).not.toContain("20000");
  });
  it("D13: without deals, the mean of the ranges' midpoints, «Estimado · media de los rangos de tus segmentos»", () => {
    const a = seg({ id: "a", name: "A", acv_min: 1000, acv_max: 3000 });
    const b = seg({ id: "b", name: "B", acv_min: 5000, acv_max: 7000 });
    const c = strategyCalculator({ ...base, segments: [a, b], deals: [], costs: [], forced: "" });
    expect(c.acv).toEqual({
      value: 4000,
      state: "estimado",
      reason: "media de los rangos de tus segmentos",
    });
  });
  it("a typed ACV is the calculator's ACV", () => {
    expect(strategyCalculator({ ...base, acvManual: CALC_ACV }).acv.value).toBe(CALC_ACV);
  });
});

describe("strategyCalculator: one real payback (D14a, CA-3)", () => {
  it("CA-3: with its 4-quarter window it equals paybackOf(cacOf(window), acvFor, segmentMargin of the current quarter)", () => {
    const c = strategyCalculator(base);
    const all = SEGMENTS as SegLike[];
    const pyme = all.find((s) => s.id === "s-pyme")!;
    const quarters = lastQuarters(NOW, 4);
    const start = quarterRange(quarters[3]).start.getTime();
    const won = EXT_DEALS.filter((d) => {
      const t = new Date(d.closed_at ?? d.updated_at).getTime();
      return (
        d.stage === "won" && t >= start && t <= NOW.getTime() && assignSegment(d, all) === "s-pyme"
      );
    }).length;
    const expected = paybackOf({
      cac: cacOf({ cost: c.segCac!.cost, won, period: LAST_4_QUARTERS }),
      acv: acvFor(
        pyme,
        EXT_DEALS.filter((d) => assignSegment(d, all) === "s-pyme"),
      ),
      margin: segmentMargin(pyme, {
        period: "2026-Q4",
        rows: BUDGET_ROWS,
        deals: EXT_DEALS,
        segments: all,
      }),
    });
    expect(c.paybackReal).toEqual(expected);
    expect(c.paybackReal.value).not.toBeNull();
  });
  it("D14a: with basis «real» the plan's payback row is the same Figure as the real payback, whatever ACV is typed", () => {
    const real = strategyCalculator(base);
    const typed = strategyCalculator({ ...base, acvManual: CALC_ACV });
    expect(real.planPaybackLabel).toBe("Payback real");
    expect(real.planPayback).toEqual(real.paybackReal);
    expect(typed.planPayback).toEqual(real.paybackReal);
    expect(typed.paybackReal).toEqual(real.paybackReal);
  });
  it("D14a: without an ACV of the segment both say «Sin dato · falta ACV del segmento»", () => {
    const noRange = seg({ id: "n", name: "N", gross_margin_pct: 50 });
    const c = strategyCalculator({
      ...base,
      segments: [noRange],
      deals: [{ ...EXT_DEALS[1], segment_id: "n", amount: null }],
      costs: [{ segment_id: "n", channel: "Eventos", amount: 900, period: "2026-Q4" }],
      forced: "n",
      acvManual: CALC_ACV,
    });
    const why = { value: null, state: "sin_dato", reason: "falta ACV del segmento" };
    expect(c.paybackReal).toEqual(why);
    expect(c.planPayback).toEqual(why);
  });
});

describe("strategyCalculator: the scenario with the target CAC (D14b)", () => {
  it("basis «objetivo»: «Payback estimado», «Estimado · con el ACV de la calculadora y el CAC objetivo»", () => {
    const c = strategyCalculator({ ...base, basis: "target", acvManual: CALC_ACV });
    expect(c.planPaybackLabel).toBe("Payback estimado");
    // Pyme: target CAC 3000, calculator ACV 50 000, margin 60 % → 3000 / (50000 × 60 % / 12) = 1.2
    expect(c.planPayback).toEqual({
      value: expect.closeTo(1.2, 5),
      state: "estimado",
      reason: "con el ACV de la calculadora y el CAC objetivo",
    });
  });
  it("basis «real» without a real CAC falls back to the scenario, with its mark", () => {
    const c = strategyCalculator({ ...base, costs: [], acvManual: CALC_ACV });
    expect(c.planPaybackLabel).toBe("Payback estimado");
    expect(c.planPayback.state).toBe("estimado");
    expect(c.planPayback.reason).toBe("con el ACV de la calculadora y el CAC objetivo");
  });
  it("no target CAC → the scenario says so; no margin → «falta margen», never «margen bruto 100%»", () => {
    const noTarget = seg({ id: "t", name: "T", acv_min: 0, acv_max: 9000 });
    const c = strategyCalculator({
      ...base,
      segments: [noTarget],
      forced: "t",
      basis: "target",
      acvManual: 5000,
    });
    expect(c.planPayback).toMatchObject({
      value: null,
      state: "sin_dato",
      reason: "falta CAC objetivo",
    });
    expect(c.margin).toMatchObject({ value: null, reason: "falta margen" });
    expect(c.judged).toBeNull();
  });
  it("«Dentro/Fuera del payback objetivo» only with a real or estimated figure", () => {
    const c = strategyCalculator({ ...base, basis: "target", acvManual: CALC_ACV });
    expect(c.judged).toEqual({ within: true, target: 12 });
  });
});
