// Firecrawl v2 (direct API: this connection is not gateway-backed). Server-only usage: the key is read
// inside each call. Rules for what to read and how to clean it live in src/lib/web-research.ts.
import { firecrawlErrorText } from "@/lib/web-research";

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

async function call(path: string, body: unknown, timeoutMs = 45_000): Promise<any> {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key)
    throw new Error(
      "Firecrawl no está conectado a Nokko. Pide al Owner que lo conecte en Conexiones.",
    );
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${FIRECRAWL_V2}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const raw = await res.text();
      console.error(`Firecrawl ${path} [${res.status}] body ${raw.length} chars`);
      throw new Error(firecrawlErrorText(res.status, raw));
    }
    return await res.json();
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error(firecrawlErrorText(408, "timeout"));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Main content of one page as markdown (empty string when the page has none). */
export async function scrapeMarkdown(
  url: string,
  maxChars = 12_000,
): Promise<{ markdown: string; title: string }> {
  const r = await call("/scrape", {
    url,
    formats: ["markdown"],
    onlyMainContent: true,
    timeout: 30_000,
  });
  const doc = r.data ?? r;
  return {
    markdown: String(doc.markdown ?? "").slice(0, maxChars),
    title: String(doc.metadata?.title ?? ""),
  };
}

/** Same-site addresses (with titles when Firecrawl has them). */
export async function mapSite(
  url: string,
  limit = 200,
): Promise<{ url: string; title?: string }[]> {
  const r = await call("/map", { url, limit, includeSubdomains: false }, 30_000);
  return ((r.links ?? r.data?.links ?? []) as (string | { url: string; title?: string })[]).map(
    (l) => (typeof l === "string" ? { url: l } : l),
  );
}

/** Web or news search; `tbs` limits by age (qdr:w week, qdr:m month, qdr:y year). */
export async function search(
  query: string,
  opts: {
    limit?: number;
    sources?: ("web" | "news")[];
    tbs?: string;
    lang?: string;
    country?: string;
  } = {},
) {
  const r = await call(
    "/search",
    {
      query,
      limit: opts.limit ?? 5,
      sources: opts.sources ?? ["web"],
      tbs: opts.tbs,
      lang: opts.lang,
      country: opts.country,
    },
    30_000,
  );
  return r.data ?? r;
}
