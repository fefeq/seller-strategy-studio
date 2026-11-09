// Real vs target per segment for a quarter. Pure so the metrics dashboard and future AI snapshots agree.
// CAC, ACV, margin and payback come from src/lib/unit-economics.ts (SDD-20261109-metrics-strategy-no-estimates).
import { coverage, matchSegment, winRate } from "@/lib/metrics";
import { segmentCac, sharedSplitBasis, type CostLike } from "@/lib/cac";
import {
  acvFor,
  paybackOf,
  segmentMargin,
  type AcvFigure,
  type Figure,
  type MarginFigure,
} from "@/lib/unit-economics";
import type { QuarterBudgetLike } from "@/lib/segment-budget";

export type SegLike = {
  id: string;
  name: string;
  acv_min: number | null;
  acv_max: number | null;
  win_rate_target: number | null;
  cac_target: number | null;
  gross_margin_pct: number | null;
  payback_months: number | null;
};
export type DealLike = {
  segment_id: string | null;
  amount: number | null;
  stage: string;
  close_date: string | null;
  closed_at: string | null;
  updated_at: string;
  created_at: string;
  /** Margin of a deal with product lines (deals.gross_margin); feeds the one margin chain. */
  gross_margin?: number | string | null;
};

/** Which range case gave (or did not give) the ACV; null when it comes from deals. */
export type RangeBasis = "punto_medio" | "sin_maximo" | "sin_rango" | null;

/**
 * Typical ACV of a segment through acvFor: average won deal → average open deal → midpoint of its ACV range.
 * A minimum without maximum, or no range, gives no ACV (null), never minimum × 1.5 or 0 (SDD-20261109 D3, D4).
 */
export function segmentAcv(seg: SegLike, deals: DealLike[]) {
  const f = acvFor(seg, deals);
  const rangeBasis: RangeBasis =
    f.source === "ganados" || f.source === "abiertos"
      ? null
      : seg.acv_min == null && seg.acv_max == null
        ? "sin_rango"
        : seg.acv_max == null
          ? "sin_maximo"
          : "punto_medio";
  return {
    acv: f.value,
    source: (f.source ?? "rango") as "ganados" | "abiertos" | "rango",
    rangeBasis,
    figure: f,
  };
}

/** "2026-Q3" for a quarter range (UTC), the period that reasons and the margin chain read. */
export function periodOfRange(range: { start: Date }) {
  return `${range.start.getUTCFullYear()}-Q${Math.floor(range.start.getUTCMonth() / 3) + 1}`;
}

/** Assigned by amount: no segment_id, or one that points to a segment that no longer exists (as won-deals.ts). */
export function assignedByAmount(deal: { segment_id: string | null }, segments: { id: string }[]) {
  return !(deal.segment_id && segments.some((s) => s.id === deal.segment_id));
}

/** Deal's segment: explicit segment_id, otherwise the segment whose ACV range covers the amount. */
export function assignSegment<T extends DealLike>(deal: T, segments: SegLike[]) {
  if (deal.segment_id && segments.some((s) => s.id === deal.segment_id)) return deal.segment_id;
  if (deal.amount == null) return null;
  return matchSegment(Number(deal.amount), segments)?.id ?? null;
}

export type SegmentCoverageRow = ReturnType<typeof segmentCoverage>[number];

/** The figures of a row, with state and reason, read the same by every surface (CA-3). */
export type RowFigures = { acv: AcvFigure; margin: MarginFigure; cac: Figure; payback: Figure };

/**
 * Real vs target per segment for a quarter. Payback only with the real CAC of the quarter (never the target CAC,
 * D9), the ACV of acvFor and the margin of the one chain (segmentMargin with `budgetRows` and the deals' margins).
 */
