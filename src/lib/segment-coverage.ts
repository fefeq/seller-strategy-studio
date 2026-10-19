// Real vs target per segment for a quarter. Pure so the metrics dashboard and future AI snapshots agree.
import { capacityPlan, coverage, matchSegment, winRate } from "@/lib/metrics";

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

export function segmentCoverage(segments: SegLike[], deals: DealLike[], targets: Record<string, number>, range: { start: Date; end: Date }) {
  const inQ = (s?: string | null) => !!s && new Date(s) >= range.start && new Date(s) < range.end;
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
    const payback = capacityPlan({ acv, cac: seg.cac_target, grossMarginPct: seg.gross_margin_pct }).paybackMonths;
    return {
      segment: seg,
      acv, acvSource: source,
      target,
      pipeline,
      coverage: target ? coverage(pipeline, target) : null,
      won: { deals: wonQ.length, amount: wonAmount, target: dealsTarget, attainment: target ? wonAmount / target : null },
      opps: { created, open: open.length, target: oppsTarget },
      winRate: { real: closed.length ? realWin : null, target: winTarget },
      payback: { real: payback, target: seg.payback_months != null ? Number(seg.payback_months) : null, ok: payback != null && seg.payback_months != null ? payback <= Number(seg.payback_months) : null },
    };
  });
}
