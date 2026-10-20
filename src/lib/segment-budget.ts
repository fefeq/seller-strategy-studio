// Annual budget per segment: plan vs actual revenue, cost to serve and acquisition spend.
// The real gross margin it yields feeds every payback in the app. Pure so dashboards, MCP and tests agree.
import { capacityPlan } from "@/lib/metrics";
import { segmentCac, type CostLike } from "@/lib/cac";
import { assignSegment, segmentAcv, type DealLike, type SegLike } from "@/lib/segment-coverage";

export type BudgetLike = {
  segment_id: string;
  year: number;
  plan_revenue: number | string | null;
  plan_cost_to_serve: number | string | null;
  plan_acquisition: number | string | null;
  plan_new_customers: number | null;
  actual_revenue: number | string | null;
  actual_cost_to_serve: number | string | null;
};

export type MarginSource = "real" | "plan" | "objetivo";

const num = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));

/** Gross margin % = (revenue − cost to serve) / revenue; null without revenue or cost. */
export function grossMargin(revenue: number | string | null | undefined, costToServe: number | string | null | undefined) {
  const r = num(revenue), c = num(costToServe);
  if (!r || r <= 0 || c == null) return null;
  return ((r - c) / r) * 100;
}

/** Margin used by payback: actual of the year → plan of the year → the segment's gross margin target. */
export function marginFor(seg: SegLike, budget: BudgetLike | undefined): { pct: number | null; source: MarginSource | null } {
  const real = budget ? grossMargin(budget.actual_revenue, budget.actual_cost_to_serve) : null;
  if (real != null) return { pct: real, source: "real" };
  const plan = budget ? grossMargin(budget.plan_revenue, budget.plan_cost_to_serve) : null;
  if (plan != null) return { pct: plan, source: "plan" };
  return seg.gross_margin_pct != null ? { pct: Number(seg.gross_margin_pct), source: "objetivo" } : { pct: null, source: null };
}

export type MarginSeg<S extends SegLike> = S & { margin_source: MarginSource | null; margin_target: number | null };

/** Segments with gross_margin_pct replaced by the margin of the year's budget, so existing payback maths use it. */
export function withBudgetMargin<S extends SegLike>(segments: S[], budgets: BudgetLike[], year: number): MarginSeg<S>[] {
  return segments.map((s) => {
    const m = marginFor(s, budgets.find((b) => b.segment_id === s.id && b.year === year));
    return { ...s, gross_margin_pct: m.pct, margin_source: m.source, margin_target: s.gross_margin_pct != null ? Number(s.gross_margin_pct) : null };
  });
}

export const quartersOfYear = (year: number) => [1, 2, 3, 4].map((n) => `${year}-Q${n}`);

/**
 * Plan vs actual per segment for a year. Plan CAC = planned acquisition / planned new customers;
 * actual acquisition comes from the entered costs of the year's quarters and actual customers from deals won that year.
 * Both paybacks divide the CAC by the segment ACV × its margin (plan margin for the plan, real margin for the actual).
 */
export function segmentBudget(segments: SegLike[], deals: DealLike[], budgets: BudgetLike[], costs: (CostLike & { period: string })[], year: number) {
  const start = new Date(Date.UTC(year, 0, 1)).getTime();
  const end = new Date(Date.UTC(year + 1, 0, 1)).getTime();
  const wonIn = (id: string) => deals.filter((d) => {
    const t = new Date(d.closed_at ?? d.updated_at).getTime();
    return d.stage === "won" && t >= start && t < end && assignSegment(d, segments) === id;
  });
  const yearCosts = costs.filter((c) => quartersOfYear(year).includes(c.period));
  const cacs = segmentCac(yearCosts, Object.fromEntries(segments.map((s) => [s.id, wonIn(s.id).length])), segments.map((s) => s.id));

  return segments.map((seg) => {
    const b = budgets.find((x) => x.segment_id === seg.id && x.year === year);
    const { acv } = segmentAcv(seg, deals.filter((d) => assignSegment(d, segments) === seg.id));
    const target = seg.payback_months != null ? Number(seg.payback_months) : null;

    const planRevenue = num(b?.plan_revenue);
    const planAcq = num(b?.plan_acquisition);
    const planNew = b?.plan_new_customers ?? null;
    const planMargin = b ? grossMargin(b.plan_revenue, b.plan_cost_to_serve) : null;
    const planCac = planAcq != null && planNew ? planAcq / planNew : null;
    const planPayback = capacityPlan({ acv, cac: planCac, grossMarginPct: planMargin ?? seg.gross_margin_pct }).paybackMonths;

    const won = wonIn(seg.id);
    const actualRevenue = num(b?.actual_revenue);
    const realMargin = b ? grossMargin(b.actual_revenue, b.actual_cost_to_serve) : null;
    const used = marginFor(seg, b);
    const cac = cacs[seg.id];
    const realPayback = cac.cac != null ? capacityPlan({ acv, cac: cac.cac, grossMarginPct: used.pct }).paybackMonths : null;

    return {
      segment: seg,
      acv,
      plan: { revenue: planRevenue, costToServe: num(b?.plan_cost_to_serve), margin: planMargin, acquisition: planAcq, newCustomers: planNew, cac: planCac, payback: planPayback },
      actual: {
        revenue: actualRevenue, costToServe: num(b?.actual_cost_to_serve), margin: realMargin,
        acquisition: cac.cost, newCustomers: won.length, wonAmount: won.reduce((s, d) => s + Number(d.amount ?? 0), 0),
        cac: cac.cac, payback: realPayback,
      },
      margin: used,
      revenueAttainment: planRevenue && actualRevenue != null ? actualRevenue / planRevenue : null,
      spendVsPlan: planAcq ? cac.cost / planAcq : null,
      payback: { target, planOk: planPayback != null && target != null ? planPayback <= target : null, realOk: realPayback != null && target != null ? realPayback <= target : null },
    };
  });
}

export type SegmentBudgetRow = ReturnType<typeof segmentBudget>[number];
