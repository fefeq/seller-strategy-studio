// Parallel rules that need no network (tested in parallel.test.ts): the deep account report schema and how
// its cited fields are read, the ICP list run (processor by size, entities → accounts), the enrichment
// table in chunks of 5, and search results as news items.
import { cleanDomain } from "@/lib/leads";

// ---------------- Deep account report (Task run) ----------------

export const REPORT_FIELDS = [
  ["summary", "Resumen", "3-5 frases: qué hace la empresa, para quién y en qué momento está"],
  ["business_model", "Modelo de negocio", "Cómo gana dinero: productos, clientes, precios, mercados"],
  ["financials", "Finanzas y tamaño", "Ingresos, financiación (rondas, inversores, fechas), empleados y crecimiento, con cifras y fechas"],
  ["leadership", "Dirección", "Personas clave (CEO, CFO, ventas, operaciones, tecnología) con su cargo y desde cuándo"],
  ["priorities", "Prioridades estratégicas", "Lo que la empresa dice que quiere conseguir este año: expansión, eficiencia, nuevos productos"],
  ["technology", "Tecnología y herramientas", "Software y proveedores que usa (CRM, nube, analítica…) y proyectos tecnológicos en curso"],
  ["buying", "Cómo compran", "Quién decide y quién influye en compras como la nuestra, procesos, licitaciones o socios"],
  ["competitors", "Competencia y proveedores actuales", "Sus competidores y los proveedores que sustituiríamos o complementaríamos"],
  ["risks", "Riesgos", "Señales negativas: despidos, pérdidas, litigios, cambios de dirección, recortes"],
  ["opportunities", "Oportunidades para nosotros", "Dónde encaja nuestra propuesta según nuestro posicionamiento y por qué ahora"],
] as const;
export type ReportField = (typeof REPORT_FIELDS)[number][0];

export const reportSchema = () => ({
  type: "object",
  properties: Object.fromEntries(REPORT_FIELDS.map(([k, , d]) => [k, { type: "string", description: `${d}. En español neutro. Si no hay información fiable, escribe «Sin datos».` }])),
  required: REPORT_FIELDS.map(([k]) => k),
  additionalProperties: false,
});

/** The research brief sent to Parallel: who the account is and who we are (so «Oportunidades» is ours). */
export function reportInput(account: { name: string; domain: string | null; country?: string | null }, us: { company: string; one_liner?: string | null; category?: string | null; target_customer?: string | null }): string {
  const d = cleanDomain(account.domain);
  return [
    `Investiga a fondo la empresa ${account.name}${d ? ` (${d})` : ""}${account.country ? `, ${account.country}` : ""} para preparar una venta B2B.`,
    `Nosotros somos ${us.company}${us.one_liner ? `: ${us.one_liner}` : ""}${us.category ? ` (categoría: ${us.category})` : ""}${us.target_customer ? `. Vendemos a ${us.target_customer}` : ""}.`,
    "Usa fuentes públicas recientes (web oficial, notas de prensa, registros, prensa económica, LinkedIn de la empresa). Prioriza datos de los últimos 12 meses y da cifras con su fecha. No confundas la empresa con otras de nombre parecido.",
  ].join("\n");
}

export type Cited = { value: string; confidence: "low" | "medium" | "high" | null; sources: { url: string; title: string }[] };
export type Report = Record<ReportField, Cited>;

