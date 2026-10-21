// Single tool registry shared by the in-app agent, Telegram and proactive suggestions.
// Read tools run immediately; write tools only run after the user confirms.
// Every handler filters/sets org_id explicitly (safe with privileged clients too).
import { z } from "zod";
import type { Db } from "@/lib/org-data";
import { loadSetupData } from "@/lib/org-data";
import { setupStatus, POSITIONING_FIELDS } from "@/lib/setup-schema";
import { buildSnapshot } from "@/lib/advisor";
import { cohort, funnelBySegment, funnelStats } from "@/lib/self-service";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { BUYING_ROLES, type Role } from "@/lib/roles";
import { firstOpenStage, sortStages, stageByLabel, type Stage } from "@/lib/stages";
import { lineFromProduct, productMarginPct, type Product } from "@/lib/deal-lines";
import { DISQUALIFIED, LEAD_STAGES, delayText, leadCohort, leadDelay, leadFunnel, leadStageLabel, readSla } from "@/lib/lead-funnel";
import { byScore, fitText, scoreLead } from "@/lib/scoring";
import { readStaleDays, staleDeals, thresholdText } from "@/lib/stale";
import { FOLLOWUP_STEPS, followupDraft, followupStatus } from "@/lib/followup";
import { ask } from "@/lib/ai-gateway";

export type ToolCtx = { db: Db; orgId: string; userId: string; roles: string[]; currency: string };

export type AgentTool<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  kind: "read" | "write";
  roles?: Role[]; // allowed roles; undefined = every member
  input: S;
  summarize?: (args: z.infer<S>) => string;
  run: (ctx: ToolCtx, args: z.infer<S>) => Promise<unknown>;
};

const def = <S extends z.ZodTypeAny>(t: AgentTool<S>) => t as unknown as AgentTool;
const STAGE_ARG = z.string().min(1).describe("Clave o nombre de una etapa de la empresa (list_stages); por defecto: discovery, qualified, demo, proposal, negotiation, won, lost");
const LEAD_STAGE_IDS = [...LEAD_STAGES, DISQUALIFIED].map((s) => s.id) as [string, ...string[]];

/** The company's stages (the default seven if it has none yet). */
async function orgStages(c: ToolCtx): Promise<Stage[]> {
  const { data } = await c.db.from("deal_stages").select("key,label,position,kind,board_group,probability").eq("org_id", c.orgId);
  return sortStages((data ?? []) as Stage[]);
}
/** A stage the agent named, by key or label, as the company's key; refuses one the company doesn't have. */
async function resolveStage(c: ToolCtx, raw: string): Promise<{ key: string; probability: number; stages: Stage[] }> {
  const stages = await orgStages(c);
  const key = stageByLabel(raw, stages);
  const st = stages.find((s) => s.key === key);
  if (!st) throw new Error(`La etapa «${raw}» no existe en esta empresa. Etapas: ${stages.map((s) => `${s.label} (${s.key})`).join(", ")}.`);
  return { key: st.key, probability: st.probability, stages };
}
const ok = <T>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

/** The org's account with this name (case-insensitive), created if missing: same rule as lead intake. */
async function accountByName(c: ToolCtx, name: string, segmentId?: string): Promise<string> {
  if (!name.trim()) throw new Error("Falta el nombre de la cuenta del deal.");
  // % and _ are escaped; PostgREST reads * as a wildcard, so it becomes a one-character wildcard and the
  // exact (case-insensitive) match is checked here: «A*B» never links the deal to another account.
  const pattern = name.replace(/[\\%_]/g, (ch) => `\\${ch}`).replace(/\*/g, "_");
  const { data: candidates } = await c.db.from("accounts").select("id,name").eq("org_id", c.orgId).ilike("name", pattern).limit(20);
  const found = (candidates ?? []).find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (found?.id) return found.id;
  const created = ok(await c.db.from("accounts").insert({ org_id: c.orgId, name, ...(segmentId ? { segment_id: segmentId } : {}) }).select("id").single());
  if (!created?.id) throw new Error("No se ha podido crear la cuenta del deal.");
  return created.id;
}
const like = (q: string) => `%${q.replace(/[%_,()]/g, " ").trim()}%`;

