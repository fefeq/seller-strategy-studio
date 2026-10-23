// Clay (prospecting, stakeholder search, account enrichment): pure rules shared by the screens,
// the agent tools and MCP. The gateway calls live in src/lib/clay-gateway.ts.
import { COUNTRY_CODES } from "@/lib/assignment";
import { cleanDomain } from "@/lib/leads";
import { normLinkedin } from "@/lib/dedupe";

export const CLAY_REVENUES = ["0-500K", "500K-1M", "1M-5M", "5M-10M", "10M-25M", "25M-75M", "75M-200M", "200M-500M", "500M-1B", "1B-10B", "10B-100B", "100B-1T"] as const;
export const CLAY_SENIORITY = ["founder", "owner", "board-member", "partner", "c-suite", "vp", "director", "head", "manager", "senior", "mid-level", "entry"] as const;
export const SENIORITY_LABEL: Record<string, string> = {
  founder: "Fundador", owner: "Propietario", "board-member": "Consejo", partner: "Socio", "c-suite": "C-Level", vp: "VP",
  director: "Director", head: "Head", manager: "Manager", senior: "Senior", "mid-level": "Intermedio", entry: "Junior",
};
/** Most results one request pulls; every result counts against the Clay workspace's period allowance. */
export const MAX_PAGE = 25;

export type CompanyQuery = { keywords?: string[]; industries?: string[]; countries?: string[]; minEmployees?: number | null; maxEmployees?: number | null; revenues?: string[] };
export type PeopleQuery = { titles?: string[]; seniority?: string[]; countries?: string[] };

export type ClayCompany = {
  name?: string | null; description?: string | null; type?: string | null; size?: string | null; country?: string | null; domain?: string | null;
  linkedin_url?: string | null; location?: string | null; industry?: string | null; annual_revenue?: string | null; total_funding_amount_range_usd?: string | null;
};
export type ClayPerson = {
  name?: string | null; first_name?: string | null; last_name?: string | null; url?: string | null; domain?: string | null;
  structured_location?: { city?: string | null; country?: string | null; country_iso?: string | null } | null;
  latest_experience_title?: string | null; latest_experience_company?: string | null; matched_experience?: { job_title?: string | null } | null;
};
export type ClayQuota = { limit: number; used: number; remaining: number; resets_at: string } | null;

/** A company as Nokko would save it as an account. */
export type AccountDraft = { name: string; domain: string | null; industry: string | null; size: string | null; country: string | null; linkedin: string | null; description: string | null; location: string | null; revenue: string | null };
/** A person as Nokko would save them as a stakeholder. */
export type StakeholderDraft = { name: string; title: string | null; linkedin_url: string | null; location: string | null };

const uniq = (xs?: string[]) => [...new Set((xs ?? []).map((s) => String(s).trim()).filter(Boolean))];

/** English country name Clay filters on, from an ISO code. */
export function englishCountry(iso: string): string | null {
  const c = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(c) ?? null; } catch { return null; }
}

/** ISO code for a country name in English or Spanish (or an ISO code), limited to the countries Nokko knows. */
export function isoFromCountry(name: string | null | undefined): string | null {
  const v = (name ?? "").trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v) && COUNTRY_CODES.includes(v.toUpperCase())) return v.toUpperCase();
  const k = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const code of COUNTRY_CODES) {
    for (const lang of ["en", "es"]) {
      let n: string | undefined;
      try { n = new Intl.DisplayNames([lang], { type: "region" }).of(code); } catch { n = undefined; }
      if (n && n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === k) return code;
    }
  }
  return null;
}

export function companyFilters(q: CompanyQuery): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  const kw = uniq(q.keywords);
  if (kw.length) f.description_keywords = kw;
  const ind = uniq(q.industries);
  if (ind.length) f.industries = ind;
  const countries = uniq(q.countries).map((c) => englishCountry(c) ?? c);
  if (countries.length) f.country_names = countries;
  const min = q.minEmployees != null && q.minEmployees > 0 ? Math.floor(q.minEmployees) : null;
  const max = q.maxEmployees != null && q.maxEmployees > 0 ? Math.floor(q.maxEmployees) : null;
  if (min != null && max != null && min > max) throw new Error("El mínimo de empleados es mayor que el máximo. Corrígelo y vuelve a buscar.");
  if (min != null) f.minimum_member_count = min;
  if (max != null) f.maximum_member_count = max;
  const rev = uniq(q.revenues).filter((r) => (CLAY_REVENUES as readonly string[]).includes(r));
  if (rev.length) f.annual_revenues = rev;
  if (!Object.keys(f).length) throw new Error("Indica al menos un criterio: palabras clave, sector, país, tamaño o ingresos.");
  return f;
}

export function peopleFilters(domain: string | null | undefined, q: PeopleQuery): Record<string, unknown> {
  const d = cleanDomain(domain);
  if (!d) throw new Error("La cuenta no tiene dominio. Añádelo (empresa.com) para buscar a sus personas en Clay.");
  const f: Record<string, unknown> = { company_identifier: [d] };
  const titles = uniq(q.titles);
  if (titles.length) f.job_title_keywords = titles;
  const sen = uniq(q.seniority).filter((s) => (CLAY_SENIORITY as readonly string[]).includes(s));
  if (sen.length) f.job_title_seniority_levels_v2 = sen;
  const countries = uniq(q.countries).map((c) => englishCountry(c) ?? c);
  if (countries.length) f.location_countries_include = countries;
  return f;
}

/** «51-200 employees» → «51-200 empleados» (no thousands commas, so the ICP size rule can read the numbers). */
export function employeesText(size: string | null | undefined): string | null {
  const s = (size ?? "").replace(/employees?/i, "").replace(/,/g, "").trim();
  return s ? `${s} empleados` : null;
}

