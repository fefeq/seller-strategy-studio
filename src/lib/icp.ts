// The ICP as the one definition of a target account every flow reads: company searches (Apollo, Clay,
// Parallel, Descubiertos), key-people searches, scoring, lead qualification and AI context.
// Structured fields (employees, ISO countries, English keywords, titles, levels) win; the prose
// fields are the fallback, so old ICPs keep working. Pure and tested.
import { icpToQuery, type CompanyQuery } from "@/lib/clay";
import { LEVELS, type Level } from "@/lib/orchestrator/search";

export type Icp = {
  id?: string;
  name?: string | null;
  segment_id?: string | null;
  industries?: string | null;
  company_size?: string | null;
  geography?: string | null;
  tech_stack?: string | null;
  growth_stage?: string | null;
  hiring_signals?: string | null;
  funding_signals?: string | null;
  adoption?: string | null;
  why_fit?: string | null;
  anti_icp?: string | null;
  pains?: string | null;
  min_employees?: number | null;
  max_employees?: number | null;
  countries?: string[] | null;
  search_keywords?: string[] | null;
  target_titles?: string[] | null;
  seniorities?: string[] | null;
};

export const LEVEL_LABEL: Record<Level, string> = { founder: "Fundador", c_suite: "C-Level", vp: "VP", head: "Head", director: "Director", manager: "Manager" };

const clean = (xs: string[] | null | undefined) => [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))];
const sane = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null);

/** «Lista, separada; por comas» → ["Lista", "separada", "por comas"] for the tag inputs. */
export function splitList(text: string): string[] {
  return clean(text.split(/[,;\n]/));
}

/** "51–200 empleados", "más de 500 empleados", or null. */
export function employeesText(min: number | null | undefined, max: number | null | undefined): string | null {
  const lo = sane(min), hi = sane(max);
  if (lo && hi) return `${Math.min(lo, hi)}–${Math.max(lo, hi)} empleados`;
  if (lo) return `más de ${lo} empleados`;
  if (hi) return `hasta ${hi} empleados`;
  return null;
}

/** Size as text: the structured range when set, else what was written. */
export function icpSizeText(icp: Icp): string | null {
  return employeesText(icp.min_employees, icp.max_employees) ?? (icp.company_size?.trim() || null);
}

/** Company-database query (Apollo, Clay): structured fields first, each part falling back to the prose. */
export function icpCompanyQuery(icp: Icp): { query: CompanyQuery; structured: boolean } {
  const plain = icpToQuery({ industries: icp.industries ?? null, company_size: icp.company_size ?? null, geography: icp.geography ?? null });
  const keywords = clean(icp.search_keywords).slice(0, 8);
  const countries = clean(icp.countries).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
  let lo = sane(icp.min_employees), hi = sane(icp.max_employees);
  if (lo && hi && lo > hi) [lo, hi] = [hi, lo];
  const hasRange = lo != null || hi != null;
  return {
    structured: keywords.length > 0,
    query: {
      keywords: keywords.length ? keywords : plain.keywords,
      countries: countries.length ? countries : plain.countries,
      minEmployees: hasRange ? lo : plain.minEmployees ?? null,
      maxEmployees: hasRange ? hi : plain.maxEmployees ?? null,
      industries: [],
      revenues: [],
    },
  };
}

/** Which ICP applies to an account: its segment's, else the first. */
export function icpForSegment<T extends Icp>(icps: T[], segmentId: string | null | undefined): T | null {
  if (!icps.length) return null;
  return (segmentId ? icps.find((i) => i.segment_id === segmentId) : undefined) ?? icps[0]!;
}

/** Titles and levels for «Buscar personas clave»; null pieces mean «use the defaults». */
export function icpPeopleQuery(icp: Icp | null): { titles: string[] | undefined; levels: Level[] | undefined } {
  if (!icp) return { titles: undefined, levels: undefined };
  const titles = clean(icp.target_titles).slice(0, 10);
  const levels = clean(icp.seniorities).filter((l): l is Level => (LEVELS as readonly string[]).includes(l));
  return { titles: titles.length ? titles : undefined, levels: levels.length ? levels : undefined };
}

