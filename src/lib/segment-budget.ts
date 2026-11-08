// Budget per segment: plan vs actual revenue, cost to serve and acquisition spend, entered per quarter
// (the year is the sum of its 4 quarters). The real gross margin it yields feeds every payback in the app.
// Pure so dashboards, MCP and tests agree.
import { capacityPlan, quarterRange } from "@/lib/metrics";
import { segmentCac, sharedSplitBasis, type CostLike } from "@/lib/cac";
import {
  assignSegment,
  assignedByAmount,
  paybackMarginBasis,
  segmentAcv,
  type DealLike,
  type SegLike,
} from "@/lib/segment-coverage";

export const BUDGET_FIELDS = [
  "plan_revenue",
  "plan_cost_to_serve",
  "plan_acquisition",
  "plan_new_customers",
  "actual_revenue",
  "actual_cost_to_serve",
] as const;
export type BudgetField = (typeof BUDGET_FIELDS)[number];
export type BudgetValues = Record<BudgetField, number | string | null>;
export type QuarterBudgetLike = BudgetValues & { segment_id: string; period: string };
/** Annual budget of a segment (derived: sum of its quarters). `*_margin` = margin over quarters that have both revenue and cost. */
export type BudgetLike = BudgetValues & {
  segment_id: string;
  year: number;
  plan_margin?: number | null;
  actual_margin?: number | null;
};

/** real: budget actuals · deals: margin of the deals won with product lines · plan · objetivo: segment target. */
export type MarginSource = "real" | "deals" | "plan" | "objetivo";

const num = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));

/**
 * Deviation of actual vs plan: % of the plan (or points for margins). `good` = it goes the right way
 * (more revenue, margin, customers; less cost, spend, CAC, payback), shown green; otherwise red.
 */
export function deviation(
  real: number | null,
  plan: number | null,
  opts: { lowerIsBetter?: boolean; points?: boolean } = {},
) {
  if (real == null || plan == null || (!opts.points && !plan)) return null;
  const value = opts.points ? real - plan : ((real - plan) / plan) * 100;
  if (Math.abs(value) < 0.05) return { value: 0, good: null };
  return { value, good: opts.lowerIsBetter ? value < 0 : value > 0 };
}

export const quartersOfYear = (year: number) => [1, 2, 3, 4].map((n) => `${year}-Q${n}`);

/** Annual budget per segment = sum of the year's quarters; a field stays null when no quarter has it. */
export function annualFromQuarters(rows: QuarterBudgetLike[], year: number): BudgetLike[] {
  const qs = quartersOfYear(year);
  const bySeg = new Map<string, QuarterBudgetLike[]>();
  for (const r of rows)
    if (qs.includes(r.period)) bySeg.set(r.segment_id, [...(bySeg.get(r.segment_id) ?? []), r]);
  return [...bySeg.entries()].map(([segment_id, xs]) => {
    const out = { segment_id, year } as BudgetLike;
    for (const f of BUDGET_FIELDS) {
      const vals = xs.map((x) => num(x[f])).filter((v): v is number => v != null);
      out[f] = vals.length ? vals.reduce((s, v) => s + v, 0) : null;
    }
    // A quarter with revenue but no cost yet would inflate the margin: only paired quarters count.
    for (const k of ["plan", "actual"] as const) {
      const paired = xs.filter(
        (x) => num(x[`${k}_revenue`]) && num(x[`${k}_cost_to_serve`]) != null,
      );
      out[`${k}_margin`] = grossMargin(
        paired.reduce((t, x) => t + num(x[`${k}_revenue`])!, 0),
        paired.length ? paired.reduce((t, x) => t + num(x[`${k}_cost_to_serve`])!, 0) : null,
      );
    }
    return out;
  });
}

/** Gross margin % = (revenue − cost to serve) / revenue; null without revenue or cost. */
export function grossMargin(
  revenue: number | string | null | undefined,
  costToServe: number | string | null | undefined,
) {
  const r = num(revenue),
    c = num(costToServe);
  if (!r || r <= 0 || c == null) return null;
  return ((r - c) / r) * 100;
}

/** Real or planned margin of a budget (annual budgets carry it precomputed over paired quarters). */
export function budgetMargin(
  b: (BudgetValues & { plan_margin?: number | null; actual_margin?: number | null }) | undefined,
  kind: "plan" | "actual",
) {
  if (!b) return null;
  const pre = b[`${kind}_margin`];
  return pre !== undefined ? pre : grossMargin(b[`${kind}_revenue`], b[`${kind}_cost_to_serve`]);
}

