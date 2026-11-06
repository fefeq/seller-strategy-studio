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
/** dato · estimado (a weighted segment assumes the margin or takes its ACV from the range) · sin_dato (one has margin ≤ 0). */
export type PaybackBasis = "dato" | "estimado" | "sin_dato" | null;
export type QuarterKpis = { quarter: string; plan: KpiSide; actual: KpiSide & { wonAmount: number }; paybackBasis: { plan: PaybackBasis; actual: PaybackBasis } };

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

/** What the weighted payback rests on, over the same segments weightedPayback uses (payback and customers). */
function paybackBasis(rows: SegmentBudgetRow[], k: "plan" | "actual"): PaybackBasis {
  const used = rows.filter((r) => r[k].payback != null && r[k].newCustomers);
  if (!used.length) return null;
  if (used.some((r) => r.paybackMarginBasis[k] === "no_positivo")) return "sin_dato";
  if (used.some((r) => r.paybackMarginBasis[k] === "supuesto_100" || r.acvSource === "rango")) return "estimado";
  return "dato";
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
  return {
    plan: side("plan"), actual: { ...side("actual"), wonAmount: rows.reduce((s, r) => s + r.actual.wonAmount, 0) },
    paybackBasis: { plan: paybackBasis(rows, "plan"), actual: paybackBasis(rows, "actual") },
  };
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
