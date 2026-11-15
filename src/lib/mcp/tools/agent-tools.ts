// Exposes the agent's single tool registry over MCP. Reads run now; writes become
// pending actions the user confirms in the app (Sugerencias), exactly like the in-app agent.
import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import type { z } from "zod";
import { TOOLS, canUseTool, executeTool, summarizeAction } from "@/lib/agent/tools";
import { mcpCtx, json, text } from "../context";
import { errorText } from "@/lib/errors";

const APP_URL = "https://nokko.ai/inbox";
const EXTERNAL =
  /^(clay_|apollo_|drive_|linkedin_|company_job_postings$|competitor_reviews$|create_battlecard_from_reviews$|sync_product_data$|start_account_report$|start_icp_account_list$|enrich_accounts_table$|research_account$|refresh_account_signals$|research_stakeholder$)/;

// Human titles shown by Claude, ChatGPT, Codex… A tool missing here falls back to its id.
export const TITLES: Record<string, string> = {
  list_my_pending_actions: "Mis pendientes y umbral del piloto",
  set_autopilot_threshold: "Proponer umbral del piloto",
  autopilot_prepare_meeting: "Preparar reunión del piloto",
  autopilot_review_account: "Repasar cuenta del piloto",
  start_onboarding_read: "Empezar el onboarding desde la web",
  list_onboarding_blocks: "Bloques de la propuesta de onboarding",
  approve_onboarding_block: "Aprobar un bloque del onboarding",
  list_memories: "Ver la Memoria",
  remember: "Guardar en Memoria",
  list_rules: "Reglas del equipo",
  list_connections: "Estado de las conexiones",
  get_advisor_recommendations: "Recomendaciones del Asesor GTM",
  update_icp: "Editar un ICP",
  update_pillar: "Editar un pilar de mensaje",
  check_delete: "Qué se pierde al borrar (segmento, ICP o pilar)",
  delete_segment: "Borrar un segmento",
  delete_icp: "Borrar o archivar un ICP",
  delete_pillar: "Borrar o archivar un pilar de mensaje",
  confirm_fields: "Confirmar campos",
  list_recent_changes: "Cambios de las últimas 24 horas",
  undo_change: "Deshacer un cambio",
  enrich_accounts_table: "Completar cuentas en tabla (Parallel)",
  get_icp_account_list: "Empresas encontradas por ICP",
  start_icp_account_list: "Buscar empresas por ICP (Parallel)",
  get_account_report: "Informe profundo de una cuenta",
  start_account_report: "Investigar a fondo una cuenta (Parallel)",
  get_product_usage: "Uso del producto por cuenta (PostHog)",
  sync_product_data: "Leer ahora los datos de PostHog",
  create_battlecard_from_reviews: "Battlecard desde reseñas de G2",
  competitor_reviews: "Reseñas de un competidor en G2",
  company_job_postings: "Ofertas de empleo de una cuenta",
  linkedin_profile_posts: "Publicaciones de LinkedIn de un stakeholder",
  linkedin_role_check: "Cambio de cargo en LinkedIn de un stakeholder",
  linkedin_company_posts: "Publicaciones de LinkedIn de una cuenta",
  add_deal_line: "Añadir línea a un deal",
  add_mutual_action_item: "Añadir hito al plan de acción mutuo",
  assign_deal: "Asignar deal",
  apollo_enrich_account: "Completar cuenta con Apollo",
  complete_account: "Completar datos de una cuenta",
  find_key_people: "Buscar personas clave",
  find_icp_companies: "Buscar empresas por ICP",
  integration_budget: "Gasto en integraciones del mes",
  apollo_find_companies: "Buscar empresas en Apollo",
  apollo_find_people: "Buscar personas de una cuenta en Apollo",
  apollo_reveal_contacts: "Revelar contactos con Apollo",
  apollo_reveal_stakeholder: "Revelar email o móvil de un stakeholder con Apollo",
  assign_suggestion: "Asignar sugerencia",
  clay_enrich_account: "Completar cuenta con Clay",
  clay_find_companies: "Buscar empresas en Clay",
  clay_find_people: "Buscar personas de una cuenta en Clay",
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
  drive_import_to_knowledge: "Importar archivo de Drive al hub",
  drive_link_account_folder: "Carpeta de Drive de una cuenta",
  drive_list_account_files: "Archivos de Drive de una cuenta",
  drive_read_file: "Leer un archivo de Drive",
  drive_save_document: "Guardar documento en Drive",
  drive_search: "Buscar en Google Drive",
  draft_artifact: "Redactar documento del ciclo GTM",
  draft_followup: "Redactar seguimiento de un lead",
  draft_proposal: "Redactar propuesta de una cuenta",
  get_account: "Ver cuenta",
  get_artifact: "Ver documento del ciclo GTM",
  get_cycle_status: "Estado del ciclo GTM",
  get_deal: "Ver deal",
  get_funnel_diagnosis: "Diagnóstico AARRR por segmento",
  get_lead: "Ver lead",
  get_meeting: "Ver reunión",
  get_overview: "Resumen de la empresa",
  get_pipeline_board: "Tablero del trimestre",
  get_setup_status: "Estado de la configuración",
  get_stripe_metrics: "Ingresos en Stripe",
  get_weekly_report: "Informe semanal",
  list_accounts: "Listar cuentas",
  list_pending_imports: "Ver importaciones pendientes",
  list_approvals: "Listar aprobaciones",
  list_deals: "Listar deals",
  list_leads: "Listar leads",
  list_meetings: "Listar reuniones",
  list_people: "Listar personas",
  list_products: "Listar productos",
  list_segments: "Listar segmentos",
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
  refresh_account_signals: "Buscar noticias recientes de una cuenta",
  research_account: "Investigar una cuenta en la web",
  list_account_signals: "Ver señales y noticias de cuentas",
  list_plays: "Ver los Plays GTM y su estado",
  get_play: "Ver un Play GTM",
  list_play_teams: "Ver los equipos de plays",
  set_play_enabled: "Activar o pausar un Play GTM",
  propose_custom_play: "Proponer un play a medida",
  list_custom_plays: "Ver los plays a medida",
  activate_custom_play: "Activar un play a medida",
  pause_custom_play: "Pausar un play a medida",
  list_business_lines: "Ver las líneas de negocio",
  get_onboarding_status: "Ver el estado del onboarding",
  diagnose_play_teams: "Diagnosticar equipos de plays",
  save_play_plan: "Guardar el plan de equipos de plays",
  add_default_rules: "Añadir las reglas base",
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
    description:
      t.kind === "write"
        ? `${t.description} (Queda pendiente: el usuario la confirma en Nokko.)`
        : t.description,
    inputSchema: ((t.input as z.ZodObject<z.ZodRawShape>).shape ?? {}) as z.ZodRawShape,
    // Clay and Apollo tools reach an outside data source and spend the workspace's allowance or credits.
    annotations:
      t.kind === "read"
        ? {
            readOnlyHint: true,
            idempotentHint: !EXTERNAL.test(t.name),
            openWorldHint: EXTERNAL.test(t.name),
          }
        : { readOnlyHint: false, destructiveHint: false, openWorldHint: EXTERNAL.test(t.name) },
    handler: async (args, ctx) => {
      const c = await mcpCtx(ctx);
      if (!canUseTool(t, c.roles))
        throw new ToolError("Tu rol en esta empresa no permite esta acción");
      if (t.kind === "read") {
        try {
          return json(await executeTool(c, t.name, args));
        } catch (e) {
          throw new ToolError((e as Error).message);
        }
      }
      const parsed = t.input.safeParse(args ?? {});
      if (!parsed.success)
        throw new ToolError(
          `Datos no válidos: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        );
      let summary = summarizeAction(t.name, parsed.data);
      if (t.spends) {
        const { spendEstimateLine, withEstimate } = await import("@/lib/agent/spend-confirm");
        summary = withEstimate(summary, t.name, await spendEstimateLine(c.db, c.orgId, t.name));
      }
      const { error } = await c.db.from("agent_pending_actions").insert({
        org_id: c.orgId,
        user_id: c.userId,
        tool: t.name,
        args: parsed.data as never,
        summary,
        source: "mcp",
      });
      if (error) throw new ToolError(errorText(error));
      return text(
        `Acción preparada en ${c.orgName}: «${summary}». El usuario debe confirmarla en Nokko → Sugerencias (${APP_URL}).`,
      );
    },
  }),
);
