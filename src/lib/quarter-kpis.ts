// Company-wide quarterly KPIs (revenue, cost to serve, margin, acquisition, CAC, payback) built from the
// per-segment budget rows, so Métricas shows the same numbers as Estrategia GTM → Presupuesto vs real.
import { grossMargin, quarterlyBudget, type QuarterBudgetLike, type SegmentBudgetRow } from "@/lib/segment-budget";
import type { DealLike, SegLike } from "@/lib/segment-coverage";
import type { CostLike } from "@/lib/cac";

export type KpiSide = {
  revenue: number | null;
  costToServe: number | null;
  margin: number | null;
  acquisition: number | null;
  newCustomers: number | null;
  cac: number | null;
  payback: number | null;
};
export type QuarterKpis = { quarter: string; plan: KpiSide; actual: KpiSide & { wonAmount: number } };

/** Sum that stays null when no segment has the value (so "no data" never reads as 0). */
function sumOrNull(xs: (number | null)[]) {
  const vals = xs.filter((x): x is number => x != null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
}

/** Average of the segment paybacks weighted by their customers; null when no segment has both. */
function weightedPayback(pairs: { payback: number | null; customers: number | null }[]) {
  const ok = pairs.filter((p) => p.payback != null && p.customers);
  const w = ok.reduce((s, p) => s + p.customers!, 0);
  return w ? ok.reduce((s, p) => s + p.payback! * p.customers!, 0) / w : null;
}

/** Company totals of one period from its per-segment budget rows. */
export function kpiTotals(rows: SegmentBudgetRow[]): Omit<QuarterKpis, "quarter"> {
  const side = (k: "plan" | "actual"): KpiSide => {
    const revenue = sumOrNull(rows.map((r) => r[k].revenue));
    // Margin only over segments that have both revenue and cost, like the annual budget does.
    const paired = rows.filter((r) => r[k].revenue && r[k].costToServe != null);
    const costToServe = sumOrNull(rows.map((r) => r[k].costToServe));
    // Real acquisition is the entered costs (0 when none): like segmentCac, no cost means no CAC, not a CAC of 0.
    const raw = sumOrNull(rows.map((r) => r[k].acquisition));
    const acquisition = k === "actual" && !raw ? null : raw;
    const newCustomers = sumOrNull(rows.map((r) => r[k].newCustomers));
    return {
      revenue,
      costToServe,
      margin: paired.length ? grossMargin(paired.reduce((s, r) => s + r[k].revenue!, 0), paired.reduce((s, r) => s + r[k].costToServe!, 0)) : null,
      acquisition,
      newCustomers,
      cac: acquisition && newCustomers ? acquisition / newCustomers : null,
      payback: weightedPayback(rows.map((r) => ({ payback: r[k].payback, customers: r[k].newCustomers }))),
    };
  };
  return { plan: side("plan"), actual: { ...side("actual"), wonAmount: rows.reduce((s, r) => s + r.actual.wonAmount, 0) } };
}

/** KPIs for each quarter asked for (they may span two years). */
export function quarterKpis(
  segments: SegLike[], deals: DealLike[], budgetRows: QuarterBudgetLike[], costs: (CostLike & { period: string })[], quarters: string[],
): QuarterKpis[] {
  const byYear = new Map<number, ReturnType<typeof quarterlyBudget>>();
  return quarters.map((q) => {
    const year = Number(q.slice(0, 4));
    if (!byYear.has(year)) byYear.set(year, quarterlyBudget(segments, deals, budgetRows, costs, year));
    return { quarter: q, ...kpiTotals(byYear.get(year)!.byQuarter[q] ?? []) };
  });
}
