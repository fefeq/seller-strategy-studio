// Exposes the agent's single tool registry over MCP. Reads run now; writes become
// pending actions the user confirms in the app (Sugerencias), exactly like the in-app agent.
import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import type { z } from "zod";
import { TOOLS, canUseTool, executeTool, summarizeAction } from "@/lib/agent/tools";
import { mcpCtx, json, text } from "../context";
import { errorText } from "@/lib/errors";

const APP_URL = "https://nokko.ai/inbox";

// Human titles shown by Claude, ChatGPT, Codex… A tool missing here falls back to its id.
export const TITLES: Record<string, string> = {
  add_deal_line: "Añadir línea a un deal",
  add_mutual_action_item: "Añadir hito al plan de acción mutuo",
  assign_deal: "Asignar deal",
  assign_suggestion: "Asignar sugerencia",
  complete_mutual_action_item: "Completar hito del plan de acción mutuo",
  complete_task: "Completar tarea",
  create_account: "Crear cuenta",
  create_deal: "Crear deal",
  create_experiment: "Crear prototipo (Theory U)",
  create_icp: "Crear perfil ICP",
  create_lead: "Dar de alta lead",
  create_meeting: "Planificar reunión",
  create_person: "Añadir persona",
  create_pillar: "Crear pilar de mensaje",
  create_stakeholder: "Añadir stakeholder",
  create_task: "Crear tarea",
  decide_approval: "Decidir aprobación",
  decide_suggestion: "Gestionar sugerencia",
  draft_artifact: "Redactar documento del ciclo GTM",
  draft_followup: "Redactar seguimiento de un lead",
  draft_proposal: "Redactar propuesta de una cuenta",
  get_account: "Ver cuenta",
  get_artifact: "Ver documento del ciclo GTM",
  get_cycle_status: "Estado del ciclo GTM",
  get_deal: "Ver deal",
  get_lead: "Ver lead",
  get_meeting: "Ver reunión",
  get_overview: "Resumen de la empresa",
  get_pipeline_board: "Tablero del trimestre",
  get_setup_status: "Estado de la configuración",
  get_stripe_metrics: "Ingresos en Stripe",
  get_weekly_report: "Informe semanal",
  list_accounts: "Listar cuentas",
  list_approvals: "Listar aprobaciones",
  list_deals: "Listar deals",
  list_leads: "Listar leads",
  list_meetings: "Listar reuniones",
  list_people: "Listar personas",
  list_products: "Listar productos",
  list_stages: "Listar etapas del pipeline",
  list_suggestions: "Listar sugerencias",
  list_tasks: "Listar tareas",
  listening_coaching: "Coaching de escucha",
  log_call: "Registrar llamada",
  log_touch: "Registrar toque con una cuenta",
  log_trial: "Registrar prueba (self-service)",
  prepare_meeting_brief: "Preparar brief de reunión",
  remove_deal_line: "Quitar línea de un deal",
  request_approval: "Pedir aprobación",
  research_stakeholder: "Investigación de stakeholders",
  review_call: "Revisar llamada",
  save_call_notes: "Guardar notas de llamada en 5 líneas",
  search: "Buscar",
  search_knowledge: "Buscar en el conocimiento",
  set_currency: "Cambiar moneda",
  set_quota: "Fijar cuota",
  update_account: "Actualizar cuenta",
  update_deal: "Actualizar deal",
  update_deal_line: "Cambiar línea de un deal",
  update_lead: "Actualizar lead",
  update_meeting: "Actualizar reunión",
  update_person: "Actualizar persona",
  update_positioning: "Actualizar posicionamiento",
  update_stakeholder: "Actualizar stakeholder",
  update_task: "Actualizar tarea",
  upsert_account_plan: "Guardar plan de cuenta",
  upsert_segment: "Crear o actualizar segmento",
};

export const agentMcpTools = TOOLS.map((t) =>
  defineTool({
    name: t.name,
    title: TITLES[t.name] ?? t.name.replace(/_/g, " "),
    description: t.kind === "write" ? `${t.description} (Queda pendiente: el usuario la confirma en Nokko.)` : t.description,
    inputSchema: ((t.input as z.ZodObject<z.ZodRawShape>).shape ?? {}) as z.ZodRawShape,
    annotations: t.kind === "read"
      ? { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
      : { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async (args, ctx) => {
      const c = await mcpCtx(ctx);
      if (!canUseTool(t, c.roles)) throw new ToolError("Tu rol en esta empresa no permite esta acción");
      if (t.kind === "read") {
        try { return json(await executeTool(c, t.name, args)); } catch (e) { throw new ToolError((e as Error).message); }
      }
      const parsed = t.input.safeParse(args ?? {});
      if (!parsed.success) throw new ToolError(`Datos no válidos: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
      const summary = summarizeAction(t.name, parsed.data);
      const { error } = await c.db.from("agent_pending_actions").insert({ org_id: c.orgId, user_id: c.userId, tool: t.name, args: parsed.data as never, summary, source: "mcp" });
      if (error) throw new ToolError(errorText(error));
      return text(`Acción preparada en ${c.orgName}: «${summary}». El usuario debe confirmarla en Nokko → Sugerencias (${APP_URL}).`);
    },
  }),
);
