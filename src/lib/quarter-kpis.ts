// Company-wide quarterly KPIs (revenue, cost to serve, margin, acquisition, CAC, payback) built from the
// per-segment budget rows, so Métricas shows the same numbers as Estrategia GTM → Presupuesto vs real, Cobertura and
// MCP. CAC and payback come from src/lib/unit-economics.ts (SDD-20261109-metrics-strategy-no-estimates): the company
// CAC is every cost of the quarter / every deal won in it (with or without segment, D11); the payback is the
// customer-weighted payback of the segments that have one, saying on how many it rests (§15.8).
import { quarterRange } from "@/lib/metrics";
import {
  grossMargin,
  quarterlyBudget,
  type QuarterBudgetLike,
  type SegmentBudgetRow,
} from "@/lib/segment-budget";
import { assignSegment, type DealLike, type SegLike } from "@/lib/segment-coverage";
import type { CostLike } from "@/lib/cac";
import {
  companyCac,
  companyPayback,
  planCacOf,
  type CompanyPayback,
  type Figure,
  type PlanFigure,
} from "@/lib/unit-economics";

export type KpiSide = {
  revenue: number | null;
  costToServe: number | null;
  margin: number | null;
  acquisition: number | null;
  newCustomers: number | null;
  cac: number | null;
  payback: number | null;
};
export type QuarterKpis = {
  quarter: string;
  plan: KpiSide;
  actual: KpiSide & { wonAmount: number };
  /** The CAC and payback above as Figures (state and reason), the ones the board shows too. */
  figures: {
    cac: Figure;
    payback: CompanyPayback;
    planCac: PlanFigure;
    planPayback: CompanyPayback;
  };
  /** Deals won in the quarter that no segment covers: they count in the company CAC (D11). */
  unsegmentedWon: number;
};

/** What the company-level figures need beyond the segment rows: every cost and every won deal of the period. */
export type CompanyPeriod = {
  period: string;
  cost: number | null;
  won: number;
  unsegmentedWon: number;
};

/** Sum that stays null when no segment has the value (so "no data" never reads as 0). */
function sumOrNull(xs: (number | null)[]) {
  const vals = xs.filter((x): x is number => x != null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
}

/** Company totals of one period from its per-segment budget rows and the period's costs and won deals. */
export function kpiTotals(
  rows: SegmentBudgetRow[],
  company: CompanyPeriod,
): Omit<QuarterKpis, "quarter"> {
  const common = (k: "plan" | "actual") => {
    // Margin only over segments that have both revenue and cost, like the annual budget does.
    const paired = rows.filter((r) => r[k].revenue && r[k].costToServe != null);
    return {
      revenue: sumOrNull(rows.map((r) => r[k].revenue)),
      costToServe: sumOrNull(rows.map((r) => r[k].costToServe)),
      margin: paired.length
        ? grossMargin(
            paired.reduce((s, r) => s + r[k].revenue!, 0),
            paired.reduce((s, r) => s + r[k].costToServe!, 0),
          )
        : null,
    };
  };
  const planAcquisition = sumOrNull(rows.map((r) => r.plan.acquisition));
  const planNew = sumOrNull(rows.map((r) => r.plan.newCustomers));
  const planCac = planCacOf({
    acquisition: planAcquisition,
    newCustomers: planNew,
    period: company.period,
  });
  const planPayback = companyPayback(
    rows.map((r) => ({ payback: r.figures.planPayback, customers: r.plan.newCustomers })),
  );
  // Every cost of the period, also the shared part that nobody's win split (D7); no cost = no CAC, never 0.
  const cac = companyCac({ cost: company.cost, won: company.won, period: company.period });
  const payback = companyPayback(
    rows.map((r) => ({ payback: r.figures.payback, customers: r.actual.newCustomers })),
  );
  return {
    plan: {
      ...common("plan"),
      acquisition: planAcquisition,
      newCustomers: planNew,
      cac: planCac.value,
      payback: planPayback.value,
    },
    actual: {
      ...common("actual"),
      acquisition: company.cost || null,
      newCustomers: company.won,
      cac: cac.value,
      payback: payback.value,
      wonAmount: rows.reduce((s, r) => s + r.actual.wonAmount, 0),
    },
    figures: { cac, payback, planCac, planPayback },
    unsegmentedWon: company.unsegmentedWon,
  };
}

/** Every cost of the quarter and every deal won in it (with or without segment), for kpiTotals. */
export function companyPeriod(
  segments: SegLike[],
  deals: DealLike[],
  costs: (CostLike & { period: string })[],
  quarter: string,
): CompanyPeriod {
  const { start, end } = quarterRange(quarter);
  const won = deals.filter((d) => {
    const t = new Date(d.closed_at ?? d.updated_at).getTime();
    return d.stage === "won" && t >= start.getTime() && t < end.getTime();
  });
  const cost = costs
    .filter((c) => c.period === quarter)
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  return {
    period: quarter,
    cost: cost || null,
    won: won.length,
    unsegmentedWon: won.filter((d) => assignSegment(d, segments) == null).length,
  };
}

/** KPIs for each quarter asked for (they may span two years). */
export function quarterKpis(
  segments: SegLike[],
  deals: DealLike[],
  budgetRows: QuarterBudgetLike[],
  costs: (CostLike & { period: string })[],
  quarters: string[],
): QuarterKpis[] {
  const byYear = new Map<number, ReturnType<typeof quarterlyBudget>>();
  return quarters.map((q) => {
    const year = Number(q.slice(0, 4));
    if (!byYear.has(year))
      byYear.set(year, quarterlyBudget(segments, deals, budgetRows, costs, year));
    return {
      quarter: q,
      ...kpiTotals(byYear.get(year)!.byQuarter[q] ?? [], companyPeriod(segments, deals, costs, q)),
    };
  });
}
