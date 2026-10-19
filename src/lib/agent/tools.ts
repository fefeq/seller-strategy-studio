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
import { DEAL_STAGES, BUYING_ROLES, type Role } from "@/lib/roles";
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
const STAGES = DEAL_STAGES.map((s) => s.id) as [string, ...string[]];
const stageLabel = (s: string) => DEAL_STAGES.find((x) => x.id === s)?.label ?? s;
const ok = <T>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };
const like = (q: string) => `%${q.replace(/[%_,()]/g, " ").trim()}%`;

export const TOOLS: AgentTool[] = [
  // ---------- READ ----------
  def({
    name: "get_overview", kind: "read",
    description: "Resumen del negocio: pipeline abierto, forecast, cobertura del trimestre, win rate, deals en riesgo y funnel self-service del trimestre.",
    input: z.object({}),
    run: async (c) => {
      const [deals, segs, hist, quotas, trials] = await Promise.all([
        c.db.from("deals").select("id,name,stage,amount,probability,health,close_date,closed_at,updated_at,source,segment_id,slip_count,forecast_category,meddpicc,partner_id").eq("org_id", c.orgId),
        c.db.from("segments").select("id,name,acv_min,acv_max,motion,cycle_days,sdr_per_ae,ae_per_se,cac_target,payback_months,win_rate_target,ae_quota,gross_margin_pct").eq("org_id", c.orgId),
        c.db.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at").eq("org_id", c.orgId),
        c.db.from("quotas").select("period,amount").eq("org_id", c.orgId),
        c.db.from("trials").select("segment_id,signed_up_at,activated_at,converted_at,mrr").eq("org_id", c.orgId),
      ]);
      const { start, end } = quarterRange(quarterOf(new Date()));
      const co = cohort((trials.data ?? []) as any[], start, end);
      return {
        moneda: c.currency,
        pipeline: buildSnapshot({ deals: (deals.data ?? []) as any, segments: (segs.data ?? []) as any, history: hist.data ?? [], quotas: (quotas.data ?? []) as any, currency: c.currency }),
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
    description: "Detalle de una cuenta: Account Plan, stakeholders, deals, reuniones y tareas abiertas.",
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
    name: "list_deals", kind: "read",
    description: "Lista deals con filtros opcionales: etapa, solo míos, solo en riesgo (salud roja) o con fecha de cierre pasada.",
    input: z.object({ stage: z.enum(STAGES).optional(), mine: z.boolean().optional(), at_risk: z.boolean().optional(), overdue: z.boolean().optional() }),
    run: async (c, a) => {
      let q = c.db.from("deals").select("id,name,stage,amount,probability,health,close_date,owner_id,account_id,forecast_category").eq("org_id", c.orgId).order("close_date");
      if (a.stage) q = q.eq("stage", a.stage);
      else q = q.not("stage", "in", "(won,lost)");
      if (a.mine) q = q.eq("owner_id", c.userId);
      if (a.at_risk) q = q.eq("health", "red");
      if (a.overdue) q = q.lt("close_date", new Date().toISOString().slice(0, 10));
      return ok(await q.limit(40));
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
    description: "Crea un deal (oportunidad).",
    input: z.object({ name: z.string().min(1), account_id: z.string().uuid().optional(), amount: z.number().nonnegative().optional(), close_date: z.string().optional().describe("AAAA-MM-DD"), stage: z.enum(STAGES).optional() }),
    summarize: (a) => `Crear el deal «${a.name}»${a.amount ? ` por ${a.amount}` : ""}${a.stage ? ` en ${stageLabel(a.stage)}` : ""}`,
    run: async (c, a) => ok(await c.db.from("deals").insert({ ...a, stage: a.stage ?? "discovery", org_id: c.orgId, owner_id: c.userId }).select("id,name").single()),
  }),
  def({
    name: "update_deal", kind: "write",
    description: "Actualiza un deal: etapa, importe, fecha de cierre, salud (green/yellow/red), categoría de forecast (pipeline/best_case/commit) o un campo MEDDPICC.",
    input: z.object({
      deal_id: z.string().uuid(),
      stage: z.enum(STAGES).optional(), amount: z.number().nonnegative().optional(), close_date: z.string().optional(),
      health: z.enum(["green", "yellow", "red"]).optional(), forecast_category: z.enum(["pipeline", "best_case", "commit"]).optional(),
      meddpicc_field: z.string().optional(), meddpicc_value: z.string().optional(),
    }),
    summarize: (a) => {
      const parts = [a.stage && `etapa → ${stageLabel(a.stage)}`, a.amount != null && `importe → ${a.amount}`, a.close_date && `cierre → ${a.close_date}`, a.health && `salud → ${a.health}`, a.forecast_category && `forecast → ${a.forecast_category}`, a.meddpicc_field && `MEDDPICC ${a.meddpicc_field}`].filter(Boolean);
      return `Actualizar el deal: ${parts.join(", ") || "sin cambios"}`;
    },
    run: async (c, a) => {
      const { deal_id, meddpicc_field, meddpicc_value, ...rest } = a;
      const patch: any = { ...rest };
      if (meddpicc_field) {
        const cur = ok(await c.db.from("deals").select("meddpicc").eq("org_id", c.orgId).eq("id", deal_id).single());
        patch.meddpicc = { ...((cur as any)?.meddpicc ?? {}), [meddpicc_field]: meddpicc_value ?? "" };
      }
      return ok(await c.db.from("deals").update(patch).eq("org_id", c.orgId).eq("id", deal_id).select("id,name,stage,close_date").single());
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
    description: "Planifica una reunión (Meeting Planner).",
    input: z.object({ title: z.string().min(1), account_id: z.string().uuid().optional(), deal_id: z.string().uuid().optional(), scheduled_at: z.string().optional().describe("ISO 8601"), objective: z.string().optional() }),
    summarize: (a) => `Planificar la reunión «${a.title}»${a.scheduled_at ? ` el ${a.scheduled_at.slice(0, 16).replace("T", " ")}` : ""}`,
    run: async (c, a) => ok(await c.db.from("meetings").insert({ ...a, org_id: c.orgId }).select("id,title").single()),
  }),
  def({
    name: "prepare_meeting_brief", kind: "write",
    description: "Genera con IA el Call Prep de una reunión y lo guarda.",
    input: z.object({ meeting_id: z.string().uuid() }),
    summarize: () => "Generar y guardar el Call Prep de la reunión",
    run: async (c, a) => {
      const m = ok(await c.db.from("meetings").select("*").eq("org_id", c.orgId).eq("id", a.meeting_id).single()) as any;
      const acc = m.account_id ? await TOOLS.find((t) => t.name === "get_account")!.run(c, { account_id: m.account_id }) : {};
      const [pos, pillars] = await Promise.all([
        c.db.from("positioning").select("one_liner,key_benefit,differentiator,competitive_alternative").eq("org_id", c.orgId).maybeSingle(),
        c.db.from("messaging_pillars").select("title,message,proof").eq("org_id", c.orgId),
      ]);
      const brief = await ask(
        "Eres un coach de ventas B2B. Prepara un Call Prep conciso en español neutro (tú), en markdown: objetivo, contexto de la cuenta, stakeholders y qué le importa a cada uno, preguntas de discovery, objeciones probables con respuesta, y próximo paso a pedir. Usa solo los datos dados.",
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
    description: "Crea o actualiza (si se pasa segment_id) un segmento con rango de ACV, motion, win rate objetivo (%) y cuota anual AE.",
    input: z.object({ segment_id: z.string().uuid().optional(), name: z.string().min(1), acv_min: z.number().optional(), acv_max: z.number().optional(), motion: z.enum(["plg", "inside", "field", "strategic"]).optional(), win_rate_target: z.number().optional(), ae_quota: z.number().optional() }),
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
    description: "Estado del Ciclo GTM: fase actual, documentos (Brief, Plan, Arquitectura, revisión, retros) aprobados y en borrador, y siguientes pasos recomendados para el rol del usuario con el agente adecuado.",
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
    summarize: (a) => `Crear borrador de ${({ brief: "GTM Brief", plan: "Plan GTM", architecture: "Arquitectura de Revenue", readiness: "revisión antes de salir", retro: "retro trimestral", winloss: "win/loss" } as Record<string, string>)[a.kind]} en el Ciclo GTM`,
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
