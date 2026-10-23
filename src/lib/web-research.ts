// Web research with Firecrawl (company website for onboarding, account research, news signals, stakeholder
// research with sources): pure rules shared by the screens, the agent, MCP and the hourly job.

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1|.*\.local$|.*\.internal$)/i;

/** A public http(s) URL from what the user typed (domain or URL), or an error in Spanish. */
export function publicUrl(raw: string): string {
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`); } catch { throw new Error("La web no es válida. Escribe algo como empresa.com."); }
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname) || !url.hostname.includes(".")) throw new Error("La web no es válida. Escribe algo como empresa.com.");
  url.hash = "";
  return url.toString();
}

/** Pages worth reading for a company's go-to-market, by what their address says. */
const PAGE_RULES: [RegExp, number][] = [
  [/(pricing|precios|tarifas|planes|plans)(\/|$)/i, 1],
  [/(customers|clientes|casos|case-stud|success|testimonials)(\/|$)/i, 2],
  [/(product|producto|platform|plataforma|features|funcionalidades|solutions|soluciones)(\/|$)/i, 3],
  [/(about|nosotros|quienes-somos|sobre|company|empresa)(\/|$)/i, 4],
];
const SKIP = /(blog|news|noticias|templates|plantillas|careers|empleo|jobs|legal|privacy|privacidad|terms|cookies|login|signup|help|support|docs|community|\.pdf$)/i;

/** Up to `max` same-site pages to read besides the home page: pricing, customers, product, about (in that order). */
export function pickPages(links: (string | { url?: string })[], base: string, max = 3): string[] {
  let host: string;
  try { host = new URL(base).hostname.replace(/^www\./, ""); } catch { return []; }
  const best = new Map<number, string>();
  for (const l of links) {
    const raw = typeof l === "string" ? l : l?.url;
    if (!raw) continue;
    let u: URL;
    try { u = new URL(raw); } catch { continue; }
    if (u.hostname.replace(/^www\./, "") !== host) continue;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || SKIP.test(path) || path.split("/").filter(Boolean).length > 2) continue;
    // English or the site's main language first: skip obvious other-locale copies when a shorter one exists.
    const rule = PAGE_RULES.find(([re]) => re.test(path.split("/").filter(Boolean).pop() ?? ""));
    if (!rule) continue;
    const cur = best.get(rule[1]);
    if (!cur || u.toString().length < cur.length) best.set(rule[1], `${u.origin}${path}`);
  }
  return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v).slice(0, max);
}

export type NewsItem = { title: string; url: string; snippet: string; date: string | null; source: string };

/** Firecrawl search results (news and web) as one clean list, no duplicates, no empty titles. */
export function newsItems(data: unknown, max = 8): NewsItem[] {
  const d = (data ?? {}) as { news?: unknown[]; web?: unknown[] } | unknown[];
  const raw = Array.isArray(d) ? d : [...((d as { news?: unknown[] }).news ?? []), ...((d as { web?: unknown[] }).web ?? [])];
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const r of raw as { title?: unknown; url?: unknown; snippet?: unknown; description?: unknown; date?: unknown }[]) {
    const url = typeof r?.url === "string" ? r.url : "";
    const title = typeof r?.title === "string" ? r.title.trim() : "";
    if (!/^https?:\/\//.test(url) || !title || seen.has(url)) continue;
    seen.add(url);
    let source = "";
    try { source = new URL(url).hostname.replace(/^www\./, ""); } catch { source = ""; }
    const snippet = String(r.snippet ?? r.description ?? "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim().slice(0, 600);
    out.push({ title: title.slice(0, 300), url, snippet, date: typeof r.date === "string" ? r.date : null, source });
    if (out.length >= max) break;
  }
  return out;
}

export const SIGNAL_KINDS = ["funding", "hiring", "launch", "leadership", "partnership", "expansion", "results", "risk", "other"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];
export const SIGNAL_LABEL: Record<SignalKind, string> = {
  funding: "Ronda o inversión", hiring: "Contrataciones", launch: "Lanzamiento", leadership: "Cambio de dirección", partnership: "Alianza",
  expansion: "Expansión", results: "Resultados", risk: "Riesgo", other: "Novedad",
};

/** Signals worth a suggestion: the ones that open or threaten a sale (not every mention). */
export const ACTIONABLE_SIGNALS: SignalKind[] = ["funding", "hiring", "launch", "leadership", "partnership", "expansion", "risk"];

/** «hace 3 días» style age for a date (found or published). */
export function ageText(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

/** Accounts the hourly job refreshes: ABM targets with a domain, never checked or checked over a week ago, oldest first. */
export function accountsToRefresh(accounts: { id: string; domain: string | null; is_target: boolean; signals_checked_at: string | null }[], now: Date, max: number) {
  const weekAgo = now.getTime() - 7 * 86_400_000;
  return accounts
    .filter((a) => a.is_target && a.domain && (!a.signals_checked_at || new Date(a.signals_checked_at).getTime() < weekAgo))
    .sort((a, b) => (a.signals_checked_at ? new Date(a.signals_checked_at).getTime() : 0) - (b.signals_checked_at ? new Date(b.signals_checked_at).getTime() : 0))
    .slice(0, max);
}

const LEGAL = /\b(s\.?\s?l\.?u?|s\.?\s?a\.?|s\.?\s?a\.?\s?s|inc|ltd|llc|gmbh|corp|co|plc|bv|ag|sas|srl|sl|sa)\.?$/i;

/** The company name as people write it in the news: no notes in brackets, no legal suffix; else the domain's stem. */
export function companyName(name: string | null | undefined, domain?: string | null): string {
  let n = (name ?? "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim().replace(/[,.\s]+$/, "");
  for (let i = 0; i < 2; i++) n = n.replace(/[,\s]+$/, "").replace(LEGAL, "").trim().replace(/[,.\s]+$/, "");
  if (n) return n;
  return (domain ?? "").replace(/^www\./, "").split(".")[0] ?? "";
}

/** Markdown list of sources appended to an AI text, so every claim can be checked. */
export function sourcesMarkdown(sources: { title: string; url: string }[]): string {
  const list = sources.filter((s) => /^https?:\/\//.test(s.url)).slice(0, 10);
  return list.length ? `\n\n**Fuentes**\n${list.map((s) => `- [${s.title.replace(/[[\]]/g, "")}](${s.url})`).join("\n")}` : "";
}

/** Spanish «what happened + what to do» for a Firecrawl error status. */
export function firecrawlErrorText(status: number, body: string): string {
  if (status === 402 || /credit/i.test(body)) return "Firecrawl se ha quedado sin créditos para leer webs. Pide al Owner que los amplíe en Conexiones.";
  if (status === 401 || status === 403) return "Firecrawl ha rechazado la conexión de Nokko. Pide al Owner que la revise en Conexiones.";
  if (status === 429) return "Firecrawl está frenando las peticiones ahora mismo. Espera un minuto y vuelve a probar.";
  if (status === 408 || /timeout|timed out/i.test(body)) return "La web ha tardado demasiado en responder. Vuelve a probar o pega el texto.";
  if (status >= 500) return "Firecrawl no responde ahora mismo. Vuelve a probar en unos minutos.";
  return "No he podido leer esa web. Revisa la dirección o pega el texto.";
}
