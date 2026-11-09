// Unit economics (SDD-20261109-metrics-strategy-no-estimates): the one CAC formula, the one payback formula, the
// one margin chain, the one ACV rule behind a payback and the one company aggregate. Every surface (/metrics,
// /strategy, Inicio, MCP, the agent) reads these, so a segment and a quarter give the same number everywhere.
// Each number is a Figure with its state: «real», «estimado» (declared reason) or «sin_dato» (what is missing).
// An assumption never becomes a number: no 100 % margin, no minimum × 1.5, no shared cost split when nobody won.
import { quarterRange } from "@/lib/metrics";
import { wonDealsMargin, type MarginDeal } from "@/lib/deal-lines";
import {
  annualFromQuarters,
  budgetMargin,
  marginFor,
  type BudgetLike,
  type BudgetValues,
  type MarginSource,
  type QuarterBudgetLike,
} from "@/lib/segment-budget";
import type { DealLike, SegLike } from "@/lib/segment-coverage";

export type FigureState = "real" | "estimado" | "sin_dato";
export type Figure = { value: number | null; state: FigureState; reason: string | null };
/** A planned figure (budget): its own state, never «real». */
export type PlanFigure = {
  value: number | null;
  state: "plan" | "sin_dato";
  reason: string | null;
};

/** Windows of each win rate (and of the calculator's CAC), as data: an id for MCP and the words for the screen. */
export const WIN_RATE_WINDOWS = {
  historico: { id: "todo_el_historico", label: "Todo el histórico" },
  ultimos365: { id: "ultimos_365_dias", label: "Últimos 365 días" },
  trimestre: { id: "trimestre", label: (q: string) => `Trimestre ${q}` },
  ultimos4: { id: "ultimos_4_trimestres", label: "Últimos 4 trimestres" },
} as const;
/** The period of the calculator's CAC, as it reads inside a reason. */
export const LAST_4_QUARTERS = "los últimos 4 trimestres";

/** Months of payback as every screen writes them: es-ES (comma), at most one decimal, no trailing «,0». */
export const fmtMonths = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/** Constructors, so a caller holding a plain number (a typed ACV, a margin %) hands it over as a Figure. */
export const real = (value: number, reason: string | null = null): Figure => ({
  value,
  state: "real",
  reason,
});
export const estimated = (value: number, reason: string): Figure => ({
  value,
  state: "estimado",
  reason,
});
export const noData = (reason: string): Figure => ({ value: null, state: "sin_dato", reason });
const has = (f: { value: number | null; state: string }) =>
  f.state !== "sin_dato" && f.value != null;

/** Real CAC = acquisition cost of the period / deals won in it. No cost → no CAC (never 0). */
export function cacOf(p: { cost: number | null; won: number; period: string }): Figure {
  if (!p.cost || p.cost <= 0) return noData(`sin costes en ${p.period}`);
  if (!p.won || p.won <= 0) return noData(`ningún deal ganado en ${p.period}`);
  return real(p.cost / p.won);
}

/** Company CAC: the same rule over every cost of the period and every deal won in it, with or without segment (D11). */
export function companyCac(p: { cost: number | null; won: number; period: string }): Figure {
  return cacOf(p);
}

/** Planned CAC = planned acquisition / planned new customers, with the state «plan». */
export function planCacOf(p: {
  acquisition: number | null;
  newCustomers: number | null;
  period: string;
}): PlanFigure {
  if (!p.acquisition || p.acquisition <= 0)
    return { value: null, state: "sin_dato", reason: `sin plan de captación en ${p.period}` };
  if (!p.newCustomers || p.newCustomers <= 0)
    return { value: null, state: "sin_dato", reason: `sin clientes presupuestados en ${p.period}` };
  return { value: p.acquisition / p.newCustomers, state: "plan", reason: null };
}

