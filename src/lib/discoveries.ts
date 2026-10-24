// «Descubiertos» (pure, tested): the weekly inbox of companies, contacts and competitors Nokko finds.
// Keys make every find unique per company (a dismissed one never comes back); the server side is discoveries.server.ts.
import type { Fact } from "@/lib/memory";

export type DiscoveryKind = "company" | "contact" | "competitor";
export const KIND_LABEL: Record<DiscoveryKind, { one: string; many: string }> = {
  company: { one: "Empresa", many: "Empresas" },
  contact: { one: "Contacto", many: "Contactos" },
  competitor: { one: "Competidor", many: "Competidores" },
};
export const DISMISS_REASONS = ["No encaja con el ICP", "Ya lo conocemos", "Demasiado pequeña o grande", "No es relevante ahora"] as const;

/** Company names compared without legal suffixes, accents or punctuation. */
export function normName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(inc|llc|ltd|gmbh|s\.?l\.?u?|s\.?a\.?|corp|co|plc|ag|bv)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
export const cleanDomainKey = (d: string | null | undefined) => (d ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";

export function dedupeKey(kind: DiscoveryKind, d: { name: string; domain?: string | null; linkedin?: string | null; account_id?: string | null }): string {
  if (kind === "company") return `company:${cleanDomainKey(d.domain) || normName(d.name)}`;
  if (kind === "contact") return `contact:${(d.linkedin ?? "").trim().toLowerCase().replace(/\/+$/, "") || `${d.account_id ?? ""}:${normName(d.name)}`}`;
  return `competitor:${normName(d.name)}`;
}

/** The competitors the company already lists in its positioning (comma, semicolon or line separated). */
export function knownCompetitors(text: string | null | undefined): Set<string> {
  return new Set((text ?? "").split(/[,;\n]|\s+y\s+/).map((s) => normName(s.replace(/\(.*?\)/g, ""))).filter(Boolean));
}
export function appendCompetitor(text: string | null | undefined, name: string): string {
  const cur = (text ?? "").trim();
  if (knownCompetitors(cur).has(normName(name))) return cur;
  return cur ? `${cur}, ${name.trim()}` : name.trim();
}

export type CompetitorFind = { name: string; url: string | null; why: string };
/** JSON schema the AI answers with when reading the web for competitors. */
export const COMPETITOR_SCHEMA = {
  type: "object", additionalProperties: false, required: ["competitors"],
  properties: { competitors: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "url", "why"], properties: { name: { type: "string" }, url: { type: ["string", "null"] }, why: { type: "string" } } } } },
} as const;

/** Parses the AI answer: drops known, own and repeated names; at most `max`. */
export function parseCompetitors(raw: string, known: Set<string>, own: string, max = 5): CompetitorFind[] {
  let list: unknown;
  try { list = (JSON.parse(raw) as { competitors?: unknown }).competitors; } catch { return []; }
  if (!Array.isArray(list)) return [];
  const seen = new Set([...known, normName(own)]);
  const out: CompetitorFind[] = [];
  for (const c of list as Partial<CompetitorFind>[]) {
    const name = String(c?.name ?? "").trim().slice(0, 120);
    const key = normName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, url: typeof c.url === "string" && /^https?:\/\//.test(c.url) ? c.url : null, why: String(c?.why ?? "").trim().slice(0, 300) });
    if (out.length >= max) break;
  }
  return out;
}

/** Why a company found by ICP search fits, from what is known about it. */
export function companyReason(icpName: string, r: { industry: string | null; size: string | null; country: string | null }): string {
  const bits = [r.industry, r.size ? `${r.size} empleados` : null, r.country].filter(Boolean);
  return `Encaja con el ICP «${icpName}»${bits.length ? `: ${bits.join(" · ")}` : ""}.`;
}

/** Due once a week: never run, or the last run is 7 days old. */
export function discoveryDue(lastRun: string | null | undefined, now = new Date()): boolean {
  return !lastRun || now.getTime() - new Date(lastRun).getTime() >= 7 * 86_400_000 - 3_600_000;
}

/** What Nokko remembers when someone dismisses a find, so the next searches avoid it. */
export function dismissMemory(kind: DiscoveryKind, name: string, reason: string | null): Fact {
  const what = KIND_LABEL[kind].one.toLowerCase();
  return { content: `Descartado en Descubiertos (${what}): ${name}${reason ? `. Motivo: ${reason}` : ""}.`.slice(0, 600), scope: "company", kind: "outcome", account_id: null, replaces: null };
}

/** JSON schema for the AI judging which ICP-search candidates really fit. */
export const FIT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["judgments"],
  properties: { judgments: { type: "array", items: { type: "object", additionalProperties: false, required: ["index", "fit", "reason"], properties: { index: { type: "integer" }, fit: { type: "integer" }, reason: { type: "string" } } } } },
} as const;

/** Keeps candidates the AI rated at least `min` (0–100), with its reason; unknown indexes and bad JSON are ignored. */
export function parseFitJudgments(raw: string, count: number, min = 60): Map<number, { fit: number; reason: string }> {
  const out = new Map<number, { fit: number; reason: string }>();
  let list: unknown;
  try { list = (JSON.parse(raw) as { judgments?: unknown }).judgments; } catch { return out; }
  if (!Array.isArray(list)) return out;
  for (const j of list as { index?: unknown; fit?: unknown; reason?: unknown }[]) {
    const i = Number(j?.index), fit = Number(j?.fit);
    if (!Number.isInteger(i) || i < 0 || i >= count || !Number.isFinite(fit) || fit < min || out.has(i)) continue;
    out.set(i, { fit: Math.round(Math.min(100, fit)), reason: String(j.reason ?? "").trim().slice(0, 300) });
  }
  return out;
}

/** «10001+» or «51-200 empleados» → one readable size label. */
export function sizeLabel(size: string | null | undefined): string | null {
  const s = (size ?? "").trim();
  if (!s) return null;
  return /emplead/i.test(s) ? s : `${s} empleados`;
}