/**
 * Margin used by payback. Budgets come in priority order (e.g. the quarter, then its year):
 * any real margin beats any planned one; without either, the segment's gross margin target.
 */
export function marginFor(
  seg: SegLike,
  ...budgets: (
    (BudgetValues & { plan_margin?: number | null; actual_margin?: number | null }) | undefined
  )[]
): { pct: number | null; source: MarginSource | null } {
  for (const b of budgets) {
    const real = budgetMargin(b, "actual");
    if (real != null) return { pct: real, source: "real" };
  }
  for (const b of budgets) {
    const plan = budgetMargin(b, "plan");
    if (plan != null) return { pct: plan, source: "plan" };
  }
  return seg.gross_margin_pct != null
    ? { pct: Number(seg.gross_margin_pct), source: "objetivo" }
    : { pct: null, source: null };
}

export type MarginSeg<S extends SegLike> = S & {
  margin_source: MarginSource | null;
  margin_target: number | null;
};

const applyMargin = <S extends SegLike>(
  s: S,
  m: { pct: number | null; source: MarginSource | null },
): MarginSeg<S> => ({
  ...s,
  gross_margin_pct: m.pct,
  margin_source: m.source,
  margin_target: s.gross_margin_pct != null ? Number(s.gross_margin_pct) : null,
});

/** Segments with gross_margin_pct replaced by the margin of the year's budget, so existing payback maths use it. */
export function withBudgetMargin<S extends SegLike>(
  segments: S[],
  budgets: BudgetLike[],
  year: number,
): MarginSeg<S>[] {
  return segments.map((s) =>
    applyMargin(
      s,
      marginFor(
        s,
        budgets.find((b) => b.segment_id === s.id && b.year === year),
      ),
    ),
  );
}

/**
 * Same, from quarterly rows: for a quarter ("2026-Q3") the quarter first, then its year; for a year ("2026") the year.
 * `dealMargins` (segment → margin % of its won deals with product lines) comes right after the budget's real
 * margin: what was actually sold beats a plan or a target.
 */
export function withPeriodMargin<S extends SegLike>(
  segments: S[],
  rows: QuarterBudgetLike[],
  period: string,
  dealMargins?: Record<string, { pct: number }>,
): MarginSeg<S>[] {
  const annual = annualFromQuarters(rows, Number(period.slice(0, 4)));
  return segments.map((s) => {
    const m = marginFor(
      s,
      period.includes("-Q")
        ? rows.find((r) => r.segment_id === s.id && r.period === period)
        : undefined,
      annual.find((b) => b.segment_id === s.id),
    );
    const sold = dealMargins?.[s.id];
    return applyMargin(s, m.source !== "real" && sold ? { pct: sold.pct, source: "deals" } : m);
  });
}

/**
 * Plan vs actual per segment for one period. Plan CAC = planned acquisition / planned new customers;
 * actual acquisition = entered costs of the period, actual customers = deals won in it.
 * Both paybacks divide the CAC by the segment ACV × margin (plan margin for the plan, `marginChain` for the actual).
 */