/** Task output → each field with its sources and confidence (from output.basis). */
export function readReport(output: unknown): Report | null {
  const o = (output ?? {}) as { content?: unknown; basis?: unknown[] };
  let content = o.content as Record<string, unknown> | string | undefined;
  if (typeof content === "string") { try { content = JSON.parse(content); } catch { return null; } }
  if (!content || typeof content !== "object") return null;
  const basis = new Map((Array.isArray(o.basis) ? o.basis : []).map((b) => {
    const x = b as { field?: string; confidence?: string; citations?: { url?: string; title?: string }[] };
    return [String(x.field ?? ""), x] as const;
  }));
  const out = {} as Report;
  for (const [k] of REPORT_FIELDS) {
    const b = basis.get(k);
    const conf = b?.confidence === "low" || b?.confidence === "medium" || b?.confidence === "high" ? b.confidence : null;
    const seen = new Set<string>();
    const sources = (b?.citations ?? []).filter((c) => typeof c.url === "string" && /^https?:\/\//.test(c.url) && !seen.has(c.url) && seen.add(c.url)).slice(0, 5).map((c) => ({ url: c.url!, title: (c.title || c.url!).slice(0, 160) }));
    out[k] = { value: String((content as Record<string, unknown>)[k] ?? "").trim() || "Sin datos", confidence: conf, sources };
  }
  return out;
}

/** The report as Markdown (Drive, hub, agent), with sources per section. */
export function reportMarkdown(accountName: string, r: Report, date = new Date()): string {
  const conf = { low: "confianza baja", medium: "confianza media", high: "confianza alta" } as const;
  const parts = [`# Informe de cuenta · ${accountName}`, `_Investigado con Parallel el ${date.toLocaleDateString("es-ES")}_`];
  for (const [k, label] of REPORT_FIELDS) {
    const f = r[k];
    parts.push(`## ${label}${f.confidence ? ` (${conf[f.confidence]})` : ""}`, f.value);
    if (f.sources.length) parts.push(`Fuentes: ${f.sources.map((s) => `[${s.title.replace(/[[\]]/g, "")}](${s.url})`).join(" · ")}`);
  }
  return parts.join("\n\n");
}

// ---------------- ICP account list (Task run) ----------------

export const listProcessor = (count: number) => (count <= 25 ? "ultra" : "ultra2x");
export const clampCount = (n: number) => Math.min(100, Math.max(5, Math.round(n || 25)));

export const LIST_SCHEMA = {
  type: "object",
  properties: { entities: { type: "array", items: { type: "object", properties: { name: { type: "string" }, url: { type: "string" } }, required: ["name", "url"], additionalProperties: false } } },
  required: ["entities"],
  additionalProperties: false,
};

/** The list brief from the ICP (industries, size, geography, anti-ICP) plus free criteria. */
export function listInput(icp: { industries?: string | null; company_size?: string | null; geography?: string | null; anti_icp?: string | null; why_fit?: string | null } | null, criteria: string, count: number): string {
  const lines = [`Encuentra ${clampCount(count)} empresas reales que encajen con este perfil de cliente ideal. Para cada una, su nombre y la URL de su web oficial (no LinkedIn ni directorios).`];
  if (icp?.industries) lines.push(`Sectores: ${icp.industries}.`);
  if (icp?.company_size) lines.push(`Tamaño: ${icp.company_size}.`);
  if (icp?.geography) lines.push(`Geografía: ${icp.geography}.`);
  if (icp?.why_fit) lines.push(`Por qué encajan: ${icp.why_fit}.`);
  if (icp?.anti_icp) lines.push(`Excluye: ${icp.anti_icp}.`);
  if (criteria.trim()) lines.push(`Criterios adicionales: ${criteria.trim()}`);
  lines.push("Solo empresas activas hoy. Sin duplicados.");
  return lines.join("\n");
}

export type ListEntity = { name: string; domain: string | null; url: string; existingId: string | null };

/** Entities → candidate accounts, one per domain, marking those already in Nokko. */
export function readEntities(output: unknown, existing: { id: string; domain: string | null; name: string }[]): ListEntity[] {
  const o = (output ?? {}) as { content?: unknown };
  let content = o.content as { entities?: unknown } | string | undefined;
  if (typeof content === "string") { try { content = JSON.parse(content); } catch { return []; } }
  const raw = Array.isArray((content as { entities?: unknown })?.entities) ? ((content as { entities: unknown[] }).entities) : [];
  const byDomain = new Map(existing.filter((a) => a.domain).map((a) => [cleanDomain(a.domain)!, a.id]));
  const byName = new Map(existing.map((a) => [a.name.trim().toLowerCase(), a.id]));
  const seen = new Set<string>();
  const out: ListEntity[] = [];
  for (const e of raw as { name?: unknown; url?: unknown }[]) {
    const name = String(e?.name ?? "").trim();
    const url = String(e?.url ?? "").trim();
    if (!name) continue;
    const domain = cleanDomain(url) || null;
    const key = domain ?? name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: name.slice(0, 200), domain, url: /^https?:\/\//.test(url) ? url : domain ? `https://${domain}` : "", existingId: (domain && byDomain.get(domain)) || byName.get(name.toLowerCase()) || null });
  }
  return out;
}

// ---------------- Enrichment table (Responses, 5 rows per call) ----------------

export const ENRICH_FIELDS = ["industry", "size", "country", "funding", "technology"] as const;
export type EnrichRow = { account_id: string; industry: string | null; size: string | null; country: string | null; funding: string | null; technology: string | null; source_url: string | null };

export const chunk = <T,>(list: T[], n = 5): T[][] => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

export const enrichSchema = {
  type: "object", required: ["rows"], additionalProperties: false,
  properties: { rows: { type: "array", items: {
    type: "object", additionalProperties: false, required: ["key", ...ENRICH_FIELDS, "source_url"],
    properties: {
      key: { type: "string" },
      industry: { type: ["string", "null"], description: "Sector en español, 1-3 palabras" },
      size: { type: ["string", "null"], description: "Empleados, p. ej. «200-500 empleados»" },
      country: { type: ["string", "null"], description: "País de la sede, en español" },
      funding: { type: ["string", "null"], description: "Última ronda o inversión con importe y fecha, o «Sin financiación conocida»" },
      technology: { type: ["string", "null"], description: "Herramientas principales que usa (CRM, nube, analítica)" },
      source_url: { type: ["string", "null"], description: "La fuente principal usada" },
    } } } },
};

export function enrichInput(rows: { key: string; name: string; domain: string | null }[]): string {
  return [
    "Para cada empresa, busca sector, tamaño en empleados, país de la sede, última financiación y herramientas que usa. Devuelve null en vez de adivinar. Responde en español. Cada línea empieza por su código (r1, r2…): pon ese código exacto en key.",
    ...rows.map((r) => `${r.key} | ${r.name}${r.domain ? ` | ${r.domain}` : ""}`),
  ].join("\n");
}

/** Lookup for model rows: the row code, and also the company name or domain (the model sometimes echoes those). */
export function enrichLookup(rows: { key: string; name: string; domain: string | null; id: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) { m.set(r.key, r.id); m.set(r.name.trim().toLowerCase(), r.id); const d = cleanDomain(r.domain); if (d) m.set(d, r.id); }
  return m;
}

/** Model rows back to accounts (by code, name or domain); unknown keys and empty strings dropped. */
export function readEnrichRows(json: unknown, lookup: Map<string, string>): EnrichRow[] {
  const keys = { get: (k: string) => lookup.get(k) ?? lookup.get(k.trim().toLowerCase()) ?? lookup.get(cleanDomain(k) ?? "") };
  const rows = ((json ?? {}) as { rows?: unknown[] }).rows ?? [];
  const clean = (v: unknown) => { const s = typeof v === "string" ? v.trim() : ""; return s && !/^(null|n\/a|desconocido|sin datos)$/i.test(s) ? s.slice(0, 300) : null; };
  const seen = new Set<string>();
  return (rows as Record<string, unknown>[]).flatMap((r) => {
    const id = keys.get(String(r.key ?? ""));
    if (id && seen.has(id)) return [];
    if (id) seen.add(id);
    if (!id) return [];
    const src = clean(r.source_url);
    return [{ account_id: id, industry: clean(r.industry), size: clean(r.size), country: clean(r.country), funding: clean(r.funding), technology: clean(r.technology), source_url: src && /^https?:\/\//.test(src) ? src : null }];
  });
}

/** What a row adds to an account without touching what the team typed: empty sector/size/country, and a note line. */
export function enrichPatch(account: { industry: string | null; size: string | null; country: string | null; notes: string | null }, r: EnrichRow): { industry?: string; size?: string; country?: string; notes?: string } {
  const patch: { industry?: string; size?: string; country?: string; notes?: string } = {};
  if (!account.industry?.trim() && r.industry) patch.industry = r.industry;
  if (!account.size?.trim() && r.size) patch.size = r.size;
  if (!account.country?.trim() && r.country) patch.country = r.country;
  const extra = [r.funding ? `Financiación: ${r.funding}` : "", r.technology ? `Tecnología: ${r.technology}` : "", r.source_url ? `Fuente: ${r.source_url}` : ""].filter(Boolean).join(" · ");
  if (extra && !(account.notes ?? "").includes(extra)) patch.notes = account.notes?.trim() ? `${account.notes.trim()}\n${extra}` : extra;
  return patch;
}

// ---------------- Search ----------------

/** Parallel search results in the shape newsItems() reads. */
export const searchAsNews = (results: unknown) => ((results ?? []) as { url?: string; title?: string; publish_date?: string | null; excerpts?: string[] }[])
  .map((r) => ({ url: String(r.url ?? "").replace(/[?&]utm_[^&#]*/g, "").replace(/\?(#|$)/, "$1"), title: r.title ?? "", snippet: (r.excerpts ?? [])[0] ?? "", date: r.publish_date ?? null }));

export function parallelErrorText(status: number, body = ""): string {
  if (status === 402) return "Se han agotado los créditos del espacio de trabajo para investigar con Parallel. Pide al Owner que los recargue en Lovable.";
  if (status === 401 || status === 403) return "Parallel ha rechazado la conexión de Nokko. Pide al Owner que la revise en Conexiones.";
  if (status === 404) return "Parallel no encuentra esa investigación: puede que haya fallado. Vuelve a lanzarla.";
  if (status === 422) return `Parallel no ha aceptado la petición: ${body.slice(0, 160)}`;
  if (status === 429) return "Parallel está frenando las peticiones ahora mismo. Espera un minuto y vuelve a probar.";
  return "Parallel no responde ahora mismo. Vuelve a probar en unos minutos.";
}
