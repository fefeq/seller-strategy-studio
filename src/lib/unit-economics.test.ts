// SDD-20261109-metrics-strategy-no-estimates · U-1 · CA-1, CA-5 (module level), CA-14 (constants).
// The one CAC formula, the one payback formula, the one margin chain, the one ACV rule for a payback and the one
// company aggregate. A missing input never becomes a number: it is «sin_dato» with its reason.
import { describe, expect, it } from "vitest";
import {
  LAST_4_QUARTERS,
  WIN_RATE_WINDOWS,
  acvFor,
  cacOf,
  companyCac,
  companyPayback,
  paybackOf,
  planCacOf,
  planMarginOf,
  segmentMargin,
  type Figure,
} from "@/lib/unit-economics";
import {
  BUDGET_ROWS,
  DEALS,
  EXT_DEALS,
  SEG_MIN0_NO_MAX,
  SEGMENTS,
  bq,
  deal,
  seg,
} from "@/test/metrics-fixture";
import type { SegLike } from "@/lib/segment-coverage";

const real = (value: number, reason: string | null = null): Figure => ({
  value,
  state: "real",
  reason,
});
const est = (value: number, reason: string): Figure => ({ value, state: "estimado", reason });
const none = (reason: string): Figure => ({ value: null, state: "sin_dato", reason });

describe("cacOf / companyCac (CA-1)", () => {
  it("CAC = cost / won, «real»", () => {
    expect(cacOf({ cost: 9000, won: 3, period: "2026-Q3" })).toEqual(real(3000));
  });
  it("no cost (null or 0) → «Sin dato · sin costes en {periodo}», also with nothing won", () => {
    expect(cacOf({ cost: null, won: 2, period: "2026-Q3" })).toEqual(none("sin costes en 2026-Q3"));
    expect(cacOf({ cost: 0, won: 0, period: "2026-Q3" })).toEqual(none("sin costes en 2026-Q3"));
  });
  it("costs and 0 won → «Sin dato · ningún deal ganado en {periodo}»", () => {
    expect(cacOf({ cost: 500, won: 0, period: LAST_4_QUARTERS })).toEqual(
      none("ningún deal ganado en los últimos 4 trimestres"),
    );
  });
  it("companyCac is the same rule over every won deal of the period (D11)", () => {
    expect(companyCac({ cost: 27000, won: 6, period: "2026-Q4" })).toEqual(real(4500));
    expect(companyCac({ cost: 4200, won: 0, period: "2026-Q3" })).toEqual(
      none("ningún deal ganado en 2026-Q3"),
    );
  });
  it("plan CAC has its own state «plan» and never borrows the real one", () => {
    expect(planCacOf({ acquisition: 6000, newCustomers: 3, period: "2026-Q4" })).toEqual({
      value: 2000,
      state: "plan",
      reason: null,
    });
    expect(planCacOf({ acquisition: null, newCustomers: 3, period: "2026-Q4" }).state).toBe(
      "sin_dato",
    );
    expect(
      planCacOf({ acquisition: 6000, newCustomers: null, period: "2026-Q4" }).value,
    ).toBeNull();
  });
});

