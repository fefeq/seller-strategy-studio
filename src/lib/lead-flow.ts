// Automatic flow a new lead goes through (pure, tested): its account is found or created, completed with data
// (Apollo → Clay via the orchestrator), key people are searched, and the AI proposes the next stage.
// The server side (inngest/tasks.server.ts runLeadFlow) records each step here in leads.flow.
import { FREE_MAIL_DOMAINS } from "./free-mail";


export const FLOW_STEPS = [
  { id: "account", label: "Cuenta" },
  { id: "complete", label: "Datos de la empresa" },
  { id: "people", label: "Personas clave" },
  { id: "proposal", label: "Propuesta de IA" },
] as const;
export type FlowStepId = (typeof FLOW_STEPS)[number]["id"];
/** done = hecho · skipped = no aplicaba (p. ej. sin dominio) · failed = falló (se reintenta al repetir) · blocked = presupuesto agotado */
export type FlowStatus = "done" | "skipped" | "failed" | "blocked";
export type FlowStep = { status: FlowStatus; note: string };
export type FlowPerson = { name: string; title: string | null; linkedin: string | null };
export type LeadFlow = { at: string; steps: Partial<Record<FlowStepId, FlowStep>>; people: FlowPerson[] };

export const STATUS_WORD: Record<FlowStatus, string> = { done: "Hecho", skipped: "No aplica", failed: "Falló", blocked: "En pausa" };

/** Reads leads.flow defensively (old rows have null). */
export function readFlow(raw: unknown): LeadFlow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<LeadFlow>;
  return { at: typeof r.at === "string" ? r.at : "", steps: r.steps && typeof r.steps === "object" ? r.steps : {}, people: Array.isArray(r.people) ? r.people : [] };
}

/** Business words that rank a person as a decision maker for the lead (higher = earlier). */
const RANK: [RegExp, number][] = [
  [/\b(ceo|founder|fundador|co-?founder|owner|president|managing director|director general)\b/i, 6],
  [/\b(cro|cmo|cto|coo|cfo|chief)\b/i, 5],
  [/\b(vp|vice ?president)\b/i, 4],
  [/\b(head|director|directora)\b/i, 3],
  [/\b(manager|lead|responsable)\b/i, 2],
];
export function seniorityRank(title: string | null | undefined): number {
  if (!title) return 0;
  for (const [re, n] of RANK) if (re.test(title)) return n;
  return 1;
}

/** The few people worth showing: most senior first, the lead's own contact left out, deduped by name. */
export function pickKeyPeople(rows: FlowPerson[], contactName: string | null, max = 5): FlowPerson[] {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const contact = contactName ? norm(contactName) : null;
  const seen = new Set<string>();
  return rows
    .filter((p) => p.name?.trim())
    .filter((p) => { const k = norm(p.name); if (k === contact || seen.has(k)) return false; seen.add(k); return true; })
    .map((p, i) => ({ p, i, r: seniorityRank(p.title) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .slice(0, max)
    .map((x) => x.p);
}

/** Lead → account match key: corporate email domain, else nothing (personal emails never create accounts by domain). */
export function corporateDomain(email: string | null | undefined): string | null {
  const d = email?.split("@")[1]?.trim().toLowerCase().replace(/^www\./, "");
  if (!d || !d.includes(".") || FREE_MAIL_DOMAINS.has(d)) return null;
  return d;
}

/** Whether the flow should run for this lead now (new and never run, or forced by a person). */
export function shouldRunFlow(lead: { enriched_at: string | null; stage: string }, force = false): boolean {
  if (force) return lead.stage !== "opportunity";
  return !lead.enriched_at && lead.stage !== "opportunity" && lead.stage !== "disqualified";
}

/** One line per step for the suggestion body, in flow order. */
export function flowLines(flow: LeadFlow): string[] {
  return FLOW_STEPS.flatMap((s) => { const st = flow.steps[s.id]; return st ? [`${s.label}: ${st.note}`] : []; });
}
