// Real vs target per segment for a quarter. Pure so the metrics dashboard and future AI snapshots agree.
import { capacityPlan, coverage, matchSegment, winRate } from "@/lib/metrics";
import { segmentCac, type CostLike } from "@/lib/cac";

export type SegLike = { id: string; name: string; acv_min: number | null; acv_max: number | null; win_rate_target: number | null; cac_target: number | null; gross_margin_pct: number | null; payback_months: number | null };
export type DealLike = { segment_id: string | null; amount: number | null; stage: string; close_date: string | null; closed_at: string | null; updated_at: string; created_at: string };

/** Typical ACV of a segment: average won deal → average open deal → midpoint of its ACV range. */
export function segmentAcv(seg: SegLike, deals: DealLike[]) {
  const avg = (xs: DealLike[]) => (xs.length ? xs.reduce((s, d) => s + Number(d.amount ?? 0), 0) / xs.length : 0);
  const won = deals.filter((d) => d.stage === "won" && Number(d.amount) > 0);
  if (won.length) return { acv: avg(won), source: "ganados" as const };
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost" && Number(d.amount) > 0);
  if (open.length) return { acv: avg(open), source: "abiertos" as const };
  const min = Number(seg.acv_min ?? 0);
  const max = seg.acv_max == null ? null : Number(seg.acv_max);
  const mid = max == null ? min * 1.5 : (min + max) / 2;
  return { acv: mid, source: "rango" as const };
}

/** Deal's segment: explicit segment_id, otherwise the segment whose ACV range covers the amount. */
export function assignSegment<T extends DealLike>(deal: T, segments: SegLike[]) {
  if (deal.segment_id && segments.some((s) => s.id === deal.segment_id)) return deal.segment_id;
  if (deal.amount == null) return null;
  return matchSegment(Number(deal.amount), segments)?.id ?? null;
}

export type SegmentCoverageRow = ReturnType<typeof segmentCoverage>[number];

/**
 * Payback uses the real CAC of the quarter (entered costs / deals won) when there is one,
 * otherwise the segment's target CAC; `payback.source` says which.
 */
export function segmentCoverage(segments: SegLike[], deals: DealLike[], targets: Record<string, number>, range: { start: Date; end: Date }, costs: CostLike[] = []) {
  const inQ = (s?: string | null) => !!s && new Date(s) >= range.start && new Date(s) < range.end;
  const wonIn = (segId: string) => deals.filter((d) => d.stage === "won" && assignSegment(d, segments) === segId && inQ(d.closed_at ?? d.updated_at)).length;
  const cacs = segmentCac(costs, Object.fromEntries(segments.map((s) => [s.id, wonIn(s.id)])), segments.map((s) => s.id));
  return segments.map((seg) => {
    const ds = deals.filter((d) => assignSegment(d, segments) === seg.id);
    const target = targets[seg.id] ?? 0;
    const { acv, source } = segmentAcv(seg, ds);
    const open = ds.filter((d) => d.stage !== "won" && d.stage !== "lost" && inQ(d.close_date));
    const pipeline = open.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const closed = ds.filter((d) => (d.stage === "won" || d.stage === "lost") && inQ(d.closed_at ?? d.updated_at));
    const wonQ = closed.filter((d) => d.stage === "won");
    const wonAmount = wonQ.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const created = ds.filter((d) => inQ(d.created_at)).length;
    const winTarget = seg.win_rate_target ? Number(seg.win_rate_target) : null;
    const dealsTarget = target && acv ? Math.ceil(target / acv) : null;
    const oppsTarget = dealsTarget != null && winTarget ? Math.ceil(dealsTarget / (winTarget / 100)) : null;
    const realWin = winRate(wonQ.length, closed.length - wonQ.length);
    const cac = cacs[seg.id];
    const cacTarget = seg.cac_target != null ? Number(seg.cac_target) : null;
    const cacUsed = cac.cac ?? cacTarget;
    const paybackSource = cac.cac != null ? ("real" as const) : cacTarget ? ("objetivo" as const) : null;
    const payback = capacityPlan({ acv, cac: cacUsed, grossMarginPct: seg.gross_margin_pct }).paybackMonths;
    return {
      segment: seg,
      acv, acvSource: source,
      target,
      pipeline,
      coverage: target ? coverage(pipeline, target) : null,
      won: { deals: wonQ.length, amount: wonAmount, target: dealsTarget, attainment: target ? wonAmount / target : null },
      opps: { created, open: open.length, target: oppsTarget },
      winRate: { real: closed.length ? realWin : null, target: winTarget, closed: closed.length },
      cac: { ...cac, real: cac.cac, target: cacTarget },
      payback: { real: payback, source: paybackSource, target: seg.payback_months != null ? Number(seg.payback_months) : null, ok: payback != null && seg.payback_months != null ? payback <= Number(seg.payback_months) : null },
    };
  });
}

export type QuarterPayback = {
  /** Months to recover the real CAC; null unless the quarter has both costs and deals won. */
  payback: number | null;
  cac: number | null;
  cost: number;
  customers: number;
  /** real = computed; no_wins = costs but nothing won; no_costs = nothing entered. */
  status: "real" | "no_wins" | "no_costs";
  ok: boolean | null;
};

/**
 * Real payback per segment for each quarter (only real CAC, never the target), against the segment's target payback.
 * `segmentsFor(q)` lets callers swap in the margin of that quarter's year budget (same order and ids as `segments`).
 */
export function paybackByQuarter(segments: SegLike[], deals: DealLike[], costs: (CostLike & { period: string })[], quarters: string[], rangeOf: (q: string) => { start: Date; end: Date }, segmentsFor: (q: string) => SegLike[] = () => segments) {
  const perQ = Object.fromEntries(quarters.map((q) => [q, segmentCoverage(segmentsFor(q), deals, {}, rangeOf(q), costs.filter((c) => c.period === q))]));
  return segments.map((seg, i) => {
    const target = seg.payback_months != null ? Number(seg.payback_months) : null;
    const byQuarter: Record<string, QuarterPayback> = {};
    for (const q of quarters) {
      const r = perQ[q][i];
      const real = r.payback.source === "real" ? r.payback.real : null;
      byQuarter[q] = {
        payback: real, cac: r.cac.real, cost: r.cac.cost, customers: r.cac.customers,
        status: real != null ? "real" : r.cac.cost > 0 ? "no_wins" : "no_costs",
        ok: real != null && target != null ? real <= target : null,
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
      segment: r.segment, target: r.target, quarter: real[0] ?? null, cell,
      trend: cell?.payback != null && prev?.payback != null ? cell.payback - prev.payback : null,
    };
  });
  const measured = latest.filter((l) => l.cell && l.target != null);
  return { latest, measured: measured.length, within: measured.filter((l) => l.cell!.ok).length };
}