/** The ICP in plain Spanish lines for AI prompts (research, Parallel lists, fit judging, meeting prep). */
export function icpBrief(icp: Icp): string {
  const lines: string[] = [];
  const add = (label: string, v: string | null | undefined) => { if (v && v.trim()) lines.push(`${label}: ${v.trim()}`); };
  add("Perfil", icp.name);
  add("Sectores o tipo de empresa", icp.industries);
  add("Palabras clave de búsqueda", clean(icp.search_keywords).join(", "));
  add("Tamaño", icpSizeText(icp));
  add("Geografía", [icp.geography, clean(icp.countries).join(", ")].filter((x) => x && x.trim()).join(" · "));
  add("Stack tecnológico", icp.tech_stack);
  add("Etapa de crecimiento", icp.growth_stage);
  add("Señales de compra", [icp.hiring_signals, icp.funding_signals, icp.adoption].filter((x) => x && x.trim()).join(" · "));
  add("Dolores que resolvemos", icp.pains);
  add("Cargos a contactar", clean(icp.target_titles).join(", "));
  add("Niveles", clean(icp.seniorities).map((l) => LEVEL_LABEL[l as Level] ?? l).join(", "));
  add("Por qué encajan", icp.why_fit);
  add("No encaja (anti-ICP)", icp.anti_icp);
  return lines.join("\n");
}

export type IcpCheck = { id: string; label: string; ready: boolean; missing: string | null };

/** What each flow can do with this ICP and what it is missing. */
export function icpReadiness(icp: Icp): IcpCheck[] {
  // Only the structured fields count: the prose fallback is a guess (it can read «2.000 EUR» as employees).
  const q = { keywords: clean(icp.search_keywords), countries: clean(icp.countries) };
  const hasSize = sane(icp.min_employees) != null || sane(icp.max_employees) != null;
  const people = icpPeopleQuery(icp);
  return [
    { id: "search", label: "Búsqueda de empresas (Apollo, Clay, Descubiertos)", ready: !!q.keywords?.length && hasSize && !!q.countries?.length,
      missing: [!q.keywords?.length && "palabras clave", !hasSize && "rango de empleados", !q.countries?.length && "países"].filter(Boolean).join(", ") || null },
    { id: "people", label: "Personas clave", ready: !!people.titles, missing: people.titles ? null : "cargos a contactar (usa niveles por defecto)" },
    { id: "score", label: "Puntuación de cuentas y leads", ready: !!icp.industries?.trim() && !!icpSizeText(icp) && !!icp.anti_icp?.trim(),
      missing: [!icp.industries?.trim() && "sectores", !icpSizeText(icp) && "tamaño", !icp.anti_icp?.trim() && "anti-ICP"].filter(Boolean).join(", ") || null },
    { id: "ai", label: "Cualificación, investigación y preparación con IA", ready: !!icp.why_fit?.trim() && !!icp.pains?.trim(),
      missing: [!icp.why_fit?.trim() && "por qué encajan", !icp.pains?.trim() && "dolores"].filter(Boolean).join(", ") || null },
  ];
}

/** JSON schema for «Afinar con IA»: prose ICP → structured search fields. */
export const ICP_STRUCTURE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["search_keywords", "countries", "min_employees", "max_employees", "target_titles", "seniorities", "pains"],
  properties: {
    search_keywords: { type: "array", items: { type: "string" } },
    countries: { type: "array", items: { type: "string" } },
    min_employees: { type: ["integer", "null"] },
    max_employees: { type: ["integer", "null"] },
    target_titles: { type: "array", items: { type: "string" } },
    seniorities: { type: "array", items: { type: "string", enum: [...LEVELS] } },
    pains: { type: ["string", "null"] },
  },
} as const;

/** Parses the AI answer, keeping only sane values. */
export function parseIcpStructure(raw: string): Partial<Icp> {
  let o: any;
  try { o = JSON.parse(raw); } catch { return {}; }
  if (!o || typeof o !== "object") return {};
  const arr = (v: unknown) => (Array.isArray(v) ? clean(v.filter((x): x is string => typeof x === "string")) : []);
  const out: Partial<Icp> = {
    search_keywords: arr(o.search_keywords).slice(0, 8),
    countries: arr(o.countries).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)),
    target_titles: arr(o.target_titles).slice(0, 10),
    seniorities: arr(o.seniorities).filter((l) => (LEVELS as readonly string[]).includes(l)),
    min_employees: sane(o.min_employees),
    max_employees: sane(o.max_employees),
  };
  if (typeof o.pains === "string" && o.pains.trim()) out.pains = o.pains.trim();
  return out;
}
