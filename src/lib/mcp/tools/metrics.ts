import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { segmentActuals } from "@/lib/pipeline-real";
import { segmentCoverage, type SegLike } from "@/lib/segment-coverage";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { costByChannel } from "@/lib/cac";
import { quarterlyBudget, quartersOfYear } from "@/lib/segment-budget";
import { mcpCtx, json } from "../context";

const round = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);

export const realMetrics = defineTool({
  name: "get_real_metrics",
  title: "Métricas reales de pipeline",
  description: "ACV, win rate y ciclo de venta reales (últimos 12 meses), total y por segmento, frente a los objetivos del segmento.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    const c = await mcpCtx(ctx);
    const [{ data: segs }, { data: deals }] = await Promise.all([
      c.db.from("segments").select("*").eq("org_id", c.orgId),
      c.db.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at,gross_margin").eq("org_id", c.orgId),
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
  title: "Cobertura por segmento",
  description: "Cobertura de pipeline, deals ganados, oportunidades, win rate, CAC real (costes introducidos / deals ganados), margen bruto del presupuesto y payback por segmento frente al objetivo del trimestre, más el presupuesto del trimestre y del año (ingresos, coste de servir y captación, previsto frente a real).",
  inputSchema: { quarter: z.string().regex(/^\d{4}-Q[1-4]$/).optional().describe("Trimestre AAAA-QN; por defecto el actual") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ quarter }, ctx) => {
    const c = await mcpCtx(ctx);
    const q = quarter ?? quarterOf(new Date());
    const range = quarterRange(q);
    if (!range) throw new ToolError("Trimestre no válido");
    const year = Number(q.slice(0, 4));
    const [{ data: segs }, { data: deals }, { data: targets }, { data: yearCosts }, { data: budgets }] = await Promise.all([
      c.db.from("segments").select("*").eq("org_id", c.orgId),
      c.db.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at,gross_margin").eq("org_id", c.orgId),
      c.db.from("segment_targets").select("segment_id,amount").eq("org_id", c.orgId).eq("period", q),
      c.db.from("cac_costs").select("segment_id,channel,amount,period").eq("org_id", c.orgId).in("period", quartersOfYear(year)),
      c.db.from("segment_budget_quarters").select("*").eq("org_id", c.orgId).in("period", quartersOfYear(year)),
    ]);
    const costs = (yearCosts ?? []).filter((x) => x.period === q);
    const t = Object.fromEntries((targets ?? []).map((x) => [x.segment_id, Number(x.amount)]));
    const rows = segmentCoverage((segs ?? []) as SegLike[], deals ?? [], t, range, costs, budgets ?? []);
    const qb = quarterlyBudget((segs ?? []) as SegLike[], deals ?? [], budgets ?? [], yearCosts ?? [], year);
    const quarterB = qb.byQuarter[q], budget = qb.year;
    return json({
      quarter: q, currency: c.currency, cost_by_channel: costByChannel(costs),
      segments: rows.map((r, i) => ({
        name: r.segment.name, motion: (r.segment as { motion?: string | null }).motion ?? null, acquisition_motion: (r.segment as { acquisition_motion?: string | null }).acquisition_motion ?? null, target: r.target, pipeline: r.pipeline, coverage: r.coverage, won: r.won, opportunities: r.opps, win_rate: r.winRate,
        cac: { cost: r.cac.cost, deals_won: r.cac.customers, real: round(r.cac.real), target: r.cac.target, state: r.figures.cac.state, reason: r.figures.cac.reason },
        // The margin the payback above used (budget actuals → won deals with lines → plan → target).
        gross_margin: { pct: round(r.figures.margin.value), source: r.figures.margin.source },
        budget_quarter: { plan: quarterB[i].plan, actual: quarterB[i].actual, revenue_attainment: quarterB[i].revenueAttainment },
        payback: { real: round(r.payback.real), state: r.payback.state, reason: r.payback.reason, target: r.payback.target, ok: r.payback.ok },
        budget_year: { year, plan: budget[i].plan, actual: budget[i].actual, revenue_attainment: budget[i].revenueAttainment },
      })),
    });
  },
});
