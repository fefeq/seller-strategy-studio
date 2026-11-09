// Perplexity Search API through the Lovable connector gateway. This connection is managed by Lovable,
// which allows only POST /search (no chat, deep research or SEC modes). Server-only usage.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/perplexity";

export function perplexityErrorText(status: number, body: string): string {
  if (status === 402) return "Se han agotado los créditos del espacio de trabajo para buscar con Perplexity. Pide al Owner que los recargue en Lovable.";
  if (status === 401 || status === 403) return "Perplexity ha rechazado la conexión de Nokko. Pide al Owner que la revise en Conexiones.";
  if (status === 429) return "Perplexity está frenando las búsquedas ahora mismo. Espera un minuto y vuelve a probar.";
  if (status >= 500) return "Perplexity no responde ahora mismo. Vuelve a probar en unos minutos.";
  return `Perplexity no ha aceptado la búsqueda: ${body.slice(0, 200)}`;
}

/** Up to 5 queries in one call; results come back as one list of { title, url, snippet, date }. */
export async function perplexitySearch(queries: string[], opts: { maxResults?: number; recency?: "day" | "week" | "month" | "year" } = {}): Promise<{ title: string; url: string; snippet: string; date: string | null }[]> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["PERPLEXITY_API_KEY"];
  if (!lovable || !key) throw new Error("Perplexity no está conectado a Nokko.");
  const query = queries.map((q) => q.trim()).filter(Boolean).slice(0, 5);
  if (!query.length) return [];
  const res = await fetch(`${GATEWAY_URL}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ query: query.length === 1 ? query[0] : query, max_results: opts.maxResults ?? 5, ...(opts.recency ? { search_recency_filter: opts.recency } : {}) }),
  });
  if (!res.ok) {
    const raw = await res.text();
    console.error(`Perplexity search [${res.status}] body ${raw.length} chars`);
    throw new Error(perplexityErrorText(res.status, raw));
  }
  const data = (await res.json()) as { results?: unknown };
  // One query → a flat list; several → Perplexity may nest a list per query.
  const flat = (Array.isArray(data.results) ? data.results : []).flat() as { title?: string; url?: string; snippet?: string; date?: string }[];
  return flat.filter((r) => r?.url && r?.title).map((r) => ({ title: String(r.title), url: String(r.url), snippet: String(r.snippet ?? ""), date: r.date ?? null }));
}
