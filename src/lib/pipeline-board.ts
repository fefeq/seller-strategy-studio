// Whole pipeline on one board: open leads → opportunities → deals in progress → won in the quarter,
// plus what it means for the real CAC and payback. Pure so the panel and future AI snapshots agree.
import { delayText, leadDelay, type LeadSla } from "@/lib/lead-funnel";
import { capacityPlan } from "@/lib/metrics";
import { openStages, type Stage } from "@/lib/stages";

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
export function closingIn(deals: BoardDeal[], range: { start: Date; end: Date }) {
  return deals.filter(
    (d) =>
      d.stage !== "won" &&
      d.stage !== "lost" &&
      !!d.close_date &&
      inRange(new Date(`${d.close_date}T12:00:00Z`).getTime(), range),
  );
}

export type BoardMarginSource = "real" | "deals" | "plan" | "media_objetivos" | null;

/**
 * Margin of the board's payback: real margin of the books → won deals with product lines → plan → unweighted
 * mean of the segment target margins (the chain the panel used, same pct), plus which one it was and whether it
 * is 0 % or negative (then the payback is Infinity or negative and the screen shows «Sin dato»).
 */
export function boardMargin(
  k: { actual: { margin: number | null }; plan: { margin: number | null } },
  wonAll: { pct: number } | null | undefined,
  segments: { gross_margin_pct: number | string | null }[],
): { pct: number | null; source: BoardMarginSource; marginNonPositive: boolean } {
  const segMargins = segments
    .map((s) => s.gross_margin_pct)
    .filter((x): x is number | string => x != null)
    .map(Number);
  const [pct, source]: [number | null, BoardMarginSource] =
    k.actual.margin != null
      ? [k.actual.margin, "real"]
      : wonAll?.pct != null
        ? [wonAll.pct, "deals"]
        : k.plan.margin != null
          ? [k.plan.margin, "plan"]
          : segMargins.length
            ? [segMargins.reduce((a, b) => a + b, 0) / segMargins.length, "media_objetivos"]
            : [null, null];
  return { pct, source, marginNonPositive: pct != null && pct <= 0 };
}

/**
 * Real CAC = acquisition cost of the quarter / deals won in it. Projected CAC adds the open deals closing
 * in the quarter at the real win rate. Payback = CAC / (ACV × margin / 12); null without ACV or margin.
 */
export function pipelineEconomics(p: {
  cost: number | null;
  won: number;
  closing: number;
  winRatePct: number | null;
  acv: number | null;
  marginPct: number | null;
}) {
  const expectedWins = p.won + (p.winRatePct != null ? (p.closing * p.winRatePct) / 100 : 0);
  const realCac = p.cost && p.won ? p.cost / p.won : null;
  const projectedCac =
    p.cost && expectedWins && p.winRatePct != null && p.closing ? p.cost / expectedWins : null;
  const payback = (cac: number | null) =>
    cac != null && p.acv && p.marginPct != null
      ? capacityPlan({ acv: p.acv, cac, grossMarginPct: p.marginPct }).paybackMonths
      : null;
  return {
    expectedWins,
    realCac,
    projectedCac,
    realPayback: payback(realCac),
    projectedPayback: payback(projectedCac),
  };
}
