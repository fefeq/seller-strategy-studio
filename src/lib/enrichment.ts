// Enrichment of account data (sector, size, country) when a lead arrives. Pure rules: which source wins,
// what may be written, what a page must say before a value is accepted. The network side is in
// enrichment.server.ts. Priority: what a person typed > provider > web. Nothing manual is overwritten.
import { COUNTRY_CODES } from "./assignment";
import { FREEMAIL } from "./leads";

export const ENRICH_FIELDS = ["industry", "size", "country"] as const;
export type EnrichField = (typeof ENRICH_FIELDS)[number];

export type EnrichSource = "provider" | "web";
/** Higher wins. A person (no entry in auto_filled) is above every source. */
export const SOURCE_PRIORITY: Record<EnrichSource, number> = { provider: 2, web: 1 };
export const SOURCE_LABEL: Record<string, string> = { provider: "Proveedor de datos", web: "Web de la empresa" };

export type AutoMark = { source: string; at: string };
export type AutoFilled = Partial<Record<EnrichField, AutoMark>>;
export type AccountData = { industry: string | null; size: string | null; country: string | null; auto_filled?: unknown };
export type Patch = Partial<Record<EnrichField, string>>;

export function readAutoFilled(raw: unknown): AutoFilled {
  const out: AutoFilled = {};
  if (!raw || typeof raw !== "object") return out;
  for (const f of ENRICH_FIELDS) {
    const m = (raw as Record<string, unknown>)[f];
    if (m && typeof m === "object" && typeof (m as AutoMark).source === "string") out[f] = { source: (m as AutoMark).source, at: String((m as AutoMark).at ?? "") };
  }
  return out;
}

const blank = (v: string | null | undefined) => !v || !v.trim();

/** May `source` write `field`? Empty: yes. Filled by a lower source: yes. Manual or equal/higher source: no. */
export function decideFill(account: AccountData, field: EnrichField, source: EnrichSource): boolean {
  if (blank(account[field])) return true;
  const mark = readAutoFilled(account.auto_filled)[field];
  if (!mark) return false;
  const current = SOURCE_PRIORITY[mark.source as EnrichSource] ?? 0;
  return SOURCE_PRIORITY[source] > current;
}

/** Fields still worth asking for: the ones this source may write. */
export function missingFields(account: AccountData, source: EnrichSource): EnrichField[] {
  return ENRICH_FIELDS.filter((f) => decideFill(account, f, source));
}

/** The company switches enrichment off in lead_settings.sla.auto_enrichment = false; on by default. */
export function readAutoEnrichment(sla: unknown): boolean {
  return !(sla && typeof sla === "object" && !Array.isArray(sla) && (sla as Record<string, unknown>)["auto_enrichment"] === false);
}

