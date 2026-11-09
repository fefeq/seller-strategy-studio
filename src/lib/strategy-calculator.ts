// Modelos de venta calculator (SDD-20261109-metrics-strategy-no-estimates U-4, D12-D14): what motions.tsx computed in
// the component, as a pure function. Every CAC, ACV, margin and payback comes from src/lib/unit-economics.ts:
// - the calculator's ACV: typed → real pipeline (won, else open deals) → mean of the segments' ranges («Estimado»);
//   nothing else (no example ACV);
// - the real payback of the segment: CAC of the last 4 quarters (trailingCac → cacOf), acvFor and the margin chain of
//   the current quarter (segmentMargin); without an ACV of the segment, «Sin dato · falta ACV del segmento»;
// - the plan's payback row: with basis «real» and a real CAC it IS the real payback (D14a); otherwise a scenario with
//   the calculator's ACV and the target CAC, «Estimado · con el ACV de la calculadora y el CAC objetivo» (D14b).
import { capacityPlan, matchSegment, quarterOf } from "@/lib/metrics";
import { segmentActuals, trailingCac } from "@/lib/pipeline-real";
import { assignSegment, type DealLike, type SegLike } from "@/lib/segment-coverage";
import type { CostLike } from "@/lib/cac";
import type { QuarterBudgetLike } from "@/lib/segment-budget";
import {
  acvFor,
  estimated,
  noData,
  paybackOf,
  real,
  segmentMargin,
  type AcvFigure,
  type Figure,
} from "@/lib/unit-economics";

export const SCENARIO_REASON = "con el ACV de la calculadora y el CAC objetivo";

type CalcSeg = SegLike & { ae_quota?: number | null };

export function strategyCalculator<S extends CalcSeg>(p: {
  segments: S[];
  deals: DealLike[];
  costs: (CostLike & { period: string })[];
  budgetRows: QuarterBudgetLike[];
  acvManual: number | null;
  basis: "target" | "real";
  /** Segment id chosen by hand; "" = the one whose range covers the ACV. */
  forced: string;
  now?: Date;
}) {
  const now = p.now ?? new Date();
  const actuals = segmentActuals(p.segments, p.deals, now);
  const cacReal = trailingCac(p.segments, p.deals, p.costs, now);
  const mids = p.segments
    .filter((s) => s.acv_min != null && s.acv_max != null)
    .map((s) => (Number(s.acv_min) + Number(s.acv_max)) / 2);
  const ownAcv = mids.length ? Math.round(mids.reduce((a, b) => a + b, 0) / mids.length) : null;

  // D12, D13: never an example ACV; the mean of the ranges is an estimate.
  const acv: Figure =
    p.acvManual != null
      ? real(p.acvManual)
      : actuals.overall.acv != null
        ? actuals.overall.acvSource === "ganados"
          ? real(Math.round(actuals.overall.acv), "media de ganados")
          : estimated(Math.round(actuals.overall.acv), "media de deals abiertos")
        : ownAcv != null
          ? estimated(ownAcv, "media de los rangos de tus segmentos")
          : noData("falta ACV");

  const seg = p.forced
    ? p.segments.find((s) => s.id === p.forced)
    : acv.value != null
      ? matchSegment(acv.value, p.segments)
      : undefined;
  const segReal = seg ? actuals.bySegment[seg.id] : undefined;
  const segCac = seg ? cacReal[seg.id] : undefined;
  const margin = seg
    ? segmentMargin(seg, {
        period: quarterOf(now),
        rows: p.budgetRows,
        deals: p.deals,
        segments: p.segments,
      })
    : { ...noData("falta margen"), source: null };
  const segAcvRaw: AcvFigure | null = seg
    ? acvFor(
        seg,
        p.deals.filter((d) => assignSegment(d, p.segments) === seg.id),
      )
    : null;
  // D14a: the real payback uses the segment's ACV; without one it says so (never the calculator's).
  const segAcv: Figure =
    segAcvRaw && segAcvRaw.state !== "sin_dato" ? segAcvRaw : noData("falta ACV del segmento");
  const paybackReal: Figure = segCac
    ? paybackOf({ cac: segCac.figure, acv: segAcv, margin })
    : noData("falta CAC real");

  const winUsed =
    p.basis === "real" && segReal?.winRate != null ? segReal.winRate : seg?.win_rate_target;
  const useRealCac = p.basis === "real" && segCac?.cac != null;
  const cacUsed = useRealCac ? segCac!.cac : seg?.cac_target;
  const plan = capacityPlan({
    acv: acv.value ?? 0,
    quota: seg?.ae_quota,
    winRatePct: winUsed,
    cac: cacUsed,
    grossMarginPct: margin.value,
  });
  const capacity = (v: number | null): Figure =>
    acv.value == null ? noData("falta ACV") : { value: v, state: "real", reason: null };

  let planPayback: Figure;
  if (useRealCac) planPayback = paybackReal;
  else {
    const target = seg?.cac_target != null ? Number(seg.cac_target) : null;
    const scenario = paybackOf({
      cac: target ? real(target) : noData("falta CAC objetivo"),
      acv,
      margin,
    });
    planPayback = scenario.value != null ? estimated(scenario.value, SCENARIO_REASON) : scenario;
  }
  const targetMonths = seg?.payback_months ? Number(seg.payback_months) : null;
  const judged =
    planPayback.value != null &&
    (planPayback.state === "real" || planPayback.state === "estimado") &&
    targetMonths != null
      ? { within: planPayback.value <= targetMonths, target: targetMonths }
      : null;

  return {
    actuals,
    ownAcv,
    acv,
    seg,
    segReal,
    segCac,
    segAcv: segAcvRaw,
    margin,
    paybackReal,
    winUsed,
    cacUsed,
    deals: capacity(plan.dealsPerYear),
    opps: capacity(plan.oppsPerYear),
    oppsPerMonth: capacity(plan.oppsPerMonth),
    planPayback,
    planPaybackLabel: useRealCac ? ("Payback real" as const) : ("Payback estimado" as const),
    judged,
  };
}
