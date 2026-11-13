// Custom plays mould (NK-0171, SDD-20261113-plays-a-medida-modelo). Pure: no I/O.
// The AI only proposes; this code accepts or rejects with a reason in Spanish.

import type { GateDef, GateResult } from "../types";
import { CAPABILITIES, type Need, type Service } from "@/lib/orchestrator/planner";
import type { EmailStatus } from "@/lib/email-verification";

type Check = { ok: true } | { ok: false; reason: string };
const ok: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });

/* ---------- P-4: ids reserved so they never collide with play_states.play_id ---------- */
export const CUSTOM_PLAY_PREFIX = "custom:";
export const newCustomPlayId = (uuid: string) => `${CUSTOM_PLAY_PREFIX}${uuid}`;
export const isCustomPlayId = (id: string) => id.startsWith(CUSTOM_PLAY_PREFIX);

/* ---------- 6.1 (b): only unambiguous dates ---------- */
const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
};
/** ISO 8601 or a literal with the month written; anything else (03/04/2026) is unknown. */
export function parseEventDate(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})$/);
  if (m && MONTHS[m[2]!]) return iso(+m[3]!, MONTHS[m[2]!]!, +m[1]!);
  m = s.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS[m[1]!]) return iso(+m[3]!, MONTHS[m[1]!]!, +m[2]!);
  return null;
}

/* ---------- 6.1 (a): freshness on the event date, back and forward ---------- */
export type FreshnessWindow = { backDays: number; forwardDays: number };
const DAY = 86_400_000;
const daysFrom = (d: string, now: Date) => (Date.parse(`${d}T00:00:00Z`) - now.getTime()) / DAY;

export function checkFreshness(
  f: { eventDate: string | null; publishedDate: string | null },
  w: FreshnessWindow,
  now: Date,
): Check {
  if (!(w.backDays > 0) || !(w.forwardDays >= 0)) return no("La ventana de frescura necesita un número de días positivo.");
  if (!f.eventDate) return no("Fecha del evento desconocida: no pasa.");
  const e = daysFrom(f.eventDate, now);
  if (e < -w.backDays) return no(`El evento tiene más de ${w.backDays} días.`);
  if (e > w.forwardDays) return no(`El evento cae a más de ${w.forwardDays} días vista.`);
  if (e > 0 && f.publishedDate && daysFrom(f.publishedDate, now) < -w.backDays)
    return no("Evento futuro anunciado hace demasiado tiempo.");
  return ok;
}

/* ---------- 6.2: source registry derived from CAPABILITIES ---------- */
export type SourceKey = "news" | "web" | "reviews_or_cases" | "reviews" | "competitors" | "people" | "company" | "drive" | "posthog";
export const SOURCE_REGISTRY: Record<SourceKey, { label: string; need?: Need; service?: Service; returns: readonly GateField[] }> = {
  news: { label: "Noticias y señales", need: "news_signals", returns: ["event_date", "country", "headline_kind"] },
  web: { label: "Web de la cuenta", need: "research_account", returns: ["event_date", "country", "industry"] },
  reviews_or_cases: { label: "Casos y reseñas públicas", need: "case_studies", returns: ["event_date", "rating"] },
  reviews: { label: "Reseñas de competidores", need: "reviews", returns: ["event_date", "rating", "competitor"] },
  competitors: { label: "Competidores", need: "competitors", returns: ["competitor"] },
  people: { label: "Personas clave", need: "find_stakeholders", returns: ["seniority", "department"] },
  company: { label: "Datos de empresa", need: "enrich_account", returns: ["employees", "country", "industry"] },
  drive: { label: "Drive de la empresa", need: "read_document", service: "drive", returns: ["event_date"] },
  posthog: { label: "PostHog de la empresa", service: "posthog", returns: ["active_users"] },
};

export type SourceContext = { services: Service[]; posthog: boolean; driveFolder: boolean };
export function checkSources(sources: SourceKey[], c: SourceContext): Check {
  for (const k of sources) {
    const s = SOURCE_REGISTRY[k];
    if (!s) return no(`Fuente desconocida: ${k}.`);
    const services = s.service ? [s.service] : (s.need ? CAPABILITIES[s.need].options.map((o) => o.service) : []);
    if (!services.some((x) => c.services.includes(x))) return no(`Bloqueado: «${s.label}» no está disponible.`);
    if (k === "drive" && !c.driveFolder) return no("Bloqueado: la empresa no tiene carpeta de Drive.");
    if (k === "posthog" && !c.posthog) return no("Bloqueado: PostHog no está conectado en esta empresa.");
  }
  return ok;
}

