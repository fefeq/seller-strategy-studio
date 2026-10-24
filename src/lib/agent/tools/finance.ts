// Finanzas, RevOps and CRM tools. Finance data is Owner/Sales Leader only (as the screen and RLS); every query
// scopes org_id because Telegram and cron run tools with the privileged client.
import { z } from "zod";
import { actualMonth, arAging, forecast, monthOf, planVsActual, quarterOfMonth, runwayMonths, type PlanAssumption } from "@/lib/finance";
import { cohorts, lostAnalysis, reconciledFunnel } from "@/lib/revops";
import { stagePath, stageLabel } from "@/lib/stages";
import { ACTIVITY_KINDS } from "@/lib/crm";
import { jsonObject } from "@/lib/json";
import { fetchAll } from "@/lib/fetch-all";
import { def, mustFind, ok, one, orgStages, type AgentTool, type ToolCtx } from "../tool-kit";

const LEADERS = ["owner", "sales_leader"] as const;

async function financeData(c: ToolCtx) {
  const [s, lines, inv, months, products, deals, budgets] = await Promise.all([
    c.db.from("finance_settings").select("*").eq("org_id", c.orgId).maybeSingle(),
    c.db.from("finance_cost_lines").select("name,category,amount,starts_on,ends_on,segment_id").eq("org_id", c.orgId),
    fetchAll((a, b) => c.db.from("finance_invoices").select("amount,issued_on,due_on,paid_on").eq("org_id", c.orgId).order("id").range(a, b)),
    c.db.from("finance_months").select("month,revenue,costs,cash_end,closed_at").eq("org_id", c.orgId),
    c.db.from("products").select("id,name,price,billing").eq("org_id", c.orgId).eq("active", true),
    fetchAll((a, b) => c.db.from("deals").select("amount,probability,close_date,stage").eq("org_id", c.orgId).order("id").range(a, b)),
    c.db.from("segment_budget_quarters").select("period,plan_revenue,plan_cost_to_serve,plan_acquisition").eq("org_id", c.orgId),
  ]);
  const raw = jsonObject(s.data?.plan_assumptions) ?? {};
  const assumptions: Record<string, PlanAssumption> = {};
  for (const [k, v] of Object.entries(raw)) { const o = jsonObject(v) ?? {}; assumptions[k] = { customers: Number(o.customers) || 0, adds: Number(o.adds) || 0, churn_pct: Number(o.churn_pct) || 0, annual_share_pct: Number(o.annual_share_pct) || 0 }; }
  return {
    settings: s.data, assumptions,
    lines: (lines.data ?? []).map((l) => ({ ...l, amount: Number(l.amount) })),
    invoices: inv.rows.map((i) => ({ ...i, amount: Number(i.amount) })),
    months: months.data ?? [], products: (products.data ?? []).map((p) => ({ ...p, price: Number(p.price) })),
    deals: deals.rows, budgets: budgets.data ?? [],
  };
}