export const TOOLS: AgentTool[] = [
  // ---------- READ ----------
  def({
    name: "get_overview", kind: "read",
    description: "Resumen del negocio: pipeline abierto, forecast, cobertura del trimestre, win rate, deals en riesgo y funnel self-service del trimestre.",
    input: z.object({}),
    run: async (c) => {
      const [deals, segs, hist, quotas, trials, stages] = await Promise.all([
        c.db.from("deals").select("id,name,stage,amount,probability,health,close_date,closed_at,updated_at,source,segment_id,slip_count,forecast_category,meddpicc,partner_id").eq("org_id", c.orgId),
        c.db.from("segments").select("id,name,acv_min,acv_max,motion,cycle_days,sdr_per_ae,ae_per_se,cac_target,payback_months,win_rate_target,ae_quota,gross_margin_pct").eq("org_id", c.orgId),
        c.db.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at").eq("org_id", c.orgId),
        c.db.from("quotas").select("period,amount").eq("org_id", c.orgId),
        c.db.from("trials").select("segment_id,signed_up_at,activated_at,converted_at,mrr").eq("org_id", c.orgId),
        orgStages(c),
      ]);
      const { start, end } = quarterRange(quarterOf(new Date()));
      const co = cohort((trials.data ?? []) as any[], start, end);
      return {
        moneda: c.currency,
        pipeline: buildSnapshot({ deals: (deals.data ?? []) as any, segments: (segs.data ?? []) as any, history: hist.data ?? [], quotas: (quotas.data ?? []) as any, currency: c.currency, stages }),
        self_service_trimestre: { total: funnelStats(co as any), por_segmento: funnelBySegment(co as any) },
      };
    },
  }),
  def({
    name: "search", kind: "read",
    description: "Busca por texto en cuentas, deals, stakeholders y personas. Devuelve ids para usar en otras herramientas.",
    input: z.object({ query: z.string().min(1) }),
    run: async (c, a) => {
      const q = like(a.query);
      const [acc, deals, sh, people] = await Promise.all([
        c.db.from("accounts").select("id,name,domain,health,tier").eq("org_id", c.orgId).or(`name.ilike.${q},domain.ilike.${q}`).limit(8),
        c.db.from("deals").select("id,name,stage,amount,close_date,account_id").eq("org_id", c.orgId).ilike("name", q).limit(8),
        c.db.from("stakeholders").select("id,name,title,buying_role,account_id").eq("org_id", c.orgId).or(`name.ilike.${q},title.ilike.${q}`).limit(8),
        c.db.from("people").select("id,full_name,company,title,email").eq("org_id", c.orgId).or(`full_name.ilike.${q},company.ilike.${q},email.ilike.${q}`).limit(8),
      ]);
      return { cuentas: acc.data, deals: deals.data, stakeholders: sh.data, personas: people.data };
    },
  }),
  def({
    name: "get_account", kind: "read",
    description: "Detalle de una cuenta: plan de cuenta, stakeholders, deals, reuniones y tareas abiertas.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const [acc, plan, sh, deals, meet, tasks] = await Promise.all([
        c.db.from("accounts").select("*").eq("org_id", c.orgId).eq("id", a.account_id).maybeSingle(),
        c.db.from("account_plans").select("*").eq("org_id", c.orgId).eq("account_id", a.account_id).maybeSingle(),
        c.db.from("stakeholders").select("id,name,title,buying_role,support,priorities").eq("org_id", c.orgId).eq("account_id", a.account_id),
        c.db.from("deals").select("id,name,stage,amount,close_date,health,meddpicc").eq("org_id", c.orgId).eq("account_id", a.account_id),
        c.db.from("meetings").select("id,title,scheduled_at,objective,next_steps").eq("org_id", c.orgId).eq("account_id", a.account_id).order("scheduled_at", { ascending: false }).limit(5),
        c.db.from("tasks").select("id,title,due_date").eq("org_id", c.orgId).eq("account_id", a.account_id).eq("done", false),
      ]);
      if (!acc.data) return { error: "Cuenta no encontrada" };
      return { cuenta: acc.data, account_plan: plan.data, stakeholders: sh.data, deals: deals.data, reuniones: meet.data, tareas: tasks.data };
    },
  }),
  def({
    name: "list_products", kind: "read",
    description: "Catálogo de productos de la empresa: id, nombre, precio y coste por periodo, cobro (monthly/annual/one_off) y margen %. Úsalo para crear deals con producto.",
    input: z.object({ include_inactive: z.boolean().optional() }),
    run: async (c, a) => {
      const rows = ok(await c.db.from("products").select("id,name,price,cost,billing,active").eq("org_id", c.orgId).order("name")) as Product[];
      return rows.filter((p) => a.include_inactive || p.active).map((p) => ({ id: p.id, nombre: p.name, precio: Number(p.price), coste: p.cost == null ? null : Number(p.cost), cobro: p.billing, margen_pct: productMarginPct(p) == null ? null : Math.round(productMarginPct(p)!), a_la_venta: p.active }));
    },
  }),
  def({
    name: "list_stages", kind: "read",
    description: "Etapas del pipeline de la empresa en orden: clave, nombre, tipo (open/won/lost) y probabilidad. Úsalas al crear o mover deals.",
    input: z.object({}),
    run: async (c) => (await orgStages(c)).map((s) => ({ clave: s.key, nombre: s.label, tipo: s.kind, probabilidad: s.probability })),
  }),
  def({
    name: "list_deals", kind: "read",
    description: "Lista deals con filtros opcionales: etapa, solo míos, solo en riesgo (salud roja), con fecha de cierre pasada o enfriados (sin actividad más días que el umbral de su segmento: un cuarto del ciclo real, 14–60 días, o el número fijado por la empresa). Cada deal trae dias_sin_actividad, umbral_enfriado y enfriado.",
    input: z.object({ stage: STAGE_ARG.optional(), mine: z.boolean().optional(), at_risk: z.boolean().optional(), overdue: z.boolean().optional(), cold: z.boolean().optional() }),
    run: async (c, a) => {
      const stageKey = a.stage ? (await resolveStage(c, a.stage)).key : null;
      const [all, seg, cfg] = await Promise.all([
        c.db.from("deals").select("id,name,stage,amount,probability,health,close_date,closed_at,created_at,updated_at,segment_id,owner_id,account_id,forecast_category").eq("org_id", c.orgId).order("close_date"),
        c.db.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").eq("org_id", c.orgId),
        c.db.from("lead_settings").select("sla").eq("org_id", c.orgId).maybeSingle(),
      ]);
      if (all.error) throw new Error(all.error.message);
      const now = new Date();
      const cold = new Map(staleDeals(all.data ?? [], seg.data ?? [], readStaleDays(cfg.data?.sla), now).map((r) => [r.deal.id, r]));
      const today = now.toISOString().slice(0, 10);
      const list = (all.data ?? [])
        .filter((d) => (stageKey ? d.stage === stageKey : d.stage !== "won" && d.stage !== "lost"))
        .filter((d) => (!a.mine || d.owner_id === c.userId) && (!a.at_risk || d.health === "red") && (!a.overdue || (!!d.close_date && d.close_date < today)) && (!a.cold || !!cold.get(d.id)?.stale))
        .slice(0, 40)
        .map(({ closed_at: _c, created_at: _cr, updated_at: _u, segment_id: _s, ...d }) => {
          const r = cold.get(d.id);
          return { ...d, dias_sin_actividad: r?.idleDays ?? null, umbral_enfriado: r ? thresholdText(r.threshold) : null, enfriado: r?.stale ?? false };
        });
      return list;
    },
  }),
  def({
    name: "list_leads", kind: "read",
    description: "Leads antes de ser oportunidad (Nuevo, Contactado, MQL, SQL, Oportunidad, Descartado), ordenados por puntuación (encaje con el ICP 70 % + actividad 30 %): filtra por etapa o solo los retrasados (más días en la etapa de lo permitido o seguimiento vencido). Incluye el embudo del trimestre.",
    input: z.object({ stage: z.enum(LEAD_STAGE_IDS).optional(), late_only: z.boolean().optional() }),
    run: async (c, a) => {
      const [l, d, s, icp, acc, seg] = await Promise.all([
        c.db.from("leads").select("id,company,contact_name,email,stage,source,stage_entered_at,updated_at,next_step,next_step_at,created_at,contacted_at,mql_at,sql_at,opportunity_at,deal_id,owner_id,segment_id,account_id").eq("org_id", c.orgId).order("created_at", { ascending: false }).limit(1000),
        c.db.from("deals").select("id,stage,closed_at").eq("org_id", c.orgId),
        c.db.from("lead_settings").select("sla").eq("org_id", c.orgId).maybeSingle(),
        c.db.from("icp_profiles").select("id,segment_id,industries,company_size,geography,anti_icp").eq("org_id", c.orgId),
        c.db.from("accounts").select("id,segment_id,industry,size,tier,name").eq("org_id", c.orgId),
        c.db.from("segments").select("id,name").eq("org_id", c.orgId),
      ]);
      const sla = readSla(s.data?.sla);
      const now = new Date();
      const { start, end } = quarterRange(quarterOf(now));
      const accounts = new Map((acc.data ?? []).map((x) => [x.id, x]));
      const segNames = new Map((seg.data ?? []).map((x) => [x.id, x.name]));
      const rows = (l.data ?? []).map((x) => {
        const delay = leadDelay(x, sla, now);
        return { ...x, delay, score: scoreLead({ ...x, late: delay.late }, icp.data ?? [], accounts, now, segNames) };
      });
      // Highest score first so the agent prioritises the same way the screen does.
      const list = rows.filter((x) => (!a.stage || x.stage === a.stage) && (!a.late_only || x.delay.late)).sort(byScore((x) => x.score)).slice(0, 40);
      const f = leadFunnel(leadCohort(l.data ?? [], start, end), d.data ?? []);
      return {
        plazos_dias: sla,
        embudo_trimestre: f.steps.map((st) => ({ paso: st.label, leads: st.count, entrada_directa: st.direct, conversion_paso_anterior: st.fromPrev })),
        leads: list.map((x) => ({ id: x.id, empresa: x.company, contacto: x.contact_name ?? x.email, etapa: leadStageLabel(x.stage), origen: x.source, puntuacion: x.score.total, encaje_icp: x.score.total == null ? "sin datos" : fitText(x.score.fit), actividad: x.score.activity, proximo_paso: x.next_step, seguimiento: x.next_step_at, retraso: x.delay.late ? delayText(x.delay) : null, deal_id: x.deal_id })),
      };
    },
  }),
  def({
    name: "list_tasks", kind: "read",
    description: "Tareas abiertas (por defecto las mías).",
    input: z.object({ all: z.boolean().optional() }),
    run: async (c, a) => {
      let q = c.db.from("tasks").select("id,title,due_date,deal_id,account_id,owner_id").eq("org_id", c.orgId).eq("done", false).order("due_date");
      if (!a.all) q = q.or(`owner_id.eq.${c.userId},owner_id.is.null`);
      return ok(await q.limit(40));
    },
  }),
  def({
    name: "list_suggestions", kind: "read",
    description: "Sugerencias proactivas pendientes del motor (riesgos y próximos pasos).",
    input: z.object({}),
    run: async (c) => ok(await c.db.from("suggestions").select("id,title,body,priority,link,action").eq("org_id", c.orgId).eq("status", "pending").or(`user_id.is.null,user_id.eq.${c.userId}`).order("priority").limit(15)),
  }),
  def({
    name: "get_setup_status", kind: "read",
    description: "Estado de la configuración estratégica (% completado, qué falta y qué desbloquea) y valores actuales de segmentos, ICP, posicionamiento y pilares.",
    input: z.object({}),
    run: async (c) => {
      const d = await loadSetupData(c.db, c.orgId);
      const [segs, icps, pils] = await Promise.all([
        c.db.from("segments").select("id,name,acv_min,acv_max,motion,win_rate_target,ae_quota").eq("org_id", c.orgId),
        c.db.from("icp_profiles").select("id,name,industries,company_size,why_fit,anti_icp").eq("org_id", c.orgId),
        c.db.from("messaging_pillars").select("id,title,pain,message,proof").eq("org_id", c.orgId),
      ]);
      return { estado: setupStatus(d), moneda: d.currency, posicionamiento: d.positioning, segmentos: segs.data, icp: icps.data, pilares: pils.data };
    },
  }),
  def({
    name: "draft_followup", kind: "read",
    description: "Redacta con IA el seguimiento del día 3, 7 o 14 para un lead contactado sin respuesta, con el posicionamiento y los pilares de la empresa. Solo devuelve el borrador: no envía nada ni cambia el lead. Si no se indica el paso, usa el que toca.",
    input: z.object({ lead_id: z.string().uuid(), step: z.enum(["nudge", "value", "breakup"]).optional().describe("nudge = día 3, value = día 7, breakup = día 14"), tone: z.string().optional().describe("p. ej. más directo, más cercano, más corto") }),
    run: async (c, a) => {
      const l = ok(await c.db.from("leads").select("id,company,contact_name,title,stage,contacted_at,next_step_at,notes,source").eq("org_id", c.orgId).eq("id", a.lead_id).single()) as any;
      const st = followupStatus(l, new Date());
      const step = a.step ? FOLLOWUP_STEPS.find((x) => x.id === a.step)! : st.due ?? st.next?.step ?? FOLLOWUP_STEPS[0];
      const setup = await loadSetupData(c.db, c.orgId);
      const base = followupDraft(step, l, { positioning: setup.positioning, pillars: setup.pillars });
      const text = await ask(
        "Eres un vendedor B2B experimentado que escribe seguimientos cortos en español neutro, de tú, sin signos de exclamación ni emoji, sin promesas ni adjetivos vacíos. Máximo 60 palabras. Una sola idea por mensaje y una pregunta clara al final. No inventes datos del lead ni de la empresa.",
        JSON.stringify({ paso: `${step.label}: ${step.purpose}`, tono: a.tone ?? null, lead: { empresa: l.company, contacto: l.contact_name, cargo: l.title, origen: l.source, notas: (l.notes ?? "").slice(0, 600) }, posicionamiento: setup.positioning, pilares: setup.pillars, borrador_base: base }),
        { effort: "low" },
      );
      return { paso: step.label, dias_sin_respuesta: st.daysSinceContact, borrador: text.trim(), borrador_base: base };
    },
  }),
  def({
    name: "search_knowledge", kind: "read",
    description: "Busca en el hub de conocimiento (playbooks, objeciones, metodología, empresa).",
    input: z.object({ query: z.string().min(1) }),
    run: async (c, a) => ok(await c.db.from("knowledge_docs").select("section,title,body").eq("org_id", c.orgId).or(`title.ilike.${like(a.query)},body.ilike.${like(a.query)}`).limit(6)),
  }),

  // ---------- WRITE (require confirmation) ----------
  def({
    name: "create_account", kind: "write",
    description: "Crea una cuenta.",
    input: z.object({ name: z.string().min(1), domain: z.string().optional(), industry: z.string().optional(), is_target: z.boolean().optional() }),
    summarize: (a) => `Crear la cuenta «${a.name}»${a.is_target ? " como objetivo" : ""}`,
    run: async (c, a) => ok(await c.db.from("accounts").insert({ ...a, org_id: c.orgId, owner_id: c.userId }).select("id,name").single()),
  }),
  def({
    name: "create_deal", kind: "write",
    description: "Crea un deal (oportunidad). Sin account_id lo asocia a la cuenta con ese nombre (account_name, o el nombre del deal) y la crea si no existe, como la entrada de leads.",
    input: z.object({ name: z.string().min(1), account_id: z.string().uuid().optional(), account_name: z.string().optional(), segment_id: z.string().uuid().optional(), amount: z.number().nonnegative().optional(), close_date: z.string().optional().describe("AAAA-MM-DD"), stage: STAGE_ARG.optional(), product_id: z.string().uuid().optional().describe("Producto del catálogo (list_products): añade una línea y el importe pasa a ser el de sus líneas"), quantity: z.number().positive().optional() }),
    summarize: (a) => `Crear el deal «${a.name}»${a.amount ? ` por ${a.amount}` : ""}${a.stage ? ` en la etapa «${a.stage}»` : ""}`,
    run: async (c, a) => {
      // Every way of creating a deal ends with an account, so the asistente, the pipeline and the CSV
      // produce the same data (a deal created here used to have no account; one from the CSV did).
      const { account_name, product_id, quantity, ...deal } = a;
      const product = product_id ? ok(await c.db.from("products").select("id,name,price,cost,billing,active").eq("org_id", c.orgId).eq("id", product_id).maybeSingle()) : null;
      if (product_id && !product) throw new Error("Ese producto no existe en el catálogo de esta empresa.");
      const st = deal.stage ? await resolveStage(c, deal.stage) : null;
      const first = st ? null : firstOpenStage(await orgStages(c));
      const account_id = deal.account_id ?? (await accountByName(c, (account_name ?? deal.name).trim(), deal.segment_id));
      const created = ok(await c.db.from("deals").insert({ ...deal, account_id, stage: st?.key ?? first!.key, probability: st?.probability ?? first!.probability, org_id: c.orgId, owner_id: c.userId }).select("id,name,account_id").single());
      if (product) ok(await c.db.from("deal_lines").insert({ ...lineFromProduct(product as Product, quantity ?? 1), deal_id: (created as { id: string }).id, org_id: c.orgId } as never).select("id"));
      return created;
    },
  }),
  def({
    name: "update_deal", kind: "write",
    description: "Actualiza un deal: etapa, importe, fecha de cierre, salud (green/yellow/red), categoría de forecast (pipeline/best_case/commit) o un campo MEDDPICC.",
    input: z.object({
      deal_id: z.string().uuid(),
      stage: STAGE_ARG.optional(), amount: z.number().nonnegative().optional(), close_date: z.string().optional(),
      health: z.enum(["green", "yellow", "red"]).optional(), forecast_category: z.enum(["pipeline", "best_case", "commit"]).optional(),
      meddpicc_field: z.string().optional(), meddpicc_value: z.string().optional(),
    }),
    summarize: (a) => {
      const parts = [a.stage && `etapa → «${a.stage}»`, a.amount != null && `importe → ${a.amount}`, a.close_date && `cierre → ${a.close_date}`, a.health && `salud → ${a.health}`, a.forecast_category && `forecast → ${a.forecast_category}`, a.meddpicc_field && `MEDDPICC ${a.meddpicc_field}`].filter(Boolean);
      return `Actualizar el deal: ${parts.join(", ") || "sin cambios"}`;
    },
    run: async (c, a) => {
      const { deal_id, meddpicc_field, meddpicc_value, ...rest } = a;
      const patch: any = { ...rest };
      if (rest.stage) {
        const st = await resolveStage(c, rest.stage);
        patch.stage = st.key;
        patch.probability = st.probability;
      }
      if (meddpicc_field) {
        const cur = ok(await c.db.from("deals").select("meddpicc").eq("org_id", c.orgId).eq("id", deal_id).single());
        patch.meddpicc = { ...((cur as any)?.meddpicc ?? {}), [meddpicc_field]: meddpicc_value ?? "" };
      }
      return ok(await c.db.from("deals").update(patch).eq("org_id", c.orgId).eq("id", deal_id).select("id,name,stage,close_date").single());
    },
  }),
  def({
    name: "update_lead", kind: "write",
    description: "Actualiza un lead: etapa (new, contacted, mql, sql, opportunity, disqualified), próximo paso y fecha de seguimiento. Pasarlo a opportunity crea su deal en la primera etapa del pipeline.",
    input: z.object({ lead_id: z.string().uuid(), stage: z.enum(LEAD_STAGE_IDS).optional(), next_step: z.string().optional(), next_step_at: z.string().optional().describe("AAAA-MM-DD"), disqualified_reason: z.string().optional() }),
    summarize: (a) => {
      const parts = [a.stage && `etapa → ${leadStageLabel(a.stage)}`, a.next_step && `próximo paso «${a.next_step}»`, a.next_step_at && `seguimiento ${a.next_step_at}`].filter(Boolean);
      return `Actualizar el lead: ${parts.join(", ") || "sin cambios"}`;
    },
    run: async (c, a) => {
      const { lead_id, ...patch } = a;
      const cur = ok(await c.db.from("leads").select("stage").eq("org_id", c.orgId).eq("id", lead_id).single());
      if ((cur as any)?.stage === "opportunity" && patch.stage && patch.stage !== "opportunity") return { error: "El lead ya es oportunidad; actualiza su deal." };
      return ok(await c.db.from("leads").update(patch).eq("org_id", c.orgId).eq("id", lead_id).select("id,company,stage,deal_id,next_step_at").single());
    },
  }),
  def({
    name: "create_stakeholder", kind: "write",
    description: `Añade un stakeholder a una cuenta. buying_role: ${Object.keys(BUYING_ROLES).join(", ")}.`,
    input: z.object({ account_id: z.string().uuid(), name: z.string().min(1), title: z.string().optional(), buying_role: z.string().optional(), email: z.string().optional() }),
    summarize: (a) => `Añadir a ${a.name}${a.title ? ` (${a.title})` : ""} como stakeholder`,
    run: async (c, a) => ok(await c.db.from("stakeholders").insert({ ...a, org_id: c.orgId }).select("id,name").single()),
  }),
  def({
    name: "create_meeting", kind: "write",
    description: "Planifica una reunión (planificador de reuniones).",
    input: z.object({ title: z.string().min(1), account_id: z.string().uuid().optional(), deal_id: z.string().uuid().optional(), scheduled_at: z.string().optional().describe("ISO 8601"), objective: z.string().optional() }),
    summarize: (a) => `Planificar la reunión «${a.title}»${a.scheduled_at ? ` el ${a.scheduled_at.slice(0, 16).replace("T", " ")}` : ""}`,
    run: async (c, a) => ok(await c.db.from("meetings").insert({ ...a, org_id: c.orgId }).select("id,title").single()),
  }),
  def({
    name: "prepare_meeting_brief", kind: "write",
    description: "Genera con IA la preparación de llamada de una reunión y la guarda.",
    input: z.object({ meeting_id: z.string().uuid() }),
    summarize: () => "Generar y guardar la preparación de llamada de la reunión",
    run: async (c, a) => {
      const m = ok(await c.db.from("meetings").select("*").eq("org_id", c.orgId).eq("id", a.meeting_id).single()) as any;
      const acc = m.account_id ? await TOOLS.find((t) => t.name === "get_account")!.run(c, { account_id: m.account_id }) : {};
      const [pos, pillars] = await Promise.all([
        c.db.from("positioning").select("one_liner,key_benefit,differentiator,competitive_alternative").eq("org_id", c.orgId).maybeSingle(),
        c.db.from("messaging_pillars").select("title,message,proof").eq("org_id", c.orgId),
      ]);
      const brief = await ask(
        "Eres un coach de ventas B2B. Redacta una preparación de llamada concisa en español neutro (tú), sin signos de exclamación ni emoji, en markdown: objetivo, contexto de la cuenta, stakeholders y qué le importa a cada uno, preguntas de discovery, objeciones probables con respuesta, y próximo paso a pedir. Usa solo los datos dados.",
        JSON.stringify({ reunion: m, contexto: acc, posicionamiento: pos.data, pilares: pillars.data }),
      );
      ok(await c.db.from("meetings").update({ ai_brief: brief }).eq("org_id", c.orgId).eq("id", a.meeting_id).select("id").single());
      return { ok: true, meeting: m.title };
    },
  }),
  def({
    name: "create_task", kind: "write",
    description: "Crea una tarea (opcionalmente ligada a un deal o cuenta).",
    input: z.object({ title: z.string().min(1), due_date: z.string().optional(), deal_id: z.string().uuid().optional(), account_id: z.string().uuid().optional(), owner_id: z.string().uuid().nullable().optional() }),
    summarize: (a) => `Crear la tarea «${a.title}»${a.due_date ? ` para el ${a.due_date}` : ""}`,
    run: async (c, a) => ok(await c.db.from("tasks").insert({ ...a, owner_id: a.owner_id ?? c.userId, org_id: c.orgId, source: "agent" }).select("id,title").single()),
  }),
  def({
    name: "complete_task", kind: "write",
    description: "Marca una tarea como hecha.",
    input: z.object({ task_id: z.string().uuid() }),
    summarize: () => "Marcar la tarea como hecha",
    run: async (c, a) => ok(await c.db.from("tasks").update({ done: true }).eq("org_id", c.orgId).eq("id", a.task_id).select("id,title").single()),
  }),
  def({
    name: "log_trial", kind: "write",
    description: "Registra un alta self-service (prueba) o actualiza su activación/pago por email.",
    input: z.object({ email: z.string().min(3), company: z.string().optional(), signed_up_at: z.string().optional(), activated_at: z.string().optional(), converted_at: z.string().optional(), mrr: z.number().nonnegative().optional() }),
    summarize: (a) => `Registrar/actualizar la prueba de ${a.email}`,
    run: async (c, a) => {
      const email = a.email.trim().toLowerCase();
      const { data: ex } = await c.db.from("trials").select("id").eq("org_id", c.orgId).ilike("email", email).maybeSingle();
      if (ex) return ok(await c.db.from("trials").update({ ...a, email }).eq("id", ex.id).select("id").single());
      return ok(await c.db.from("trials").insert({ ...a, email, org_id: c.orgId }).select("id").single());
    },
  }),
  def({
    name: "create_experiment", kind: "write",
    description: "Crea un prototipo/experimento GTM (Theory U) con hipótesis y métrica.",
    input: z.object({ title: z.string().min(1), hypothesis: z.string().optional(), metric: z.string().optional() }),
    summarize: (a) => `Crear el prototipo «${a.title}»`,
    run: async (c, a) => ok(await c.db.from("gtm_experiments").insert({ ...a, org_id: c.orgId } as any).select("id,title").single()),
  }),
  def({
    name: "update_positioning", kind: "write", roles: ["owner", "sales_leader", "marketing"],
    description: `Guarda campos de posicionamiento. Campos: ${POSITIONING_FIELDS.map(([k]) => k).join(", ")}, tagline, short_pitch, product_name.`,
    input: z.object({ fields: z.record(z.string(), z.string()) }),
    summarize: (a) => `Guardar posicionamiento: ${Object.keys(a.fields).join(", ")}`,
    run: async (c, a) => {
      const allowed = new Set<string>([...POSITIONING_FIELDS.map(([k]) => k), "tagline", "short_pitch", "product_name"]);
      const patch: any = Object.fromEntries(Object.entries(a.fields).filter(([k]) => allowed.has(k)));
      const { data: ex } = await c.db.from("positioning").select("id").eq("org_id", c.orgId).maybeSingle();
      if (ex) return ok(await c.db.from("positioning").update(patch).eq("id", ex.id).select("id").single());
      return ok(await c.db.from("positioning").insert({ ...patch, org_id: c.orgId }).select("id").single());
    },
  }),
  def({
    name: "upsert_segment", kind: "write", roles: ["owner", "sales_leader"],
    description: "Crea o actualiza (si se pasa segment_id) un segmento con rango de ACV, motion, win rate objetivo (%), cuota anual AE, prioridad (1 = el primero) y una nota. El nombre es solo el nombre: la prioridad y las notas van en sus campos.",
    input: z.object({ segment_id: z.string().uuid().optional(), name: z.string().min(1), acv_min: z.number().optional(), acv_max: z.number().optional(), motion: z.enum(["plg", "inside", "field", "strategic"]).optional(), win_rate_target: z.number().min(0).max(100).optional(), ae_quota: z.number().min(0).optional(), priority: z.number().int().min(1).optional(), notes: z.string().optional() }),
    summarize: (a) => `${a.segment_id ? "Actualizar" : "Crear"} el segmento «${a.name}»`,
    run: async (c, a) => {
      const { segment_id, ...rest } = a;
      if (segment_id) return ok(await c.db.from("segments").update(rest).eq("org_id", c.orgId).eq("id", segment_id).select("id").single());
      return ok(await c.db.from("segments").insert({ ...rest, motion: rest.motion ?? "inside", org_id: c.orgId }).select("id").single());
    },
  }),
  def({
    name: "create_icp", kind: "write", roles: ["owner", "sales_leader", "marketing"],
    description: "Crea un perfil ICP.",
    input: z.object({ name: z.string().min(1), industries: z.string().optional(), company_size: z.string().optional(), geography: z.string().optional(), why_fit: z.string().optional(), anti_icp: z.string().optional(), hiring_signals: z.string().optional(), tech_stack: z.string().optional() }),
    summarize: (a) => `Crear el ICP «${a.name}»`,
    run: async (c, a) => ok(await c.db.from("icp_profiles").insert({ ...a, org_id: c.orgId }).select("id").single()),
  }),
  def({
    name: "create_pillar", kind: "write", roles: ["owner", "sales_leader", "marketing"],
    description: "Crea un pilar de mensaje (título, dolor, mensaje, prueba).",
    input: z.object({ title: z.string().min(1), pain: z.string().optional(), message: z.string().optional(), proof: z.string().optional() }),
    summarize: (a) => `Crear el pilar de mensaje «${a.title}»`,
    run: async (c, a) => {
      const { count } = await c.db.from("messaging_pillars").select("id", { count: "exact", head: true }).eq("org_id", c.orgId);
      return ok(await c.db.from("messaging_pillars").insert({ ...a, position: count ?? 0, org_id: c.orgId }).select("id").single());
    },
  }),
  def({
    name: "set_currency", kind: "write", roles: ["owner"],
    description: "Cambia la moneda de la empresa (código ISO de 3 letras, p. ej. EUR, USD). Solo reetiqueta importes, no convierte.",
    input: z.object({ currency: z.string().regex(/^[A-Z]{3}$/) }),
    summarize: (a) => `Cambiar la moneda de la empresa a ${a.currency}`,
    run: async (c, a) => ok(await c.db.from("organizations").update({ currency: a.currency }).eq("id", c.orgId).select("id").single()),
  }),
  def({
    name: "set_quota", kind: "write", roles: ["owner", "sales_leader"],
    description: "Fija la cuota de un usuario para un trimestre (AAAA-QN). Sin user_id = la mía.",
    input: z.object({ amount: z.number().positive(), period: z.string().regex(/^\d{4}-Q[1-4]$/).optional(), user_id: z.string().uuid().optional() }),
    summarize: (a) => `Fijar cuota de ${a.amount} para ${a.period ?? quarterOf(new Date())}`,
    run: async (c, a) => ok(await c.db.from("quotas").upsert({ org_id: c.orgId, user_id: a.user_id ?? c.userId, period: a.period ?? quarterOf(new Date()), amount: a.amount }, { onConflict: "org_id,user_id,period" }).select("id").single()),
  }),
  // ---------- CICLO GTM (BMAD) ----------
  def({
    name: "get_cycle_status", kind: "read",
    description: "Estado del Ciclo GTM: fase actual, documentos (brief, plan, arquitectura, revisión, retros) aprobados y en borrador, y siguientes pasos recomendados para el rol del usuario con el agente adecuado.",
    input: z.object({}),
    run: async (c) => {
      const { loadCycleState } = await import("@/lib/bmad/cycle-state");
      const { currentPhase, nextSteps } = await import("@/lib/bmad/phases");
      const s = await loadCycleState(c.db, c.orgId);
      return { fase: currentPhase(s.state), estado: s.state, documentos: s.artifacts, siguientes_pasos: nextSteps(s.state, c.roles) };
    },
  }),
  def({
    name: "get_artifact", kind: "read",
    description: "Lee el contenido de un documento del Ciclo GTM por id o la última versión de un tipo (brief, plan, architecture, readiness, retro, winloss).",
    input: z.object({ id: z.string().uuid().optional(), kind: z.enum(["brief", "plan", "architecture", "readiness", "retro", "winloss"]).optional() }),
    run: async (c, a) => {
      let q = c.db.from("gtm_artifacts").select("id,kind,title,version,status,content,updated_at").eq("org_id", c.orgId);
      q = a.id ? q.eq("id", a.id) : q.eq("kind", a.kind ?? "plan");
      return (await q.order("version", { ascending: false }).limit(1).maybeSingle()).data ?? { error: "No existe todavía" };
    },
  }),
  def({
    name: "draft_artifact", kind: "write",
    description: "Genera con IA un borrador nuevo (nueva versión) de un documento del Ciclo GTM: brief, plan, architecture, readiness, retro o winloss (winloss necesita deal_id). Las notas recogen lo hablado con el usuario.",
    input: z.object({ kind: z.enum(["brief", "plan", "architecture", "readiness", "retro", "winloss"]), notes: z.string().max(6000).optional(), deal_id: z.string().uuid().optional() }),
    summarize: (a) => `Crear borrador de ${({ brief: "Brief GTM", plan: "Plan GTM", architecture: "Arquitectura de revenue", readiness: "revisión antes de salir", retro: "retro trimestral", winloss: "win/loss" } as Record<string, string>)[a.kind]} en el Ciclo GTM`,
    run: async (c, a) => {
      const { draftArtifactCore } = await import("@/lib/bmad/drafting");
      return draftArtifactCore(c, { kind: a.kind, notes: a.notes ?? "", dealId: a.deal_id ?? null });
    },
  }),
];

export function getTool(name: string) {
  return TOOLS.find((t) => t.name === name);
}

export function canUseTool(tool: AgentTool, roles: string[]) {
  return !tool.roles || roles.some((r) => (tool.roles as string[]).includes(r));
}

export function toolsFor(roles: string[]) {
  return TOOLS.filter((t) => canUseTool(t, roles));
}

/** Validates args and runs a tool after checking role permissions. */
export async function executeTool(ctx: ToolCtx, name: string, rawArgs: unknown) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Acción desconocida: ${name}`);
  if (!canUseTool(tool, ctx.roles)) throw new Error("Tu rol no permite esta acción");
  const args = tool.input.parse(rawArgs ?? {});
  return tool.run(ctx, args);
}

export function summarizeAction(name: string, args: unknown) {
  const tool = getTool(name);
  if (!tool) return name;
  try { return tool.summarize ? tool.summarize(tool.input.parse(args)) : tool.description; } catch { return tool.description; }
}