/* ---------- 6.1: declarative gates, closed lists, compiled to GateDef ---------- */
export const GATE_FIELDS = [
  "event_date", "country", "industry", "headline_kind", "rating", "competitor",
  "seniority", "department", "employees", "active_users",
] as const;
export type GateField = (typeof GATE_FIELDS)[number];
export const GATE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains"] as const;
export type GateOp = (typeof GATE_OPS)[number];
export type DeclarativeGate = { field: GateField; op: GateOp; value: string | number | Array<string | number> };

function evalOp(op: GateOp, a: unknown, b: DeclarativeGate["value"]): boolean {
  switch (op) {
    case "eq": return a === b;
    case "neq": return a !== b;
    case "gt": return typeof a === "number" && a > Number(b);
    case "gte": return typeof a === "number" && a >= Number(b);
    case "lt": return typeof a === "number" && a < Number(b);
    case "lte": return typeof a === "number" && a <= Number(b);
    case "in": return Array.isArray(b) && b.includes(a as string | number);
    case "contains": return typeof a === "string" && a.toLowerCase().includes(String(b).toLowerCase());
  }
}

export function compileGates(defs: DeclarativeGate[]): { ok: true; gates: GateDef[] } | { ok: false; reason: string } {
  const gates: GateDef[] = [];
  for (const [i, d] of defs.entries()) {
    if (!(GATE_FIELDS as readonly string[]).includes(d.field)) return { ok: false, reason: `Campo no permitido: ${d.field}.` };
    if (!(GATE_OPS as readonly string[]).includes(d.op)) return { ok: false, reason: `Operador no permitido: ${d.op}.` };
    gates.push({
      key: `g${i + 1}:${d.field}`,
      check: (subject): GateResult => {
        const v = subject[d.field];
        if (v === undefined || v === null || v === "") return { v: "unknown", missing: d.field };
        return evalOp(d.op, v, d.value) ? { v: "pass" } : { v: "fail", reason: `${d.field} no cumple ${d.op}` };
      },
    });
  }
  return { ok: true, gates };
}

/* ---------- 6.1: test design ---------- */
export function validateTestDesign(d: { n?: number; k?: number; base?: number }): Check {
  if (d.n == null || d.k == null || d.base == null) return no("Faltan muestra, éxito o base.");
  if (!Number.isInteger(d.n) || d.n <= 0) return no("La muestra debe ser un entero positivo.");
  if (d.base !== d.n) return no("La base debe ser la muestra.");
  if (d.k <= 0) return no("El éxito no puede ser 0.");
  if (d.k > d.n) return no("El éxito no puede superar la muestra.");
  return ok;
}

/* ---------- P-6: minimal evidence, no contact data ---------- */
export const QUOTE_MAX = 280;
export type Evidence = {
  step: number; url: string; quote: string; observedAt: string;
  eventDate: string | null; dateFrom: "structured" | "literal" | "unknown";
};
const CONTACT = /[^\s@]+@[^\s@]+\.[^\s@]+|\+?\d[\d\s().-]{7,}\d/;
export function validateEvidence(e: Evidence): Check {
  if (!/^https?:\/\//.test(e.url)) return no("La evidencia necesita la URL de la fuente.");
  if (e.quote.length > QUOTE_MAX) return no(`La cita supera ${QUOTE_MAX} caracteres.`);
  if (CONTACT.test(e.quote)) return no("La cita no puede llevar datos de contacto.");
  if (e.dateFrom === "unknown" && e.eventDate) return no("Una fecha sin origen comprobado es desconocida.");
  return ok;
}

/* ---------- 6.1: cited message ---------- */
export type Step = { n: number; source: SourceKey; question: string; returns: string[] };
export type CitedMessage = { claims: Array<{ text: string; step: number }>; built: string; ask: string };
export function validateMessage(
  m: CitedMessage, steps: Step[], facts: Array<{ step: number; eventDate: string | null }>, w: FreshnessWindow, now: Date,
): Check {
  if (!m.claims.length || !m.built.trim() || !m.ask.trim()) return no("El mensaje necesita hechos, lo construido y una petición.");
  for (const c of m.claims) {
    if (!steps.some((s) => s.n === c.step)) return no(`La afirmación «${c.text}» cita un paso que no existe.`);
    const f = facts.find((x) => x.step === c.step);
    const fr = checkFreshness({ eventDate: f?.eventDate ?? null, publishedDate: null }, w, now);
    if (!fr.ok) return no(`La afirmación «${c.text}»: ${fr.reason}`);
  }
  return ok;
}

/* ---------- Q-7: optional «solo contacto verificado» per play ---------- */
export function contactGate(verifiedOnly: boolean, status: EmailStatus | null): Check {
  if (!verifiedOnly) return ok;
  return status === "verified" ? ok : no("Este play solo usa contactos con email verificado.");
}