/**
 * Payback (months) = CAC / (ACV × margin / 12). Null with the reason of the first input without data (CAC, ACV,
 * margin), or «margen 0 % o negativo»; «estimado» when an input is, with their reasons. Never Infinity, NaN or < 0.
 */
export function paybackOf<C extends Figure | PlanFigure>(p: {
  cac: C;
  acv: Figure;
  margin: Figure;
}): C extends PlanFigure ? PlanFigure : Figure;
export function paybackOf(p: {
  cac: Figure | PlanFigure;
  acv: Figure;
  margin: Figure;
}): Figure | PlanFigure {
  for (const f of [p.cac, p.acv, p.margin]) if (!has(f)) return noData(f.reason ?? "falta un dato");
  const cac = p.cac.value!,
    acv = p.acv.value!,
    margin = p.margin.value!;
  if (!Number.isFinite(margin) || margin <= 0) return noData("margen 0 % o negativo");
  if (!Number.isFinite(acv) || acv <= 0) return noData("falta ACV");
  if (!Number.isFinite(cac) || cac <= 0) return noData("falta CAC real");
  const months = (cac * 12) / ((acv * margin) / 100);
  const reasons = [
    ...new Set(
      [p.cac, p.acv, p.margin]
        .filter((f) => f.state === "estimado")
        .map((f) => f.reason!)
        .filter(Boolean),
    ),
  ];
  if (p.cac.state === "plan")
    return { value: months, state: "plan", reason: reasons.length ? reasons.join(", ") : null };
  return reasons.length ? estimated(months, reasons.join(", ")) : real(months);
}

export type AcvFigure = Figure & {
  source: "ganados" | "abiertos" | "rango" | null;
  sample: number;
};

/**
 * ACV behind a payback, from the deals already assigned to the segment: average won deal → average open deal
 * («Estimado · media de deals abiertos») → midpoint of its range («Estimado · punto medio del rango»). A minimum
 * without maximum or no range at all gives no ACV.
 */
export function acvFor(seg: SegLike, deals: DealLike[]): AcvFigure {
  const priced = (xs: DealLike[]) => xs.filter((d) => Number(d.amount) > 0);
  const avg = (xs: DealLike[]) => xs.reduce((s, d) => s + Number(d.amount), 0) / xs.length;
  const won = priced(deals.filter((d) => d.stage === "won"));
  if (won.length)
    return { ...real(avg(won), "media de ganados"), source: "ganados", sample: won.length };
  const open = priced(deals.filter((d) => d.stage !== "won" && d.stage !== "lost"));
  if (open.length)
    return {
      ...estimated(avg(open), "media de deals abiertos"),
      source: "abiertos",
      sample: open.length,
    };
  if (seg.acv_min == null && seg.acv_max == null)
    return { ...noData("falta rango de ACV"), source: null, sample: 0 };
  if (seg.acv_max == null)
    return { ...noData("falta el máximo del rango de ACV"), source: null, sample: 0 };
  const mid = (Number(seg.acv_min ?? 0) + Number(seg.acv_max)) / 2;
  return { ...estimated(mid, "punto medio del rango"), source: "rango", sample: 0 };
}

export type MarginFigure = Figure & { source: MarginSource | null };

export const MARGIN_REASON: Record<MarginSource, string> = {
  real: "margen real",
  deals: "margen de los deals ganados",
  plan: "margen presupuestado",
  objetivo: "margen objetivo",
};

const periodEnd = (period: string) =>
  period.includes("-Q")
    ? quarterRange(period).end
    : new Date(Date.UTC(Number(period.slice(0, 4)) + 1, 0, 1));

/**
 * The one margin chain behind every payback (M1): the budget's real margin (quarter, then its year) → the margin of
 * the deals won with product lines in the 12 months before the period ends → the planned margin (quarter, then
 * year) → the segment's target. Nothing in the chain → «Sin dato · falta margen». `period` is "2026-Q3" or "2026";
 * pass the quarterly `rows`, or the annual `budgets` (already summed) for a year.
 */