describe("paybackOf (CA-1, D1, D2)", () => {
  it("payback = CAC / (ACV × margin / 12), «real» when every input is real", () => {
    expect(paybackOf({ cac: real(3000), acv: real(10000), margin: real(60) })).toEqual(real(6));
  });
  it("null with the reason of the first «sin_dato» input, in the order CAC, ACV, margin", () => {
    const cac = none("ningún deal ganado en 2026-Q4");
    const acv = none("falta rango de ACV");
    const margin = none("falta margen");
    expect(paybackOf({ cac, acv, margin })).toEqual(cac);
    expect(paybackOf({ cac: real(3000), acv, margin })).toEqual(acv);
    expect(paybackOf({ cac: real(3000), acv: real(10000), margin })).toEqual(none("falta margen"));
  });
  it("margin 0 or negative → «Sin dato · margen 0 % o negativo», never Infinity nor a negative number", () => {
    for (const m of [0, -10])
      expect(paybackOf({ cac: real(3000), acv: real(10000), margin: real(m) })).toEqual(
        none("margen 0 % o negativo"),
      );
  });
  it("«estimado» when an input is, with the reasons joined by «, »", () => {
    expect(
      paybackOf({
        cac: real(3000),
        acv: est(10000, "punto medio del rango"),
        margin: real(60),
      }),
    ).toEqual(est(6, "punto medio del rango"));
    expect(
      paybackOf({
        cac: est(3000, "proyección con win rate de los últimos 365 días"),
        acv: est(10000, "media de deals abiertos"),
        margin: real(60),
      }),
    ).toEqual(est(6, "proyección con win rate de los últimos 365 días, media de deals abiertos"));
  });
  it("never returns Infinity, NaN or a negative number", () => {
    const inputs = [0, -1, 1, Number.NaN, Infinity].flatMap((a) =>
      [0, -1, 1, Number.NaN].map((m) => ({ cac: real(3000), acv: real(a), margin: real(m) })),
    );
    for (const p of inputs) {
      const v = paybackOf(p).value;
      if (v != null) expect(Number.isFinite(v) && v >= 0).toBe(true);
    }
  });
  it("a plan CAC gives a «plan» payback", () => {
    expect(
      paybackOf({
        cac: { value: 2000, state: "plan", reason: null },
        acv: real(8000),
        margin: real(50),
      }),
    ).toEqual({ value: 6, state: "plan", reason: null });
  });
});

describe("acvFor (D3, D4, D5, D6)", () => {
  const s = (o: Partial<SegLike>) => seg({ id: "x", name: "X", ...o });
  it("won deals → «real», media de ganados", () => {
    expect(
      acvFor(s({}), [deal({ amount: 4000, stage: "won" }), deal({ amount: 6000, stage: "won" })]),
    ).toMatchObject({
      value: 5000,
      state: "real",
      reason: "media de ganados",
      source: "ganados",
      sample: 2,
    });
  });
  it("only open deals → «Estimado · media de deals abiertos» (D6)", () => {
    expect(acvFor(s({}), [deal({ amount: 8000 })])).toMatchObject(
      est(8000, "media de deals abiertos"),
    );
  });
  it("range midpoint → «Estimado · punto medio del rango» (D5)", () => {
    expect(acvFor(s({ acv_min: 1000, acv_max: 3000 }), [])).toMatchObject(
      est(2000, "punto medio del rango"),
    );
  });
  it("minimum without maximum → no ACV, never minimum × 1.5 (D3), also for acv_min 0", () => {
    expect(acvFor(s({ acv_min: 20000 }), [])).toMatchObject(
      none("falta el máximo del rango de ACV"),
    );
    expect(acvFor(SEG_MIN0_NO_MAX, [])).toMatchObject(none("falta el máximo del rango de ACV"));
  });
  it("no range and no deals → no ACV, never 0 (D4)", () => {
    expect(acvFor(s({}), [])).toMatchObject(none("falta rango de ACV"));
  });
});

describe("segmentMargin: the one margin chain (D1, D15)", () => {
  const segs = SEGMENTS as SegLike[];
  const pyme = segs.find((x) => x.id === "s-pyme")!;
  const neg = segs.find((x) => x.id === "s-neg")!;
  const mid = segs.find((x) => x.id === "s-mid")!;
  it("won deals with lines beat a plan or a target when the budget has no real margin", () => {
    expect(
      segmentMargin(pyme, { period: "2026-Q4", rows: BUDGET_ROWS, deals: DEALS, segments: segs }),
    ).toMatchObject({
      value: 60,
      state: "real",
      reason: "margen de los deals ganados",
      source: "deals",
    });
  });
  it("the budget's real margin of the quarter comes first", () => {
    const m = segmentMargin(neg, {
      period: "2026-Q4",
      rows: BUDGET_ROWS,
      deals: DEALS,
      segments: segs,
    });
    expect(m).toMatchObject({ state: "real", source: "real" });
    expect(m.value).toBeCloseTo(-10);
  });
  it("then the quarter's or year's plan, then the segment's target", () => {
    expect(
      segmentMargin(mid, { period: "2026-Q3", rows: BUDGET_ROWS, deals: [], segments: segs }),
    ).toMatchObject({ value: 80, source: "plan", reason: "margen presupuestado" });
    expect(
      segmentMargin(mid, { period: "2026-Q3", rows: [], deals: [], segments: segs }),
    ).toMatchObject({ value: 80, source: "objetivo", reason: "margen objetivo" });
  });
  it("with nothing in the chain → «Sin dato · falta margen» (D1: never 100 %)", () => {
    expect(
      segmentMargin(pyme, {
        period: "2026-Q3",
        rows: BUDGET_ROWS,
        deals: EXT_DEALS,
        segments: segs,
      }),
    ).toMatchObject({ ...none("falta margen"), source: null });
  });
  it("a year takes the year's budget and the deals of the 12 months before its end", () => {
    const rows = [
      bq({
        segment_id: "s-pyme",
        period: "2026-Q1",
        actual_revenue: 100,
        actual_cost_to_serve: 25,
      }),
    ];
    expect(
      segmentMargin(pyme, { period: "2026", rows, deals: DEALS, segments: segs }),
    ).toMatchObject({
      value: 75,
      source: "real",
    });
  });
});

