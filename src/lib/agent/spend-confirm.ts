// Confirmation before spending (A2 of PLAN-UX-20261115). Every agent/MCP/Telegram tool that spends provider
// credits or balance is proposed first and shows an estimated cost from the company's own measured history
// («sin dato» when there is none, never an invented amount). After the person confirms, the tool's full result
// is kept in the pending action and in the conversation, so nothing paid for is lost. Pure-ish: the only I/O is
// spendEstimateLine's ledger read.
import { estimateCost, type SpendRow } from "@/lib/spend";
import type { Db } from "@/lib/org-data";

/** Tools that spend, with the provider that charges. Reads that spend become proposals (kind write). */
export const SPEND_TOOLS: Record<string, string> = {
  apollo_find_companies: "apollo",
  apollo_enrich_account: "apollo",
  apollo_reveal_contacts: "apollo",
  apollo_reveal_stakeholder: "apollo",
  clay_find_companies: "clay",
  clay_find_people: "clay",
  clay_enrich_account: "clay",
  linkedin_company_posts: "apify",
  linkedin_profile_posts: "apify",
  company_job_postings: "apify",
  linkedin_role_check: "apify",
  competitor_reviews: "apify",
  create_battlecard_from_reviews: "apify",
  enrich_accounts_table: "parallel",
  start_account_report: "parallel",
  start_icp_account_list: "parallel",
  research_account: "web",
  research_stakeholder: "web",
  refresh_account_signals: "web",
  // Orchestrator tools that may fall back to paid providers (Apollo → Clay → web).
  complete_account: "apollo/clay/web",
  find_key_people: "apollo/clay",
  find_icp_companies: "apollo/clay",
  autopilot_prepare_meeting: "ia",
  autopilot_review_account: "ia",
};

/** Read tools that spend and therefore need the person's confirmation before running. */
export const SPENDING_READS = [
  "complete_account",
  "find_key_people",
  "find_icp_companies",
  "apollo_find_companies",
  "apollo_enrich_account",
  "clay_find_companies",
  "clay_find_people",
  "clay_enrich_account",
  "linkedin_company_posts",
  "linkedin_profile_posts",
  "linkedin_role_check",
  "company_job_postings",
  "competitor_reviews",
  "enrich_accounts_table",
  "research_account",
] as const;

const LABEL: Record<string, string> = {
  apollo_find_companies: "Buscar empresas en Apollo",
  apollo_enrich_account: "Consultar los datos de la cuenta en Apollo",
  clay_find_companies: "Buscar empresas en Clay",
  clay_find_people: "Buscar personas de la cuenta en Clay",
  clay_enrich_account: "Consultar los datos de la cuenta en Clay",
  linkedin_company_posts: "Leer las publicaciones de LinkedIn de la cuenta",
  linkedin_profile_posts: "Leer las publicaciones de LinkedIn del stakeholder",
  linkedin_role_check: "Comprobar en LinkedIn si la persona ha cambiado de cargo",
  company_job_postings: "Ver las ofertas de empleo de la cuenta en LinkedIn",
  competitor_reviews: "Leer reseñas del competidor en G2",
  enrich_accounts_table: "Completar datos de cuentas con Parallel",
  research_account: "Investigar la cuenta en la web",
};

const ARG_KEYS = ["query", "keywords", "competitor", "product", "domain", "name", "criteria"];

/** Short summary of a spending read for the confirmation card. */
export function spendSummary(tool: string, args: unknown): string {
  const base = LABEL[tool] ?? tool.replace(/_/g, " ");
  const a = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
  for (const k of ARG_KEYS) {
    const v = a[k];
    if (typeof v === "string" && v.trim()) return `${base}: «${v.trim().slice(0, 80)}»`;
    if (Array.isArray(v) && v.length) return `${base}: «${v.slice(0, 4).join(", ").slice(0, 80)}»`;
  }
  if (Array.isArray(a["account_ids"]))
    return `${base} (${(a["account_ids"] as unknown[]).length} cuentas)`;
  return base;
}

const money = (v: number, currency: string) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 4 }).format(
    v,
  );

/**
 * «coste aprox.» line from the company's measured history of this same tool, one figure per currency (never
 * merged or converted). Without measured samples: «sin dato».
 */
export function estimateText(rows: SpendRow[], tool: string): string {
  const parts: string[] = [];
  for (const cur of ["EUR", "USD"]) {
    const e = estimateCost(rows, tool, cur);
    if (e.value !== null)
      parts.push(
        `${money(e.value, cur)} (mediana de ${e.samples} ${e.samples === 1 ? "uso" : "usos"})`,
      );
  }
  return `coste aprox.: ${parts.length ? parts.join(" + ") : "sin dato"}`;
}

/** Reads the company's ledger for this tool and returns the «coste aprox.» line; a failed read says «sin dato». */
export async function spendEstimateLine(db: Db, orgId: string, tool: string): Promise<string> {
  return (await spendEstimate(db, orgId, tool, "EUR")).line;
}

/** A numeric estimate is comparable only in the organization's currency, with no foreign subtotal. */
export async function spendEstimate(
  db: Db,
  orgId: string,
  tool: string,
  currency: string,
): Promise<{ line: string; value: number | null }> {
  try {
    const { data, error } = await db
      .from("integration_usage")
      .select("cost,currency,cost_kind,tool,created_at")
      .eq("org_id", orgId)
      .eq("tool", tool)
      .eq("cost_kind", "measured")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { line: estimateText([], tool), value: null };
    const rows = (data ?? []) as SpendRow[];
    const other = rows.some((r) => r.currency !== currency);
    return {
      line: estimateText(rows, tool),
      value: other ? null : estimateCost(rows, tool, currency).value,
    };
  } catch {
    return { line: estimateText([], tool), value: null };
  }
}

/** Summary shown on the confirmation card: what, who charges, and the estimate. */
export function withEstimate(summary: string, tool: string, line: string): string {
  const svc = SPEND_TOOLS[tool];
  return `${summary} · gasta ${svc === "web" ? "búsqueda web" : (svc ?? "créditos")} · ${line}`;
}

/** What the person sees after confirming a spending read: the full result, clipped so a message stays readable. */
export function spendResultText(summary: string, out: unknown, max = 60_000): string {
  const note =
    out && typeof out === "object" && typeof (out as { mensaje?: unknown }).mensaje === "string"
      ? ` ${(out as { mensaje: string }).mensaje}`
      : "";
  let body: string;
  try {
    body = JSON.stringify(out, null, 2) ?? "";
  } catch {
    body = String(out);
  }
  if (body.length > max) body = `${body.slice(0, max)}…`;
  return `Hecho: ${summary}.${note}\n\nResultado:\n${body}`;
}