export function companyToAccount(c: ClayCompany): AccountDraft {
  const domain = cleanDomain(c.domain);
  return {
    name: (c.name ?? "").trim() || domain || "Empresa sin nombre",
    domain,
    industry: c.industry?.trim() || null,
    size: employeesText(c.size),
    country: isoFromCountry(c.country),
    linkedin: c.linkedin_url?.trim() || null,
    description: c.description?.trim() ? c.description.trim().slice(0, 1500) : null,
    location: c.location?.trim() || null,
    revenue: c.annual_revenue?.trim() || null,
  };
}

export function personToStakeholder(p: ClayPerson): StakeholderDraft {
  const name = (p.name ?? [p.first_name, p.last_name].filter(Boolean).join(" ")).trim();
  const loc = p.structured_location;
  return {
    name: name || "Sin nombre",
    title: (p.matched_experience?.job_title ?? p.latest_experience_title)?.trim() || null,
    linkedin_url: p.url?.trim() || null,
    location: [...new Set([loc?.city, loc?.country].filter((x): x is string => !!x?.trim()))].join(", ") || null,
  };
}

/** Id of the account that already has this domain (so results show «Ya está en Nokko» and are never imported twice). */
export function existingByDomain(accounts: { id: string; domain: string | null }[]) {
  const m = new Map<string, string>();
  for (const a of accounts) { const d = cleanDomain(a.domain); if (d && !m.has(d)) m.set(d, a.id); }
  return (domain: string | null) => (domain ? m.get(domain) ?? null : null);
}

/** Id of the stakeholder already on the account: same LinkedIn, or same name when either has no LinkedIn. */
export function existingStakeholder(list: { id: string; name: string | null; linkedin_url: string | null }[]) {
  return (p: StakeholderDraft) => {
    const li = normLinkedin(p.linkedin_url);
    const hit = list.find((s) => {
      const sl = normLinkedin(s.linkedin_url);
      if (li && sl) return li === sl;
      return (s.name ?? "").trim().toLowerCase() === p.name.trim().toLowerCase();
    });
    return hit?.id ?? null;
  };
}

export type EnrichField = "industry" | "size" | "country" | "notes";
export const ENRICH_LABEL: Record<EnrichField, string> = { industry: "Sector", size: "Tamaño", country: "País", notes: "Descripción" };
export type EnrichChange = { field: EnrichField; current: string | null; proposed: string; empty: boolean };

/** What Clay would change on the account. Empty fields come pre-selected; filled ones are only offered. */
export function enrichChanges(account: { industry: string | null; size: string | null; country: string | null; notes: string | null }, d: AccountDraft): EnrichChange[] {
  const out: EnrichChange[] = [];
  const add = (field: EnrichField, current: string | null, proposed: string | null) => {
    if (!proposed) return;
    const cur = current?.trim() || null;
    if (cur && cur.toLowerCase() === proposed.trim().toLowerCase()) return;
    out.push({ field, current: cur, proposed, empty: !cur });
  };
  add("industry", account.industry, d.industry);
  add("size", account.size, d.size);
  add("country", account.country, d.country);
  add("notes", account.notes, d.description);
  return out;
}

/** The account patch for the changes the user ticked. */
export function enrichPatch(changes: EnrichChange[], picked: EnrichField[]): Partial<Record<EnrichField, string>> {
  return Object.fromEntries(changes.filter((c) => picked.includes(c.field)).map((c) => [c.field, c.proposed]));
}

const numbers = (s: string) => (s.replace(/(\d)[.,](?=\d{3}\b)/g, "$1").match(/\d+/g) ?? []).map(Number);

/** A first Clay query from an ICP: sectors as description keywords, geography as countries, size as employee range. */
export function icpToQuery(icp: { industries: string | null; company_size: string | null; geography: string | null }): CompanyQuery {
  const keywords = uniq((icp.industries ?? "").split(/[,;/\n]|\s+y\s+|\s+o\s+/i)).slice(0, 8);
  const countries = uniq((icp.geography ?? "").split(/[,;/\n]|\s+y\s+|\s+o\s+/i).map((g) => isoFromCountry(g) ?? "").filter(Boolean));
  const size = (icp.company_size ?? "").toLowerCase();
  const n = numbers(size);
  let minEmployees: number | null = null, maxEmployees: number | null = null;
  if (n.length >= 2) { minEmployees = Math.min(...n); maxEmployees = Math.max(...n); }
  else if (n.length === 1) {
    if (/menos de|hasta|</.test(size)) maxEmployees = n[0]!;
    else minEmployees = n[0]!;
  }
  return { keywords, countries, minEmployees, maxEmployees, industries: [], revenues: [] };
}

/** Spanish «what happened + what to do» for a Clay error status. */
export function clayErrorText(status: number, message: string): string {
  if (status === 401 || status === 403) return "Clay ha rechazado la conexión de Nokko. Pide al Owner que la revise en Conexiones.";
  if (status === 404) return "Esa búsqueda de Clay ya no existe. Lanza una búsqueda nueva.";
  if (status === 429) return "Clay está frenando las búsquedas ahora mismo. Espera un minuto y vuelve a probar.";
  if (status >= 500) return "Clay no responde ahora mismo. Vuelve a probar en unos minutos.";
  return `Clay no ha aceptado la búsqueda: ${message.slice(0, 300)}. Revisa los criterios y vuelve a probar.`;
}

/** «Te quedan 96 de 100 resultados de Clay hoy» (null when Clay sent no allowance). */
export function quotaText(q: ClayQuota): string | null {
  if (!q || !Number.isFinite(q.limit)) return null;
  return `Te quedan ${q.remaining} de ${q.limit} resultados de Clay en este periodo.`;
}