export const FINANCE_TOOLS: AgentTool[] = [
  def({
    name: "finance_summary", kind: "read", roles: [...LEADERS],
    description: "Finanzas de la empresa (solo Owner y Sales Leader): caja de hoy, gasto neto del mes, meses de caja, cobros pendientes y vencidos, previsión (ingresos y caja al final del horizonte, con planes y pipeline ponderado) y plan vs real del trimestre actual.",
    input: z.object({}),
    run: async (c) => {
      const d = await financeData(c);
      if (!d.settings && !d.lines.length) return { mensaje: "Finanzas aún no está configurado: falta la caja de hoy y los costes mensuales (Finanzas → Previsión y Costes)." };
      const today = monthOf(new Date());
      const start = d.settings?.cash_as_of && d.settings.cash_as_of.slice(0, 7) < today ? d.settings.cash_as_of.slice(0, 7) : today;
      const f = forecast({ plans: d.products, assumptions: d.assumptions, discountPct: Number(d.settings?.annual_discount_pct ?? 0), deals: d.deals, includePipeline: d.settings?.include_pipeline ?? true, lines: d.lines, openingCash: Number(d.settings?.opening_cash ?? 0), start, horizon: d.settings?.horizon_months ?? 12, spreadPct: Number(d.settings?.scenario_spread_pct ?? 25) });
      const k = Math.max(0, f.months.findIndex((m) => m.month === today));
      const now = f.months[k];
      const cash = k > 0 ? f.months[k - 1].cash.base : Number(d.settings?.opening_cash ?? 0);
      const burn = now ? now.costs - now.revenue : 0;
      const aging = arAging(d.invoices, new Date().toISOString().slice(0, 10));
      const q = quarterOfMonth(today);
      return {
        moneda: c.currency, caja_hoy: cash, gasto_neto_mes: burn, meses_de_caja: runwayMonths(cash, burn),
        este_mes_real: actualMonth(today, d.invoices, d.months, d.lines),
        cobros: { pendiente: aging.open, vencido: aging.overdue },
        prevision: { meses: f.months.length, ingresos_fin: f.summary.mrrEnd, caja_fin: f.summary.cashEnd, caja_se_acaba: f.runway.base != null ? f.months[f.runway.base].month : null, deals_sin_fecha: f.undated },
        plan_vs_real: { trimestre: q, ...planVsActual(q, d.budgets, d.invoices, d.months, d.lines) },
      };
    },
  }),
  def({
    name: "upsert_product", kind: "write", roles: [...LEADERS],
    description: "Crea un producto o plan del catálogo (o actualiza el que tenga el mismo nombre): nombre, precio, cobro (monthly = al mes, annual = al año, one_off = pago único) y descripción. Los planes recurrentes alimentan la previsión de Finanzas y las líneas de los deals.",
    input: z.object({ name: z.string().trim().min(1).max(120), price: z.number().min(0), billing: z.enum(["monthly", "annual", "one_off"]).default("monthly"), description: z.string().max(500).optional() }),
    summarize: (a) => `Producto «${a.name}»: ${a.price} ${a.billing === "annual" ? "al año" : a.billing === "one_off" ? "pago único" : "al mes"}`,
    run: async (c, a) => {
      const { data: rows } = await c.db.from("products").select("id,name").eq("org_id", c.orgId);
      const ex = (rows ?? []).find((p) => p.name.trim().toLowerCase() === a.name.toLowerCase());
      if (ex) {
        ok(await c.db.from("products").update({ price: a.price, billing: a.billing, ...(a.description ? { description: a.description } : {}) }).eq("org_id", c.orgId).eq("id", ex.id));
        return { id: ex.id, created: false, mensaje: `Actualizado «${ex.name}».` };
      }
      const row = one(await c.db.from("products").insert({ org_id: c.orgId, name: a.name, price: a.price, billing: a.billing, description: a.description ?? "", created_by: c.userId }).select("id").single());
      return { id: row.id, created: true };
    },
  }),
  def({
    name: "revops_funnel", kind: "read",
    description: "Embudo RevOps conciliado de los deals: en cada etapa cuántos entran, avanzan, se pierden, siguen abiertos y cuántos llevan más de 30 días parados, con importes; y cohortes por origen (win rate, valor, días hasta ganar).",
    input: z.object({}),
    run: async (c) => {
      const [deals, hist, stages] = await Promise.all([
        fetchAll((a, b) => c.db.from("deals").select("id,stage,amount,created_at,closed_at,updated_at,source,segment_id").eq("org_id", c.orgId).order("id").range(a, b)),
        fetchAll((a, b) => c.db.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at,deals!inner(org_id)").eq("deals.org_id", c.orgId).order("id").range(a, b)),
        orgStages(c),
      ]);
      const path = stagePath(stages).filter((k) => k !== "won" && k !== "lost");
      const h = hist.rows.map(({ deal_id, from_stage, to_stage, changed_at }) => ({ deal_id, from_stage, to_stage, changed_at }));
      return {
        embudo: reconciledFunnel(deals.rows, h, path).map((s) => ({ ...s, etapa: stageLabel(s.stage, stages) })),
        cohortes_por_origen: cohorts(deals.rows, (d) => d.source ?? "—"),
      };
    },
  }),
  def({
    name: "lost_analysis", kind: "read",
    description: "Análisis de deals perdidos: cuántos y cuánto valor, en qué etapa se cayeron, por segmento y por origen.",
    input: z.object({}),
    run: async (c) => {
      const [deals, hist, stages, segs] = await Promise.all([
        fetchAll((a, b) => c.db.from("deals").select("id,stage,amount,created_at,closed_at,source,segment_id").eq("org_id", c.orgId).order("id").range(a, b)),
        fetchAll((a, b) => c.db.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at,deals!inner(org_id)").eq("deals.org_id", c.orgId).order("id").range(a, b)),
        orgStages(c),
        c.db.from("segments").select("id,name").eq("org_id", c.orgId),
      ]);
      const path = stagePath(stages).filter((k) => k !== "won" && k !== "lost");
      const r = lostAnalysis(deals.rows, hist.rows.map(({ deal_id, from_stage, to_stage, changed_at }) => ({ deal_id, from_stage, to_stage, changed_at })), path);
      const seg = new Map((segs.data ?? []).map((s) => [s.id, s.name]));
      return { ...r, byStage: r.byStage.map((g) => ({ ...g, etapa: g.key === "—" ? "Sin etapa" : stageLabel(g.key, stages) })), bySegment: r.bySegment.map((g) => ({ ...g, segmento: seg.get(g.key) ?? "Sin segmento" })) };
    },
  }),
  def({
    name: "log_activity", kind: "write",
    description: "Registra en la historia de una cuenta o un deal un email, llamada, reunión, nota, LinkedIn o WhatsApp ya ocurrido (asunto y detalle).",
    input: z.object({ kind: z.enum(ACTIVITY_KINDS).default("note"), subject: z.string().max(200).default(""), body: z.string().max(8000).default(""), account_id: z.string().uuid().optional(), deal_id: z.string().uuid().optional(), occurred_at: z.string().datetime().optional() }),
    summarize: (a) => `Registrar ${a.kind}: ${a.subject || a.body.slice(0, 60)}`,
    run: async (c, a) => {
      if (!a.account_id && !a.deal_id) throw new Error("Indica la cuenta o el deal.");
      let account = a.account_id ?? null;
      if (a.account_id) await mustFind(c, "accounts", a.account_id, "esa cuenta");
      if (a.deal_id) { const d = await mustFind<{ account_id: string | null }>(c, "deals", a.deal_id, "ese deal", "id,account_id"); account ??= d.account_id; }
      const row = one(await c.db.from("activities").insert({ org_id: c.orgId, kind: a.kind, subject: a.subject, body: a.body, account_id: account, deal_id: a.deal_id ?? null, occurred_at: a.occurred_at ?? new Date().toISOString(), created_by: c.userId }).select("id").single());
      return { id: row.id };
    },
  }),
];
