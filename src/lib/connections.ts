// C1 (PLAN-UX-20261115): one Connections screen with the real state of each service. Pure, tested.
// The catalogue names env vars only so the server can check presence; values never leave the server and never reach the agent.

export type ConnState = "included" | "own" | "missing" | "error";
export const STATE_LABEL: Record<ConnState, string> = {
  included: "Incluida en NOKKO",
  own: "Tu cuenta",
  missing: "Sin conectar",
  error: "Error",
};

export type Service = {
  id: string;
  name: string;
  what: string;
  /** Usage rows in integration_usage (service column). */
  usage: string[];
  /** Shared NOKKO credential (env var) or per-company account. */
  source: { kind: "shared"; env: string; gateway: string | null } | { kind: "company"; table: "stripe_connections" | "posthog_connections" | "mailbox_links" };
};

export const SERVICES: Service[] = [
  { id: "openrouter", name: "IA (OpenRouter)", what: "Agente, redacción y clasificación.", usage: ["ai", "openrouter"], source: { kind: "shared", env: "OPENROUTER_API_KEY", gateway: null } },
  { id: "apollo", name: "Apollo.io", what: "Empresas, personas, emails y móviles.", usage: ["apollo"], source: { kind: "shared", env: "APOLLO_API_KEY", gateway: "apollo" } },
  { id: "clay", name: "Clay", what: "Empresas, stakeholders y completar cuentas.", usage: ["clay"], source: { kind: "shared", env: "CLAY_API_KEY", gateway: "clay" } },
  { id: "apify", name: "Apify (LinkedIn y G2)", what: "Publicaciones, ofertas, cargos y reseñas.", usage: ["apify"], source: { kind: "shared", env: "APIFY_API_KEY", gateway: "apify" } },
  { id: "parallel", name: "Parallel", what: "Informes de cuenta y listas por ICP.", usage: ["parallel"], source: { kind: "shared", env: "PARALLEL_API_KEY", gateway: "parallel" } },
  { id: "perplexity", name: "Perplexity", what: "Búsqueda de noticias y research.", usage: ["perplexity", "web"], source: { kind: "shared", env: "PERPLEXITY_API_KEY", gateway: "perplexity" } },
  { id: "firecrawl", name: "Firecrawl", what: "Lectura de webs.", usage: ["firecrawl"], source: { kind: "shared", env: "FIRECRAWL_API_KEY", gateway: null } },
  { id: "drive", name: "Google Drive", what: "Carpetas y documentos por cuenta.", usage: ["drive"], source: { kind: "shared", env: "GOOGLE_DRIVE_API_KEY", gateway: "google_drive" } },
  { id: "resend", name: "Email (Resend)", what: "Resumen diario desde avisos@nokko.ai.", usage: ["resend"], source: { kind: "shared", env: "RESEND_API_KEY", gateway: "resend" } },
  { id: "telegram", name: "Telegram", what: "Avisos y agente en el móvil.", usage: ["telegram"], source: { kind: "shared", env: "TELEGRAM_API_KEY", gateway: "telegram" } },
  { id: "stripe", name: "Stripe", what: "Ingresos reales en Métricas.", usage: ["stripe"], source: { kind: "company", table: "stripe_connections" } },
  { id: "posthog", name: "PostHog", what: "Uso de producto.", usage: ["posthog"], source: { kind: "company", table: "posthog_connections" } },
  { id: "gmail", name: "Gmail (respuestas)", what: "Bandeja de respuestas en solo lectura.", usage: ["gmail"], source: { kind: "company", table: "mailbox_links" } },
];

export type Test = { ok: boolean; at: string; detail?: string } | null;

/** State shown: a failed test wins (Error); else the source decides. */
export function connectionState(svc: Service, present: boolean, test: Test): ConnState {
  if (test && !test.ok) return "error";
  if (!present) return "missing";
  return svc.source.kind === "shared" ? "included" : "own";
}

/** Month usage from ledger rows: unknown costs are counted apart, never summed as zero. Currencies stay separate. */
export function monthUsage(rows: { service: string; cost: number | null; currency: string; created_at: string }[], svc: Service, now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const mine = rows.filter((r) => svc.usage.includes(r.service) && r.created_at >= start);
  const byCurrency: Record<string, number> = {};
  let unknown = 0;
  for (const r of mine) {
    if (r.cost == null) unknown++;
    else byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + r.cost;
  }
  return { uses: mine.length, byCurrency, unknown };
}
