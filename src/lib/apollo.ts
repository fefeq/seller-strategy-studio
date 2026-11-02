// Apollo.io (people search, email/phone reveal, company search and enrichment): pure rules shared by
// the screens, the agent tools and MCP. Gateway calls live in src/lib/apollo-gateway.ts.
import { cleanDomain } from "@/lib/leads";
import { requireKey } from "@/lib/fit-key";
import { normalizeForSave } from "@/lib/field-normalize";
import { englishCountry, isoFromCountry, type AccountDraft, type EnrichField } from "@/lib/clay";

export const APOLLO_SENIORITY = [
  "owner",
  "founder",
  "c_suite",
  "partner",
  "vp",
  "head",
  "director",
  "manager",
  "senior",
  "entry",
] as const;
export const APOLLO_SENIORITY_LABEL: Record<string, string> = {
  owner: "Propietario",
  founder: "Fundador",
  c_suite: "C-Level",
  partner: "Socio",
  vp: "VP",
  head: "Head",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  entry: "Junior",
};
/** People search is free; company search spends credits per page, so pages stay small. */
export const PEOPLE_PAGE = 25;
export const COMPANY_PAGE = 10;
/** Apollo enriches at most 10 people per call. */
export const MAX_REVEAL = 10;

export type ApolloPeopleQuery = { titles?: string[]; seniorities?: string[] };
export type ApolloCompanyQuery = {
  keywords?: string[];
  countries?: string[];
  minEmployees?: number | null;
  maxEmployees?: number | null;
};

const uniq = (xs?: string[]) => [
  ...new Set((xs ?? []).map((s) => String(s).trim()).filter(Boolean)),
];
type Params = [string, string][];

export function peopleParams(
  domain: string | null | undefined,
  q: ApolloPeopleQuery,
  page: number,
): Params {
  const d = cleanDomain(domain);
  if (!d)
    throw new Error(
      "La cuenta no tiene dominio. Añádelo (empresa.com) para buscar a sus personas en Apollo.",
    );
  const p: Params = [["q_organization_domains_list[]", d]];
  for (const t of uniq(q.titles)) p.push(["person_titles[]", t]);
  for (const s of uniq(q.seniorities).filter((x) =>
    (APOLLO_SENIORITY as readonly string[]).includes(x),
  ))
    p.push(["person_seniorities[]", s]);
  p.push(["page", String(Math.max(1, Math.floor(page)))], ["per_page", String(PEOPLE_PAGE)]);
  return p;
}

export function companyParams(q: ApolloCompanyQuery, page: number): Params {
  const p: Params = [];
  for (const k of uniq(q.keywords)) p.push(["q_organization_keyword_tags[]", k]);
  for (const c of uniq(q.countries)) p.push(["organization_locations[]", englishCountry(c) ?? c]);
  const min = q.minEmployees && q.minEmployees > 0 ? Math.floor(q.minEmployees) : null;
  const max = q.maxEmployees && q.maxEmployees > 0 ? Math.floor(q.maxEmployees) : null;
  if (min != null && max != null && min > max)
    throw new Error("El mínimo de empleados es mayor que el máximo. Corrígelo y vuelve a buscar.");
  if (min != null || max != null)
    p.push(["organization_num_employees_ranges[]", `${min ?? 1},${max ?? 1000000}`]);
  if (!p.length) throw new Error("Indica al menos un criterio: palabras clave, país o tamaño.");
  p.push(["page", String(Math.max(1, Math.floor(page)))], ["per_page", String(COMPANY_PAGE)]);
  return p;
}

export type ApolloOrg = {
  id?: string | null;
  name?: string | null;
  primary_domain?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  estimated_num_employees?: number | null;
  country?: string | null;
  city?: string | null;
  short_description?: string | null;
  annual_revenue_printed?: string | null;
};

const sentence = (s: string | null | undefined) =>
  s?.trim() ? s.trim().charAt(0).toUpperCase() + s.trim().slice(1) : null;

export function orgToAccount(o: ApolloOrg): AccountDraft {
  const domain = cleanDomain(o.primary_domain ?? o.website_url);
  return {
    name: o.name?.trim() || domain || "Empresa sin nombre",
    domain,
    industry: sentence(o.industry),
    size: o.estimated_num_employees ? `${o.estimated_num_employees} empleados` : null,
    country: isoFromCountry(o.country),
    linkedin: o.linkedin_url?.trim() || null,
    description: o.short_description?.trim() ? o.short_description.trim().slice(0, 1500) : null,
    location: [o.city, o.country].filter(Boolean).join(", ") || null,
    revenue: o.annual_revenue_printed?.trim() || null,
  };
}

