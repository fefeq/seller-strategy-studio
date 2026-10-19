import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { segmentActuals } from "@/lib/pipeline-real";
import { segmentCoverage, type SegLike } from "@/lib/segment-coverage";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { mcpCtx, json } from "../context";

const round = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);

export const realMetrics = defineTool({
  name: "get_real_metrics",
  title: "Real pipeline metrics",
  description: "ACV, win rate y ciclo de venta reales (últimos 12 meses), total y por segmento, frente a los objetivos del segmento.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    const c = await mcpCtx(ctx);
    const [{ data: segs }, { data: deals }] = await Promise.all([
      c.db.from("segments").select("*").eq("org_id", c.orgId),
      c.db.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at").eq("org_id", c.orgId),
    ]);
    const r = segmentActuals((segs ?? []) as SegLike[], deals ?? []);
    return json({
      company: c.orgName, currency: c.currency,
      overall: { acv: round(r.overall.acv), win_rate_pct: round(r.overall.winRate), cycle_days: r.overall.cycleDays, closed_deals: r.overall.closedSample },
      segments: (segs ?? []).map((s) => ({ name: s.name, acv_real: round(r.bySegment[s.id]?.acv), win_rate_real: round(r.bySegment[s.id]?.winRate), win_rate_target: s.win_rate_target, cycle_real: r.bySegment[s.id]?.cycleDays, cycle_target: s.cycle_days })),
    });
  },
});

export const segmentCoverageTool = defineTool({
  name: "get_segment_coverage",
  title: "Segment coverage",
  description: "Cobertura de pipeline, deals ganados, oportunidades, win rate y payback por segmento frente al objetivo del trimestre.",
  inputSchema: { quarter: z.string().regex(/^\d{4}-Q[1-4]$/).optional().describe("Trimestre AAAA-QN; por defecto el actual") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ quarter }, ctx) => {
    const c = await mcpCtx(ctx);
    const q = quarter ?? quarterOf(new Date());
    const range = quarterRange(q);
    if (!range) throw new ToolError("Trimestre no válido");
    const [{ data: segs }, { data: deals }, { data: targets }] = await Promise.all([
      c.db.from("segments").select("*").eq("org_id", c.orgId),
      c.db.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at").eq("org_id", c.orgId),
      c.db.from("segment_targets").select("segment_id,amount").eq("org_id", c.orgId).eq("period", q),
    ]);
    const t = Object.fromEntries((targets ?? []).map((x) => [x.segment_id, Number(x.amount)]));
    const rows = segmentCoverage((segs ?? []) as SegLike[], deals ?? [], t, range);
    return json({ quarter: q, currency: c.currency, segments: rows.map((r) => ({ name: r.segment.name, target: r.target, pipeline: r.pipeline, coverage: r.coverage, won: r.won, opportunities: r.opps, win_rate: r.winRate, payback: r.payback })) });
  },
});
