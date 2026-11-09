// Whole pipeline on one board: open leads → opportunities → deals in progress → won in the quarter,
// plus what it means for the real CAC. Pure so the panel and future AI snapshots agree. The board's CAC is the
// company CAC of the KPI and its payback is the KPI's (src/lib/unit-economics.ts, SDD-20261109 D10, D11).
import { delayText, leadDelay, type LeadSla } from "@/lib/lead-funnel";
import { quarterRange } from "@/lib/metrics";
import { openStages, type Stage } from "@/lib/stages";
import { actuals } from "@/lib/pipeline-real";
import { quarterKpis } from "@/lib/quarter-kpis";
import type { QuarterBudgetLike } from "@/lib/segment-budget";
import type { DealLike, SegLike } from "@/lib/segment-coverage";
import type { CostLike } from "@/lib/cac";
import { cacOf, companyCac, estimated, noData, type Figure } from "@/lib/unit-economics";

export type BoardLead = {
  id: string;
  company: string;
  contact_name: string | null;
  owner_id: string | null;
  stage: string;
  stage_entered_at: string;
  next_step_at: string | null;
  amount: number | null;
};
export type BoardDeal = {
  id: string;
  name: string;
  owner_id: string | null;
  stage: string;
  amount: number | null;
  close_date: string | null;
  closed_at: string | null;
  updated_at: string;
};

export type BoardItem = {
  id: string;
  kind: "lead" | "deal";
  name: string;
  detail: string | null;
  ownerId: string | null;
  amount: number | null;
  since: string | null;
  late: boolean;
  lateText: string | null;
};
export type BoardColumn = {
  stage: string;
  label: string;
  items: BoardItem[];
  count: number;
  amount: number;
};
export type BoardGroup = {
  id: "leads" | "opportunities" | "progress" | "won";
  label: string;
  columns: BoardColumn[];
  count: number;
  amount: number;
};

/** Lead stages before the deal exists (an "Oportunidad" lead already has its deal in the first open stage). */
const LEAD_COLS = [
  ["new", "Nuevo"],
  ["contacted", "Contactado"],
  ["mql", "MQL"],
  ["sql", "SQL"],
] as const;

const DAY = 86_400_000;
const closedAt = (d: BoardDeal) => new Date(d.closed_at ?? d.updated_at).getTime();
const inRange = (t: number, r: { start: Date; end: Date }) =>
  t >= r.start.getTime() && t < r.end.getTime();

function column(stage: string, label: string, items: BoardItem[]): BoardColumn {
  return {
    stage,
    label,
    items,
    count: items.length,
    amount: items.reduce((s, i) => s + Number(i.amount ?? 0), 0),
  };
}
function group(id: BoardGroup["id"], label: string, columns: BoardColumn[]): BoardGroup {
  return {
    id,
    label,
    columns,
    count: columns.reduce((s, c) => s + c.count, 0),
    amount: columns.reduce((s, c) => s + c.amount, 0),
  };
}

function dealItem(d: BoardDeal, now: Date): BoardItem {
  // An open deal whose close date has passed is late: it should be closed or re-dated.
  const overdue = !!d.close_date && new Date(`${d.close_date}T23:59:59Z`).getTime() < now.getTime();
  const days = overdue
    ? Math.floor((now.getTime() - new Date(`${d.close_date}T23:59:59Z`).getTime()) / DAY) + 1
    : 0;
  return {
    id: d.id,
    kind: "deal",
    name: d.name,
    detail: d.close_date ? `cierre ${d.close_date}` : "sin fecha de cierre",
    ownerId: d.owner_id,
    amount: d.amount,
    since: d.close_date,
    late: overdue,
    lateText: overdue ? `cierre vencido hace ${days} d` : null,
  };
}

/**
 * Leads still open, opportunities, deals in progress and deals won in `range`.
 * Leads are ordered by time waiting in their stage (oldest first); deals by close date (soonest first).
 */