function periodBudget(
  segments: SegLike[],
  deals: DealLike[],
  costs: CostLike[],
  range: { start: Date; end: Date },
  values: (segId: string) => BudgetValues | undefined,
  marginChain: (segId: string) => (BudgetValues | undefined)[],
) {
  const wonIn = (id: string) =>
    deals.filter((d) => {
      const t = new Date(d.closed_at ?? d.updated_at).getTime();
      return (
        d.stage === "won" &&
        t >= range.start.getTime() &&
        t < range.end.getTime() &&
        assignSegment(d, segments) === id
      );
    });
  const customers = Object.fromEntries(segments.map((s) => [s.id, wonIn(s.id).length]));
  const cacs = segmentCac(
    costs,
    customers,
    segments.map((s) => s.id),
  );
  const sharedSplit = sharedSplitBasis(
    costs,
    customers,
    segments.map((s) => s.id),
  );

  return segments.map((seg) => {
    const b = values(seg.id);
    const {
      acv,
      source: acvSource,
      rangeBasis,
    } = segmentAcv(
      seg,
      deals.filter((d) => assignSegment(d, segments) === seg.id),
    );
    const target = seg.payback_months != null ? Number(seg.payback_months) : null;

    const planRevenue = num(b?.plan_revenue);
    const planAcq = num(b?.plan_acquisition);
    const planNew = num(b?.plan_new_customers);
    const planMargin = budgetMargin(b, "plan");
    const planCac = planAcq != null && planNew ? planAcq / planNew : null;
    const planCalc = capacityPlan({
      acv,
      cac: planCac,
      grossMarginPct: planMargin ?? seg.gross_margin_pct,
    });
    const planPayback = planCalc.paybackMonths;

    const won = wonIn(seg.id);
    const actualRevenue = num(b?.actual_revenue);
    const realMargin = budgetMargin(b, "actual");
    const used = marginFor(seg, ...marginChain(seg.id));
    const cac = cacs[seg.id];
    const realCalc =
      cac.cac != null ? capacityPlan({ acv, cac: cac.cac, grossMarginPct: used.pct }) : null;
    const realPayback = realCalc ? realCalc.paybackMonths : null;

    return {
      segment: seg,
      acv,
      plan: {
        revenue: planRevenue,
        costToServe: num(b?.plan_cost_to_serve),
        margin: planMargin,
        acquisition: planAcq,
        newCustomers: planNew,
        cac: planCac,
        payback: planPayback,
      },
      actual: {
        revenue: actualRevenue,
        costToServe: num(b?.actual_cost_to_serve),
        margin: realMargin,
        acquisition: cac.cost,
        newCustomers: won.length,
        wonAmount: won.reduce((s, d) => s + Number(d.amount ?? 0), 0),
        cac: cac.cac,
        payback: realPayback,
      },
      margin: used,
      revenueAttainment: planRevenue && actualRevenue != null ? actualRevenue / planRevenue : null,
      spendVsPlan: planAcq ? cac.cost / planAcq : null,
      payback: {
        target,
        planOk: planPayback != null && target != null ? planPayback <= target : null,
        realOk: realPayback != null && target != null ? realPayback <= target : null,
      },
      // Labels only (SDD-20261106-metrics-honest-data §13): top level, never inside plan / actual / payback.
      acvSource,
      acvRangeBasis: rangeBasis,
      wonInPeriod: won.length,
      inferredWonInPeriod: won.filter((d) => assignedByAmount(d, segments)).length,
      paybackMarginBasis: {
        plan: paybackMarginBasis(planCalc),
        actual: realCalc ? paybackMarginBasis(realCalc) : null,
      },
      sharedSplit,
    };
  });
}

export type SegmentBudgetRow = ReturnType<typeof periodBudget>[number];

const yearRange = (year: number) => ({
  start: new Date(Date.UTC(year, 0, 1)),
  end: new Date(Date.UTC(year + 1, 0, 1)),
});

/** Plan vs actual per segment for a year from annual budgets. */
export function segmentBudget(
  segments: SegLike[],
  deals: DealLike[],
  budgets: BudgetLike[],
  costs: (CostLike & { period: string })[],
  year: number,
) {
  const find = (id: string) => budgets.find((x) => x.segment_id === id && x.year === year);
  return periodBudget(
    segments,
    deals,
    costs.filter((c) => quartersOfYear(year).includes(c.period)),
    yearRange(year),
    find,
    (id) => [find(id)],
  );
}

/** Plan vs actual per segment for each quarter of a year and for the whole year (sum of the quarters). */
export function quarterlyBudget(
  segments: SegLike[],
  deals: DealLike[],
  rows: QuarterBudgetLike[],
  costs: (CostLike & { period: string })[],
  year: number,
) {
  const quarters = quartersOfYear(year);
  const annual = annualFromQuarters(rows, year);
  const yearOf = (id: string) => annual.find((b) => b.segment_id === id);
  const byQuarter = Object.fromEntries(
    quarters.map((q) => {
      const row = (id: string) => rows.find((r) => r.segment_id === id && r.period === q);
      return [
        q,
        periodBudget(
          segments,
          deals,
          costs.filter((c) => c.period === q),
          quarterRange(q),
          row,
          (id) => [row(id), yearOf(id)],
        ),
      ];
    }),
  ) as Record<string, SegmentBudgetRow[]>;
  return { quarters, byQuarter, year: segmentBudget(segments, deals, annual, costs, year) };
}
