// Inngest event names and payloads used by Nokko (pure; shared by senders and functions).
export const EV = {
  ping: "nokko/ping",
  orgMaintenance: "nokko/org.maintenance",
  leadCreated: "nokko/lead.created",
  leadContacted: "nokko/lead.contacted",
  leadChanged: "nokko/lead.changed",
  jobRequested: "nokko/job.requested",
  parallelRun: "nokko/parallel.run",
} as const;

export type NokkoEvent =
  | { name: typeof EV.ping; data: { at: string } }
  | { name: typeof EV.orgMaintenance; data: { org_id: string; hour: string } }
  | { name: typeof EV.leadCreated; data: { org_id: string; lead_id: string } }
  | { name: typeof EV.leadContacted; data: { org_id: string; lead_id: string; contacted_at: string } }
  | { name: typeof EV.leadChanged; data: { org_id: string; lead_id: string; stage: string } }
  | { name: typeof EV.jobRequested; data: { job_id: string } }
  | { name: typeof EV.parallelRun; data: { research_id: string } };

/** Background is used only when Inngest answered recently (its heartbeat is fresh). */
export const HEARTBEAT_LOCK = "inngest:heartbeat";
export const HEARTBEAT_FRESH_MS = 3 * 3_600_000;
export const isHeartbeatFresh = (lastRunAt: string | null | undefined, now = new Date()) =>
  !!lastRunAt && now.getTime() - new Date(lastRunAt).getTime() < HEARTBEAT_FRESH_MS;

/** The hour bucket that keeps one maintenance run per company and hour (idempotency key). */
export const hourKey = (d: Date) => d.toISOString().slice(0, 13);

/** Background job kinds and how they read in the app. */
export const JOB_KINDS = [
  "battlecard", "stakeholder_research", "account_signals", "drive_import", "complete_account",
  "key_people", "icp_companies", "qualify_leads",
  "discover", "autopilot_now", "weekly_report", "posthog_sync", "playbook_library",
  "debate", "draft_artifact", "deep_review", "account_research", "drive_summaries", "onboarding_read", "deal_coach",
] as const;
export type JobKind = (typeof JOB_KINDS)[number];
export const JOB_LABEL: Record<JobKind, string> = {
  battlecard: "Battlecard desde reseñas de G2",
  stakeholder_research: "Research con IA del stakeholder",
  account_signals: "Novedades de la cuenta",
  drive_import: "Importación desde Google Drive",
  complete_account: "Completar datos de la cuenta",
  key_people: "Buscar personas clave",
  icp_companies: "Buscar empresas por ICP",
  qualify_leads: "Calificar leads con IA",
  discover: "Búsqueda de Descubiertos",
  autopilot_now: "Piloto automático",
  weekly_report: "Informe semanal",
  posthog_sync: "Leer PostHog",
  playbook_library: "Biblioteca de playbooks",
  debate: "Debate multiagente",
  draft_artifact: "Redactar documento",
  deep_review: "Revisión a fondo",
  account_research: "Investigar la cuenta en la web",
  drive_summaries: "Resumir documentos de Drive",
  onboarding_read: "Nokko lee tus fuentes",
  deal_coach: "Deal Coach",
};