export function segmentMargin(
  seg: SegLike,
  p: {
    period: string;
    rows?: QuarterBudgetLike[];
    budgets?: BudgetLike[];
    deals: MarginDeal[];
    segments: SegLike[];
  },
): MarginFigure {
  const year = Number(p.period.slice(0, 4));
  const chain: (BudgetValues | undefined)[] = p.budgets
    ? [p.budgets.find((b) => b.segment_id === seg.id && b.year === year)]
    : [
        p.period.includes("-Q")
          ? (p.rows ?? []).find((r) => r.segment_id === seg.id && r.period === p.period)
          : undefined,
        annualFromQuarters(p.rows ?? [], year).find((b) => b.segment_id === seg.id),
      ];
  const sold = wonDealsMargin(p.deals, periodEnd(p.period), p.segments).bySegment[seg.id];
  return marginOfChain(seg, chain, sold);
}

/**
 * Core of the chain once the budgets (in priority order) and the margin of the won deals with lines are known: a
 * real budget margin → the deals' margin → a planned margin → the target. segmentMargin and the older helpers
 * withPeriodMargin / withBudgetMargin (segment-budget.ts) all end here, so there is one chain.
 */
export function marginOfChain(
  seg: SegLike,
  budgets: (BudgetValues | undefined)[],
  sold?: { pct: number } | null,
): MarginFigure {
  const m = marginFor(seg, ...budgets);
  const used = m.source !== "real" && sold ? { pct: sold.pct, source: "deals" as const } : m;
  if (used.pct == null || used.source == null) return { ...noData("falta margen"), source: null };
  return { ...real(used.pct, MARGIN_REASON[used.source]), source: used.source };
}

/** Margin of a planned payback: the budget's planned margin, else the segment's target (segment-budget.ts:238). */
export function planMarginOf(
  seg: SegLike,
  budget: (BudgetValues & { plan_margin?: number | null }) | undefined,
): Figure {
  const plan = budgetMargin(budget, "plan");
  if (plan != null) return real(plan, MARGIN_REASON.plan);
  if (seg.gross_margin_pct != null)
    return real(Number(seg.gross_margin_pct), MARGIN_REASON.objetivo);
  return noData("falta margen");
}

export type CompanyPayback = (Figure | PlanFigure) & { k: number; m: number };

/**
 * The one company payback: average of the segment paybacks weighted by their customers, over the m segments with
 * customers, k of which have a payback. k < m → «Estimado · calculado sobre {k} de {m} segmentos con clientes».
 * With planned paybacks (weighted by planned customers) the state is «plan» and the same k-of-m reason.
 */
export function companyPayback(
  rows: { payback: Figure | PlanFigure; customers: number | null }[],
): CompanyPayback {
  const withCustomers = rows.filter((r) => (r.customers ?? 0) > 0);
  const ok = withCustomers.filter((r) => has(r.payback));
  const k = ok.length,
    m = withCustomers.length;
  if (!k) return { ...noData("ningún segmento con payback"), k, m };
  const w = ok.reduce((s, r) => s + r.customers!, 0);
  const value = ok.reduce((s, r) => s + r.payback.value! * r.customers!, 0) / w;
  const partial = k < m ? `calculado sobre ${k} de ${m} segmentos con clientes` : null;
  // Real paybacks carry no reason; estimated and planned ones carry the reasons of their inputs.
  const reasons = [...new Set(ok.map((r) => r.payback.reason).filter((x): x is string => !!x))];
  if (ok.some((r) => r.payback.state === "plan"))
    return { value, state: "plan", reason: partial ?? (reasons.join(", ") || null), k, m };
  if (partial) return { ...estimated(value, partial), k, m };
  return { ...(reasons.length ? estimated(value, reasons.join(", ")) : real(value)), k, m };
}
