// F1 · Segment rules: CA-14 costs missing, CA-15 two quarters under healthy coverage, CA-16 open deals without segment. No AI (CA-24).
import { coverage, quarterRange } from "@/lib/metrics";
import { assignSegment, type SegLike } from "@/lib/segment-coverage";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";
import type { Detector } from "../types";
import { OPEN } from "../types";

const nextQuarter = (q: string) => { const [y, n] = q.split("-Q").map(Number); return n === 4 ? `${y + 1}-Q1` : `${y}-Q${n + 1}`; };

/** CA-14: a segment with a payback or CAC target and no costs loaded → ask for the costs. Never shows a projected payback. */
export const segmentCostsMissing: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  return s.segments.flatMap((seg) => {
    if (seg.cac_target == null && seg.payback_months == null) return [];
    if (d.costs.some((c) => c.segment_id === seg.id)) return [];
    return [buildStrategySuggestion({
      element: "segment", kind: "missing_data", action_type: "data_to_complete", cause: `costs_missing:${seg.id}`, priority: 3,
      title: `Carga los costes de adquisición del segmento «${seg.name}»`,
      body: `El segmento tiene objetivo de payback o de coste de adquisición, pero no hay costes cargados. Sin ellos no se calcula el payback real.`,
      evidence: [{ table: "segments", id: seg.id, label: seg.name }], link: "/strategy?tab=motions",
    })];
  });
};

/**
 * CA-15: coverage under the healthy range (3x, as the rest of NOKKO) in the current and the next quarter, against the planned revenue of the segment.
 * The history of past coverage is not stored, so «two quarters» are the current and the next one.
 */
export const segmentLowCoverage: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  const q1 = s.setup.quarter, q2 = nextQuarter(q1);
  const segs = s.segments as unknown as SegLike[];
  return s.segments.flatMap((seg) => {
    const plan = (q: string) => Number(d.budgets.find((b) => b.segment_id === seg.id && b.period === q)?.plan_revenue ?? 0);
    const mine = d.deals.filter((x) => OPEN(x.stage) && assignSegment({ ...x, closed_at: x.closed_at }, segs) === seg.id);
    const per = [q1, q2].map((q) => {
      const { start, end } = quarterRange(q);
      const inQ = mine.filter((x) => x.close_date && new Date(x.close_date) >= start && new Date(x.close_date) < end);
      const pipeline = inQ.reduce((a, x) => a + Number(x.amount ?? 0), 0);
      return { q, target: plan(q), status: plan(q) ? coverage(pipeline, plan(q)).status : null, deals: inQ };
    });
    if (!per.every((p) => p.target > 0 && p.status === "low")) return [];
    const evidence = [{ table: "segments", id: seg.id, label: seg.name }, ...per.flatMap((p) => p.deals.map((x) => ({ table: "deals", id: x.id, label: x.name })))];
    return [buildStrategySuggestion({
      element: "segment", kind: "change", action_type: "strategy_change", cause: `low_coverage:${seg.id}:${q1}`, priority: 2,
      title: `El segmento «${seg.name}» tiene cobertura baja en ${q1} y en ${q2}`,
      body: `La cobertura queda por debajo de 3 veces el objetivo del trimestre en los dos trimestres. Revisa el objetivo, el segmento o el esfuerzo asignado.`,
      evidence, sample_size: Math.max(mine.length, evidence.length), link: "/strategy?tab=motions",
    })];
  });
};

/** CA-16: open deals with no segment (neither set nor inferable from the ACV range) → assign them. Lists them. */
export const dealsWithoutSegment: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  const segs = s.segments as unknown as SegLike[];
  const open = d.deals.filter((x) => OPEN(x.stage));
  const orphan = open.filter((x) => assignSegment(x, segs) == null);
  if (!orphan.length) return [];
  return [buildStrategySuggestion({
    element: "segment", kind: "change", action_type: "data_to_complete", cause: "deals_without_segment", priority: 3,
    title: `${orphan.length} ${orphan.length === 1 ? "deal abierto no tiene" : "deals abiertos no tienen"} segmento`,
    body: `Asígnales un segmento para que cuenten en la cobertura y en el payback. Están listados en la evidencia.`,
    evidence: orphan.map((x) => ({ table: "deals", id: x.id, label: x.name })), sample_size: open.length, link: "/deals",
  })];
};