export function pipelineBoard(
  leads: BoardLead[],
  deals: BoardDeal[],
  range: { start: Date; end: Date },
  sla: LeadSla,
  now = new Date(),
  stages?: Stage[] | null,
): BoardGroup[] {
  const leadCol = (stage: string, label: string) =>
    column(
      stage,
      label,
      leads
        .filter((l) => l.stage === stage)
        .sort((a, b) => a.stage_entered_at.localeCompare(b.stage_entered_at))
        .map((l) => {
          const d = leadDelay(l, sla, now);
          return {
            id: l.id,
            kind: "lead" as const,
            name: l.company,
            detail: l.contact_name,
            ownerId: l.owner_id,
            amount: l.amount,
            since: l.stage_entered_at,
            late: d.late,
            lateText: d.late ? delayText(d) : null,
          };
        }),
    );
  const open = openStages(stages);
  const byClose = (a: BoardDeal, b: BoardDeal) =>
    (a.close_date ?? "9999").localeCompare(b.close_date ?? "9999");
  const dealCol = (stage: string, label: string) =>
    column(
      stage,
      label,
      deals
        .filter((d) => d.stage === stage)
        .sort(byClose)
        .map((d) => dealItem(d, now)),
    );
  const won = deals
    .filter((d) => d.stage === "won" && inRange(closedAt(d), range))
    .sort((a, b) => closedAt(b) - closedAt(a))
    .map((d): BoardItem => ({
      id: d.id,
      kind: "deal",
      name: d.name,
      detail: `ganado ${new Date(closedAt(d)).toISOString().slice(0, 10)}`,
      ownerId: d.owner_id,
      amount: d.amount,
      since: d.closed_at,
      late: false,
      lateText: null,
    }));

  return [
    group(
      "leads",
      "Leads",
      LEAD_COLS.map(([s, l]) => leadCol(s, l)),
    ),
    group(
      "opportunities",
      "Oportunidades",
      open.filter((s) => s.board_group === "opportunity").map((s) => dealCol(s.key, s.label)),
    ),
    group(
      "progress",
      "Deals en proceso",
      open.filter((s) => s.board_group !== "opportunity").map((s) => dealCol(s.key, s.label)),
    ),
    group("won", "Ganados", [column("won", "Ganados", won)]),
  ];
}

/** Open deals (any open stage) whose close date falls in the quarter: the ones that can still lower its CAC. */
export function closingIn<T extends { stage: string; close_date: string | null }>(
  deals: T[],
  range: { start: Date; end: Date },
) {
  return deals.filter(
    (d) =>
      d.stage !== "won" &&
      d.stage !== "lost" &&
      !!d.close_date &&
      inRange(new Date(`${d.close_date}T12:00:00Z`).getTime(), range),
  );
}

export const PROJECTION_REASON = "proyección con win rate de los últimos 365 días";

/**
 * Real CAC = acquisition cost of the quarter / every deal won in it (companyCac). Projected CAC = the same cost over
 * the deals won plus the open ones closing in the quarter at the real win rate of the last 365 days: cacOf, then
 * «Estimado · proyección con win rate de los últimos 365 días». No payback of its own (D10): the board shows the KPI's.
 */
export function pipelineEconomics(p: {
  cost: number | null;
  won: number;
  closing: number;
  winRatePct: number | null;
  period: string;
}) {
  const expectedWins = p.won + (p.winRatePct != null ? (p.closing * p.winRatePct) / 100 : 0);
  const realCac = companyCac({ cost: p.cost, won: p.won, period: p.period });
  const projection = cacOf({ cost: p.cost, won: expectedWins, period: p.period });
  const projectedCac: Figure =
    projection.value == null
      ? projection
      : p.winRatePct == null
        ? noData("sin win rate de los últimos 365 días")
        : estimated(projection.value, PROJECTION_REASON);
  return {
    expectedWins,
    realCac: realCac.value,
    projectedCac: projectedCac.value,
    figures: { realCac, projectedCac },
  };
}

/**
 * What the board's economics strip shows for a quarter, in one pure function: spend (every cost of the quarter),
 * won deals, open deals closing in it, real figures of the last 365 days, real and projected CAC, and the company
 * payback of the KPI (quarterKpis), so the board and the KPI can never disagree (CA-3).
 */
export function boardEconomics(p: {
  deals: DealLike[];
  segments: SegLike[];
  budgets: QuarterBudgetLike[];
  costs: (CostLike & { period?: string })[];
  quarter: string;
  now?: Date;
}) {
  const range = quarterRange(p.quarter);
  const costs = p.costs
    .filter((c) => c.period == null || c.period === p.quarter)
    .map((c) => ({ ...c, period: p.quarter }));
  const [kpi] = quarterKpis(p.segments, p.deals, p.budgets, costs, [p.quarter]);
  const cost = costs.reduce((s, c) => s + Number(c.amount || 0), 0) || null;
  const won = p.deals.filter(
    (d) => d.stage === "won" && inRange(new Date(d.closed_at ?? d.updated_at).getTime(), range),
  ).length;
  const closing = closingIn(p.deals, range);
  const real = actuals(p.deals, p.now);
  const eco = pipelineEconomics({
    cost,
    won,
    closing: closing.length,
    winRatePct: real.winRate,
    period: p.quarter,
  });
  return {
    kpi,
    cost,
    won,
    closing,
    real,
    expectedWins: eco.expectedWins,
    realCac: eco.figures.realCac,
    projectedCac: eco.figures.projectedCac,
    payback: kpi.figures.payback,
  };
}
