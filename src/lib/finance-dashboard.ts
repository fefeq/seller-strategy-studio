// Finance view of a quarter: budget vs real spend, revenue, margin and ROI, from data entered in Nokko.
// Pure so Métricas, the agent and tests agree.
import { quarterRange } from "@/lib/metrics";
import { deviation, type QuarterBudgetLike } from "@/lib/segment-budget";

export const COST_CATEGORIES: Record<string, string> = {
  team: "Equipo",
  tools: "Software y herramientas",
  infra: "Infraestructura",
  services: "Servicios externos",
  office: "Oficina",
  other: "Otros",
};
export const categoryLabel = (c: string) => COST_CATEGORIES[c] ?? c;

/** A recurring operating cost: `amount` is per month, from starts_on until ends_on (inclusive, open-ended when null). */
export type CostLineLike = { amount: number | string; category: string; starts_on: string; ends_on: string | null };
export type InvoiceLike = { amount: number | string; issued_on: string; paid_on: string | null };
export type CacLike = { period: string; amount: number | string };
export type WonDealLike = { stage: string; amount: number | string | null; closed_at: string | null; updated_at: string };
export type RevenueSource = "facturas" | "presupuesto" | "deals";

const n = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));
const pad = (m: number) => String(m).padStart(2, "0");

/** "2026-Q3" → ["2026-07", "2026-08", "2026-09"]. */
export function quarterMonths(quarter: string) {
  const [y, q] = quarter.split("-Q").map(Number);
  return [1, 2, 3].map((i) => `${y}-${pad((q - 1) * 3 + i)}`);
}

/** Months of the quarter in which the line is active. */
export function monthsActive(line: Pick<CostLineLike, "starts_on" | "ends_on">, quarter: string) {
  const from = line.starts_on.slice(0, 7);
  const to = line.ends_on?.slice(0, 7) ?? "9999-12";
  return quarterMonths(quarter).filter((m) => m >= from && m <= to).length;
}

/** Operating cost of the quarter, total and per category (largest first). */
export function operatingCost(lines: CostLineLike[], quarter: string) {
  const by = new Map<string, number>();
  for (const l of lines) {
    const v = (n(l.amount) ?? 0) * monthsActive(l, quarter);
    if (v) by.set(l.category, (by.get(l.category) ?? 0) + v);
  }
  const byCategory = [...by.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  return { total: byCategory.reduce((s, c) => s + c.amount, 0), byCategory };
}

const inQuarterDate = (d: string | null | undefined, quarter: string) => !!d && quarterMonths(quarter).includes(d.slice(0, 7));

/** Revenue / spend; null without spend or revenue. */
export const roi = (revenue: number | null, spend: number | null) => (revenue != null && spend ? revenue / spend : null);

/**
 * One quarter. Budget = sum of the segment budgets (revenue; spend = acquisition + cost to serve).
 * Real spend = acquisition costs (CAC panel) + operating costs. Real revenue, in order of reliability:
 * invoices issued in the quarter, then the budget's real revenue, then the deals won in it.
 */
export function quarterFinance(input: {
  quarter: string;
  lines: CostLineLike[];
  cac: CacLike[];
  invoices: InvoiceLike[];
  budgets: QuarterBudgetLike[];
  deals: WonDealLike[];
}) {
  const { quarter } = input;
  const budgets = input.budgets.filter((b) => b.period === quarter);
  const sumOf = (vals: (number | null)[]) => (vals.some((v) => v != null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null);

  const budgetRevenue = sumOf(budgets.map((b) => n(b.plan_revenue)));
  const budgetSpend = sumOf(budgets.flatMap((b) => [n(b.plan_acquisition), n(b.plan_cost_to_serve)]));

  const acquisition = input.cac.filter((c) => c.period === quarter).reduce((s, c) => s + (n(c.amount) ?? 0), 0);
  const operating = operatingCost(input.lines, quarter);
  const spend = acquisition + operating.total;

  const invoices = input.invoices.filter((i) => inQuarterDate(i.issued_on, quarter));
  const { start, end } = quarterRange(quarter);
  const won = input.deals.filter((d) => {
    const t = new Date(d.closed_at ?? d.updated_at).getTime();
    return d.stage === "won" && t >= start.getTime() && t < end.getTime();
  });
  const budgetActual = sumOf(budgets.map((b) => n(b.actual_revenue)));
  let revenue: number | null = null;
  let revenueSource: RevenueSource | null = null;
  if (invoices.length) { revenue = invoices.reduce((s, i) => s + (n(i.amount) ?? 0), 0); revenueSource = "facturas"; }
  else if (budgetActual != null) { revenue = budgetActual; revenueSource = "presupuesto"; }
  else if (won.length) { revenue = won.reduce((s, d) => s + (n(d.amount) ?? 0), 0); revenueSource = "deals"; }

  const margin = revenue != null ? revenue - spend : null;
  const collected = input.invoices.filter((i) => inQuarterDate(i.paid_on, quarter)).reduce((s, i) => s + (n(i.amount) ?? 0), 0);

  return {
    quarter,
    budget: { revenue: budgetRevenue, spend: budgetSpend, margin: budgetRevenue != null && budgetSpend != null ? budgetRevenue - budgetSpend : null, roi: roi(budgetRevenue, budgetSpend) },
    actual: {
      revenue, revenueSource, acquisition, operating: operating.total, byCategory: operating.byCategory, spend,
      margin, marginPct: margin != null && revenue ? margin / revenue : null, roi: roi(revenue, spend), collected,
    },
    spendDeviation: deviation(spend || null, budgetSpend, { lowerIsBetter: true }),
    revenueDeviation: deviation(revenue, budgetRevenue),
  };
}

export type QuarterFinance = ReturnType<typeof quarterFinance>;