export function segmentCoverage(
  segments: SegLike[],
  deals: DealLike[],
  targets: Record<string, number>,
  range: { start: Date; end: Date },
  costs: CostLike[] = [],
  budgetRows: QuarterBudgetLike[] = [],
) {
  const period = periodOfRange(range);
  const inQ = (s?: string | null) => !!s && new Date(s) >= range.start && new Date(s) < range.end;
  const wonIn = (segId: string) =>
    deals.filter(
      (d) =>
        d.stage === "won" &&
        assignSegment(d, segments) === segId &&
        inQ(d.closed_at ?? d.updated_at),
    ).length;
  const customers = Object.fromEntries(segments.map((s) => [s.id, wonIn(s.id)]));
  const ids = segments.map((s) => s.id);
  const cacs = segmentCac(costs, customers, ids, period);
  const sharedSplit = sharedSplitBasis(costs, customers, ids);
  return segments.map((seg) => {
    const ds = deals.filter((d) => assignSegment(d, segments) === seg.id);
    const target = targets[seg.id] ?? 0;
    const acv = segmentAcv(seg, ds);
    const margin = segmentMargin(seg, { period, rows: budgetRows, deals, segments });
    const open = ds.filter((d) => d.stage !== "won" && d.stage !== "lost" && inQ(d.close_date));
    const pipeline = open.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const closed = ds.filter(
      (d) => (d.stage === "won" || d.stage === "lost") && inQ(d.closed_at ?? d.updated_at),
    );
    const wonQ = closed.filter((d) => d.stage === "won");
    const wonAmount = wonQ.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const created = ds.filter((d) => inQ(d.created_at)).length;
    const winTarget = seg.win_rate_target ? Number(seg.win_rate_target) : null;
    const dealsTarget = target && acv.acv ? Math.ceil(target / acv.acv) : null;
    const oppsTarget =
      dealsTarget != null && winTarget ? Math.ceil(dealsTarget / (winTarget / 100)) : null;
    const realWin = winRate(wonQ.length, closed.length - wonQ.length);
    const cac = cacs[seg.id];
    const cacTarget = seg.cac_target != null ? Number(seg.cac_target) : null;
    const payback = paybackOf({ cac: cac.figure, acv: acv.figure, margin });
    const paybackTarget = seg.payback_months != null ? Number(seg.payback_months) : null;
    return {
      segment: seg,
      acv: acv.acv,
      acvSource: acv.source,
      target,
      pipeline,
      coverage: target ? coverage(pipeline, target) : null,
      won: {
        deals: wonQ.length,
        amount: wonAmount,
        target: dealsTarget,
        attainment: target ? wonAmount / target : null,
      },
      opps: { created, open: open.length, target: oppsTarget },
      winRate: { real: closed.length ? realWin : null, target: winTarget, closed: closed.length },
      cac: { ...cac, real: cac.cac, target: cacTarget },
      payback: {
        real: payback.value,
        state: payback.state,
        reason: payback.reason,
        target: paybackTarget,
        ok: payback.value != null && paybackTarget != null ? payback.value <= paybackTarget : null,
      },
      figures: { acv: acv.figure, margin, cac: cac.figure, payback } as RowFigures,
      acvRangeBasis: acv.rangeBasis,
      assignedDeals: ds.length,
      inferredDeals: ds.filter((d) => assignedByAmount(d, segments)).length,
      wonInQuarter: wonQ.length,
      inferredWon: wonQ.filter((d) => assignedByAmount(d, segments)).length,
      sharedSplit,
    };
  });
}

export type QuarterPayback = {
  /** Months to recover the real CAC; null unless the quarter has costs, deals won, an ACV and a positive margin. */
  payback: number | null;
  cac: number | null;
  cost: number;
  customers: number;
  /** real = there is a payback (real or estimated); no_wins = costs but nothing won; no_costs = nothing entered;
   * sin_dato = a real CAC but no ACV or margin. */
  status: "real" | "no_wins" | "no_costs" | "sin_dato";
  ok: boolean | null;
  figures: RowFigures;
  wonInQuarter: number;
  inferredWon: number;
};

/**
 * Real payback per segment for each quarter (only real CAC, never the target), against the segment's target payback.
 * Each quarter runs segmentCoverage with its own costs and the budget rows, so the margin is the one chain.
 */
export function paybackByQuarter(
  segments: SegLike[],
  deals: DealLike[],
  costs: (CostLike & { period: string })[],
  quarters: string[],
  rangeOf: (q: string) => { start: Date; end: Date },
  budgetRows: QuarterBudgetLike[] = [],
) {
  const perQ = Object.fromEntries(
    quarters.map((q) => [
      q,
      segmentCoverage(
        segments,
        deals,
        {},
        rangeOf(q),
        costs.filter((c) => c.period === q),
        budgetRows,
      ),
    ]),
  );
  return segments.map((seg, i) => {
    const target = seg.payback_months != null ? Number(seg.payback_months) : null;
    const byQuarter: Record<string, QuarterPayback> = {};
    for (const q of quarters) {
      const r = perQ[q][i];
      const real = r.payback.real;
      byQuarter[q] = {
        payback: real,
        cac: r.cac.real,
        cost: r.cac.cost,
        customers: r.cac.customers,
        status:
          real != null
            ? "real"
            : r.cac.real != null
              ? "sin_dato"
              : r.figures.cac.reason?.startsWith("ningún")
                ? "no_wins"
                : "no_costs",
        ok: real != null && target != null ? real <= target : null,
        figures: r.figures,
        wonInQuarter: r.wonInQuarter,
        inferredWon: r.inferredWon,
      };
    }
    return { segment: seg, target, byQuarter };
  });
}

/**
 * Dashboard summary of paybackByQuarter: per segment the latest quarter with a real payback (and the one before,
 * for the trend), plus how many measured segments are within their target.
 */
export function paybackSummary(rows: ReturnType<typeof paybackByQuarter>, quarters: string[]) {
  const latest = rows.map((r) => {
    const real = [...quarters].reverse().filter((q) => r.byQuarter[q].status === "real");
    const cell = real[0] ? r.byQuarter[real[0]] : null;
    const prev = real[1] ? r.byQuarter[real[1]] : null;
    return {
      segment: r.segment,
      target: r.target,
      quarter: real[0] ?? null,
      cell,
      trend: cell?.payback != null && prev?.payback != null ? cell.payback - prev.payback : null,
    };
  });
  const measured = latest.filter((l) => l.cell && l.target != null);
  return { latest, measured: measured.length, within: measured.filter((l) => l.cell!.ok).length };
}