/** «Web de la empresa · 23 oct 2026» for the badge next to a filled field. */
export function autoFillText(mark: AutoMark | undefined): string | null {
  if (!mark) return null;
  const d = new Date(mark.at);
  const when = Number.isNaN(d.getTime()) ? "" : ` · ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;
  return `${SOURCE_LABEL[mark.source] ?? mark.source}${when}`;
}

// ---- Country ----
let nameToCode: Map<string, string> | null = null;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function countryIndex() {
  if (nameToCode) return nameToCode;
  const m = new Map<string, string>();
  for (const lang of ["es", "en"]) {
    let dn: Intl.DisplayNames | null = null;
    try { dn = new Intl.DisplayNames([lang], { type: "region" }); } catch { /* no Intl data */ }
    for (const code of COUNTRY_CODES) {
      const n = dn?.of(code);
      if (n && n !== code) m.set(fold(n), code);
    }
  }
  const extra: Record<string, string> = { "estados unidos": "US", "ee uu": "US", "ee. uu.": "US", usa: "US", "reino unido": "GB", uk: "GB", espana: "ES", spain: "ES" };
  for (const [k, v] of Object.entries(extra)) m.set(fold(k), v);
  nameToCode = m;
  return m;
}

/** «España», «spain», «es» → "ES"; anything we cannot map with certainty → null. */
export function normalizeCountry(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return countryIndex().get(fold(s)) ?? null;
}

// ---- Domains ----
export const BLOCKED_HOSTS = ["linkedin.com", "lnkd.in"];

export function isFreeEmailDomain(domain: string | null | undefined): boolean {
  return !!domain && FREEMAIL.has(domain.trim().toLowerCase());
}

/** Never read LinkedIn (or its short links): the product only uses the official API (CA-11). */
export function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  return BLOCKED_HOSTS.some((b) => h === b || h.endsWith("." + b));
}

/** Only public, named hosts: no IPs, no localhost, no single-label or internal names, no ports (SSRF guard). */
export function isSafePublicHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  if (h.length > 253 || !/^[a-z0-9.-]+$/.test(h)) return false;
  if (!h.includes(".") || h.startsWith(".") || h.endsWith(".") || h.includes("..")) return false;
  if (/^\d+(\.\d+)*$/.test(h) || /^[0-9.]+$/.test(h)) return false;
  if (/\.(local|localhost|internal|lan|intranet|home|corp|test|invalid|example)$/.test(h)) return false;
  if (!/^[a-z]{2,}$/.test(h.split(".").pop() ?? "")) return false;
  return !isBlockedHost(h);
}

// ---- Page text ----
export function extractVisibleText(html: string, max = 12000): string {
  const t = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, max);
}

// ---- Extraction by the model, accepted only with evidence ----
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["industry", "industry_evidence", "employees", "employees_evidence", "country", "country_evidence"],
  properties: {
    industry: { type: ["string", "null"] },
    industry_evidence: { type: ["string", "null"] },
    employees: { type: ["integer", "null"] },
    employees_evidence: { type: ["string", "null"] },
    country: { type: ["string", "null"] },
    country_evidence: { type: ["string", "null"] },
  },
} as const;

export const EXTRACTION_SYSTEM =
  "Lees texto de la web de una empresa y extraes tres datos. Solo devuelves un dato si el texto lo afirma de forma explícita; " +
  "no deduzcas ni estimes. Para cada dato incluyes en *_evidence la frase EXACTA copiada del texto que lo respalda. " +
  "industry: sector de la empresa en español, 1-3 palabras. employees: número de empleados si el texto lo dice. " +
  "country: país donde está la empresa (sede), solo si el texto lo dice. Si el texto no lo dice, devuelve null en el dato y en su evidencia.";

export function extractionPrompt(name: string, text: string): string {
  return `Empresa: ${name}\n\nTexto de su web:\n"""\n${text}\n"""`;
}

const squash = (s: string) => fold(s).replace(/\s+/g, " ");

/** True when the quoted evidence really appears in the page text. */
export function evidenceInText(evidence: unknown, text: string): boolean {
  if (typeof evidence !== "string") return false;
  const e = squash(evidence).replace(/^[\s"'“”«»]+|[\s"'“”«»]+$/g, "");
  return e.length >= 6 && squash(text).includes(e);
}

/** The number must be written in the quoted evidence («200», «1.200», «1,200»). */
function numberInEvidence(n: number, evidence: string): boolean {
  const plain = evidence.replace(/(?<=\d)[.,\s](?=\d{3}(\D|$))/g, "");
  return new RegExp(`(^|\\D)${n}(\\D|$)`).test(plain);
}

/** Parses the model answer; a value without evidence found in the page is dropped. Never throws. */
export function parseExtraction(raw: string, text: string): Patch {
  let j: Record<string, unknown>;
  try { j = JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  const out: Patch = {};
  const industry = typeof j.industry === "string" ? j.industry.trim().slice(0, 80) : "";
  if (industry && evidenceInText(j.industry_evidence, text)) out.industry = industry;
  const emp = typeof j.employees === "number" && Number.isFinite(j.employees) ? Math.round(j.employees) : null;
  if (emp && emp > 0 && emp < 5_000_000 && evidenceInText(j.employees_evidence, text) && numberInEvidence(emp, j.employees_evidence as string)) out.size = `Empleados: ${emp}`;
  const country = normalizeCountry(j.country);
  if (country && evidenceInText(j.country_evidence, text)) out.country = country;
  return out;
}

// ---- Plan: run the sources in priority order ----
export type SourceResult = { patch: Patch; usage?: Record<string, number> };
export type SourceRunner = { id: EnrichSource; run: (ctx: { name: string; domain: string | null; fields: EnrichField[] }) => Promise<SourceResult> };
export type PlanOutcome = { patch: Patch; marks: Partial<Record<EnrichField, EnrichSource>>; usage: Record<string, number>; errors: string[]; sources: EnrichSource[] };

/** Asks the sources from the highest priority down for what is still missing; a failing source never throws. */
export async function planEnrichment(account: AccountData & { name: string; domain: string | null }, sources: SourceRunner[]): Promise<PlanOutcome> {
  const patch: Patch = {};
  const marks: PlanOutcome["marks"] = {};
  const usage: Record<string, number> = {};
  const errors: string[] = [];
  const used: EnrichSource[] = [];
  const ordered = [...sources].sort((a, b) => SOURCE_PRIORITY[b.id] - SOURCE_PRIORITY[a.id]);
  for (const s of ordered) {
    const want = missingFields(account, s.id).filter((f) => !patch[f]);
    if (!want.length) continue;
    try {
      const r = await s.run({ name: account.name, domain: account.domain, fields: want });
      let gave = false;
      for (const f of want) {
        const v = r.patch[f];
        if (v && v.trim()) { patch[f] = v.trim(); marks[f] = s.id; gave = true; }
      }
      for (const [k, n] of Object.entries(r.usage ?? {})) usage[`${s.id}.${k}`] = (usage[`${s.id}.${k}`] ?? 0) + n;
      if (gave) used.push(s.id);
    } catch (e) {
      errors.push(`${s.id}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
    }
  }
  return { patch, marks, usage, errors, sources: used };
}