/**
 * Size and country of a provider draft in their canonical form (SDD field-write-paths-normalization, CA-1).
 * What does not fit is dropped (empty), not kept: a provider's size that is not a headcount is not saved.
 * Only for proposed or inserted values, never for the value an account already has (see canonicalCurrent).
 */
export function normalizeDraft(d: AccountDraft): AccountDraft {
  const size = normalizeForSave("accounts", "size", d.size);
  const country = normalizeForSave("accounts", "country", d.country);
  return {
    ...d,
    size: size.status === "ok" ? (size.value as string) : null,
    country: country.status === "ok" ? (country.value as string) : null,
  };
}

/**
 * A change an automatic or web source proposes, with size and country in canonical form; null when the value
 * does not fit (a country that is not recognised, a size that is not a headcount), so it is neither written
 * nor offered (SDD field-write-paths-normalization, CA-3, CA-4). Other fields pass through.
 */
export function normalizeProposed<T extends { field: EnrichField; proposed: string }>(
  change: T,
): T | null {
  if (change.field !== "size" && change.field !== "country") return change;
  const n = normalizeForSave("accounts", change.field, change.proposed);
  return n.status === "ok" ? { ...change, proposed: n.value as string } : null;
}

/**
 * The value an account already has, size and country in canonical form, so a value that only differs in
 * format is not proposed again (SDD field-write-paths-normalization, CA-6). What does not fit, and what is
 * empty, stays as it is: a filled field must never look empty, or an automatic run would overwrite it.
 */
export function canonicalCurrent<T extends { size: string | null; country: string | null }>(
  account: T,
): T {
  const canon = (field: "size" | "country", v: string | null) => {
    const n = normalizeForSave("accounts", field, v);
    return n.status === "ok" ? (n.value as string) : v;
  };
  return {
    ...account,
    size: canon("size", account.size),
    country: canon("country", account.country),
  };
}

/** The accounts row for a provider company (Apollo, Clay): size and country go through the single rule, empty when they do not fit. */
export function accountInsertFromDraft(d: AccountDraft, isTarget: boolean) {
  const n = normalizeDraft(d);
  return {
    name: n.name,
    domain: n.domain,
    industry: n.industry,
    size: n.size,
    country: n.country,
    notes: n.description,
    is_target: isTarget,
  };
}

/** A people-search row: Apollo masks the surname and contact data until the person is revealed. */
export type ApolloSearchPerson = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  last_name_obfuscated?: string | null;
  name?: string | null;
  title?: string | null;
  has_email?: boolean | null;
  has_direct_phone?: string | boolean | null;
  organization?: { name?: string | null } | null;
};
export type PersonPreview = {
  apolloId: string;
  name: string;
  title: string | null;
  company: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
};

export function searchPersonPreview(p: ApolloSearchPerson): PersonPreview | null {
  if (!p.id) return null;
  const name = (
    p.name ?? [p.first_name, p.last_name ?? p.last_name_obfuscated].filter(Boolean).join(" ")
  ).trim();
  return {
    apolloId: p.id,
    name: name || "Sin nombre",
    title: p.title?.trim() || null,
    company: p.organization?.name ?? null,
    hasEmail: !!p.has_email,
    hasPhone: p.has_direct_phone === true || p.has_direct_phone === "Yes",
  };
}

/** An enriched person (people/bulk_match). */
export type ApolloMatch = {
  id?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  country?: string | null;
};
export type RevealedContact = {
  apolloId: string;
  name: string;
  title: string | null;
  email: string | null;
  emailStatus: string | null;
  linkedin_url: string | null;
  location: string | null;
};

export function matchToContact(m: ApolloMatch | null | undefined): RevealedContact | null {
  if (!m?.id) return null;
  const email = m.email?.trim().toLowerCase() || null;
  return {
    apolloId: m.id,
    name: (m.name ?? [m.first_name, m.last_name].filter(Boolean).join(" ")).trim() || "Sin nombre",
    title: m.title?.trim() || null,
    // Apollo returns a placeholder address when the email is locked behind a plan.
    email: email && !email.includes("email_not_unlocked") ? email : null,
    emailStatus: m.email_status ?? null,
    linkedin_url: m.linkedin_url?.trim() || null,
    location: [m.city, m.country].filter(Boolean).join(", ") || null,
  };
}

/** The identifiers Apollo matches a known person on (more identifiers, better match). */
export function matchDetails(p: {
  apolloId?: string | null;
  name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  domain?: string | null;
}) {
  const d: Record<string, string> = {};
  if (p.apolloId) d.id = p.apolloId;
  const name = (p.name ?? "").trim();
  if (name) {
    const [first, ...rest] = name.split(/\s+/);
    d.first_name = first!;
    if (rest.length) d.last_name = rest.join(" ");
    d.name = name;
  }
  if (p.email?.trim()) d.email = p.email.trim();
  if (p.linkedin_url?.trim()) d.linkedin_url = p.linkedin_url.trim();
  const dom = cleanDomain(p.domain);
  if (dom) d.domain = dom;
  requireKey("persona", {
    id: d.id,
    name: d.name,
    email: d.email,
    linkedin_url: d.linkedin_url,
    domain: d.domain,
  });
  return d;
}