describe("planMarginOf: the plan payback keeps the plan margin, else the target (segment-budget.ts:238)", () => {
  it("plan margin, then target, else «falta margen»", () => {
    const s = seg({ id: "x", name: "X", gross_margin_pct: 70 });
    expect(
      planMarginOf(
        s,
        bq({ segment_id: "x", period: "2026-Q1", plan_revenue: 100, plan_cost_to_serve: 40 }),
      ),
    ).toMatchObject({ value: 60 });
    expect(planMarginOf(s, undefined)).toMatchObject({ value: 70 });
    expect(planMarginOf(seg({ id: "y", name: "Y" }), undefined)).toEqual(none("falta margen"));
  });
});

describe("companyPayback: customer-weighted, with how many segments it rests on (§15.8)", () => {
  it("weighted by customers over segments with a payback; «real» when every segment with customers has one", () => {
    expect(
      companyPayback([
        { payback: real(6), customers: 3 },
        { payback: real(12), customers: 1 },
        { payback: none("sin costes en 2026-Q4"), customers: 0 },
      ]),
    ).toMatchObject({ ...real(7.5), k: 2, m: 2 });
  });
  it("«Estimado · calculado sobre {k} de {m} segmentos con clientes» when some have none", () => {
    expect(
      companyPayback([
        { payback: real(6), customers: 3 },
        { payback: none("falta margen"), customers: 2 },
      ]),
    ).toMatchObject({ ...est(6, "calculado sobre 1 de 2 segmentos con clientes"), k: 1, m: 2 });
  });
  it("«Estimado» with the estimated inputs' reasons when every segment has one", () => {
    expect(
      companyPayback([
        { payback: est(4, "punto medio del rango"), customers: 1 },
        { payback: real(8), customers: 1 },
      ]),
    ).toMatchObject(est(6, "punto medio del rango"));
  });
  it("no segment with a payback → «Sin dato · ningún segmento con payback»", () => {
    expect(companyPayback([])).toMatchObject(none("ningún segmento con payback"));
    expect(companyPayback([{ payback: none("falta margen"), customers: 2 }])).toMatchObject(
      none("ningún segmento con payback"),
    );
  });
});

describe("WIN_RATE_WINDOWS (CA-14)", () => {
  it("the three windows and the CAC window, with their words", () => {
    expect(WIN_RATE_WINDOWS.historico).toEqual({
      id: "todo_el_historico",
      label: "Todo el histórico",
    });
    expect(WIN_RATE_WINDOWS.ultimos365).toEqual({
      id: "ultimos_365_dias",
      label: "Últimos 365 días",
    });
    expect(WIN_RATE_WINDOWS.trimestre.id).toBe("trimestre");
    expect(WIN_RATE_WINDOWS.trimestre.label("2026-Q3")).toBe("Trimestre 2026-Q3");
    expect(WIN_RATE_WINDOWS.ultimos4).toEqual({
      id: "ultimos_4_trimestres",
      label: "Últimos 4 trimestres",
    });
    expect(LAST_4_QUARTERS).toBe("los últimos 4 trimestres");
  });
});