export type ApolloPhone = { number: string; type: string | null };

/** Phones in a webhook delivery, by Apollo person id. Mobile first, then direct, then the rest. */
export function phonesFromWebhook(payload: unknown): { id: string; phones: ApolloPhone[] }[] {
  const people = (payload as { people?: unknown })?.people;
  if (!Array.isArray(people)) return [];
  const rank = (t: string | null) => (t === "mobile" ? 0 : t === "work_direct" ? 1 : 2);
  const out: { id: string; phones: ApolloPhone[] }[] = [];
  for (const p of people as { id?: unknown; phone_numbers?: unknown }[]) {
    if (typeof p?.id !== "string" || !p.id || p.id.length > 64) continue;
    const list = Array.isArray(p.phone_numbers)
      ? (p.phone_numbers as {
          raw_number?: unknown;
          sanitized_number?: unknown;
          type_cd?: unknown;
          status_cd?: unknown;
        }[])
      : [];
    const phones = list
      .filter((n) => n && n.status_cd !== "invalid_number")
      .map((n) => ({
        number: String(n.sanitized_number ?? n.raw_number ?? "")
          .trim()
          .slice(0, 40),
        type: typeof n.type_cd === "string" ? n.type_cd : null,
      }))
      .filter((n) => /^\+?[\d\s().-]{6,}$/.test(n.number))
      .sort((a, b) => rank(a.type) - rank(b.type));
    out.push({ id: p.id, phones });
  }
  return out;
}

export const PHONE_TYPE: Record<string, string> = {
  mobile: "Móvil",
  work_direct: "Directo",
  work_hq: "Centralita",
  home: "Personal",
  other: "Otro",
};

export const APOLLO_DEV_URL =
  "https://project--284b5305-78bc-41f2-a9bb-09c2b2fd1faf-dev.lovable.app";
export const APOLLO_PUBLISHED_URL =
  "https://project--284b5305-78bc-41f2-a9bb-09c2b2fd1faf.lovable.app";
export const APOLLO_WEBHOOK_PATH = "/api/public/apollo/phone-webhook";

/** Where Apollo delivers phones: the stable preview host while working in the editor, the published host otherwise. */
export function apolloWebhookBase(host: string | null | undefined, projectId: string): string {
  if (!host) return APOLLO_PUBLISHED_URL;
  const internal =
    host.startsWith("localhost") || !host.includes(".") || /^\d+(\.\d+){3}(:\d+)?$/.test(host);
  const devServed =
    internal ||
    (projectId !== "" && host.includes(projectId) && host !== new URL(APOLLO_PUBLISHED_URL).host);
  return `${devServed ? APOLLO_DEV_URL : APOLLO_PUBLISHED_URL}${APOLLO_WEBHOOK_PATH}`;
}

/** Spanish «what happened + what to do» for an Apollo or gateway error. */
export function apolloErrorText(status: number, body: string): string {
  if (/API_INACCESSIBLE|not included in your .*plan|ENDPOINT_ACCESS_DENIED/i.test(body))
    return "Tu plan de Apollo no incluye esta función. Pasa a un plan de pago en Apollo para usarla; completar empresas sí funciona con el plan gratuito.";
  if (/endpoint_not_allowed/i.test(body))
    return "La conexión de Apollo gestionada por Lovable no permite esta acción. Conecta tu propia clave de Apollo en Conexiones.";
  if (status === 401)
    return "Apollo ha rechazado la conexión de Nokko. Pide al Owner que la revise en Conexiones.";
  if (status === 403)
    return "Tu clave de Apollo no tiene acceso a esta función. Actívala en Apollo (Integraciones → API) o usa una clave maestra.";
  if (status === 429)
    return "Apollo está frenando las peticiones ahora mismo. Espera un minuto y vuelve a probar.";
  if (status >= 500) return "Apollo no responde ahora mismo. Vuelve a probar en unos minutos.";
  let msg = body;
  try {
    const j = JSON.parse(body);
    msg = String(j.error_details?.message ?? j.error ?? j.message ?? body);
  } catch {
    /* plain text */
  }
  return `Apollo no ha aceptado la petición: ${msg.slice(0, 300)}. Revisa los datos y vuelve a probar.`;
}

/** Constant-time comparison for the webhook secret. */
export function sameSecret(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
