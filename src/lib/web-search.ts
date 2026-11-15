// One web search over three providers (Firecrawl news/web, Perplexity Search and Parallel Search, which reuses
// the Perplexity queries), merged and deduplicated. Any may fail (credits, outage): the others still answer;
// only when all fail is the first error raised.
import { search } from "@/lib/firecrawl";
import { perplexitySearch } from "@/lib/perplexity";
import { parallelSearch } from "@/lib/parallel-gateway";
import { newsItems, type NewsItem } from "@/lib/web-research";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import type { Db } from "@/lib/org-data";

/**
 * Who pays a loose web search (A2 of PLAN-UX-20261115): when given, every provider actually called is written
 * to the company's ledger as one row with an unknown cost («sin dato», never zero). Callers already wrapped by
 * trackedRun (which logs the planner's estimate) do not pass it, so nothing is counted twice.
 */
export type WebSpend = {
  db: Db;
  orgId: string;
  userId: string | null;
  tool: string;
  trigger: "manual" | "automatic";
};

export type WebProvider = "firecrawl" | "perplexity" | "parallel";

/** Ledger rows for the providers a search called: unknown cost, the tool that asked, the company that pays. */
export function webSpendRows(spend: WebSpend, providers: WebProvider[]) {
  return providers.map((service) => ({
    org_id: spend.orgId,
    user_id: spend.userId || null,
    service,
    need: null,
    trigger: spend.trigger,
    cost: null,
    cost_kind: "unknown",
    tool: spend.tool,
    volume: 1,
  }));
}

async function logWebSpend(spend: WebSpend | undefined, providers: WebProvider[]) {
  if (!spend || !providers.length) return;
  try {
    const { error } = await spend.db.from("integration_usage").insert(webSpendRows(spend, providers));
    if (error) console.error("integration_usage insert failed", safeErrorLog(error));
  } catch (e) {
    console.error("integration_usage insert failed", safeErrorLog(e));
  }
}

function calledProviders(firecrawl: unknown, perplexity: unknown): WebProvider[] {
  const out: WebProvider[] = [];
  if (firecrawl) out.push("firecrawl");
  if (perplexity && process.env["PERPLEXITY_API_KEY"]) out.push("perplexity");
  if (perplexity && process.env["PARALLEL_API_KEY"]) out.push("parallel");
  return out;
}

export async function searchBoth(
  firecrawl: { query: string; limit?: number; sources?: ("web" | "news")[]; tbs?: string } | null,
  perplexity: {
    queries: string[];
    maxResults?: number;
    recency?: "day" | "week" | "month" | "year";
  } | null,
  max = 12,
  spend?: WebSpend,
): Promise<NewsItem[]> {
  await logWebSpend(spend, calledProviders(firecrawl, perplexity));
  const afterDate = perplexity?.recency
    ? new Date(
        Date.now() -
          ({ day: 1, week: 7, month: 31, year: 365 } as const)[perplexity.recency] * 86_400_000,
      )
        .toISOString()
        .slice(0, 10)
    : null;
  const [fc, px, pl] = await Promise.allSettled([
    firecrawl
      ? search(firecrawl.query, {
          limit: firecrawl.limit,
          sources: firecrawl.sources,
          tbs: firecrawl.tbs,
        }).then((d) => newsItems(d, max))
      : Promise.resolve([] as NewsItem[]),
    perplexity && process.env["PERPLEXITY_API_KEY"]
      ? perplexitySearch(perplexity.queries, {
          maxResults: perplexity.maxResults,
          recency: perplexity.recency,
        }).then((r) => newsItems(r, max))
      : Promise.resolve([] as NewsItem[]),
    perplexity && process.env["PARALLEL_API_KEY"]
      ? parallelSearch(perplexity.queries.join(" · "), perplexity.queries, {
          max: perplexity.maxResults ?? 5,
          afterDate,
        }).then((r) => newsItems(r, max))
      : Promise.resolve([] as NewsItem[]),
  ]);
  if (fc.status === "rejected" && px.status === "rejected" && pl.status === "rejected")
    throw fc.reason;
  if (fc.status === "rejected") console.error("Firecrawl search failed", safeErrorLog(fc.reason));
  if (px.status === "rejected") console.error("Perplexity search failed", safeErrorLog(px.reason));
  if (pl.status === "rejected") console.error("Parallel search failed", safeErrorLog(pl.reason));
  const ok = (r: PromiseSettledResult<NewsItem[]>) => (r.status === "fulfilled" ? r.value : []);
  return newsItems([...ok(fc), ...ok(px), ...ok(pl)], max);
}

/** Same search, but every result keeps the provider it came from (NK-0171 q-6). */
export async function searchTagged(
  firecrawl: Parameters<typeof searchBoth>[0],
  perplexity: Parameters<typeof searchBoth>[1],
  max = 12,
  spend?: WebSpend,
): Promise<import("@/lib/plays/custom/engine").TaggedItem[]> {
  await logWebSpend(spend, calledProviders(firecrawl, perplexity));
  const { mergeTagged } = await import("@/lib/plays/custom/engine");
  const tag = (p: "firecrawl" | "perplexity" | "parallel") => (xs: NewsItem[]) => xs.map((x) => ({ ...x, provider: p }));
  const [fc, px, pl] = await Promise.allSettled([
    firecrawl ? search(firecrawl.query, { limit: firecrawl.limit, sources: firecrawl.sources, tbs: firecrawl.tbs }).then((d) => tag("firecrawl")(newsItems(d, max))) : Promise.resolve([]),
    perplexity && process.env["PERPLEXITY_API_KEY"] ? perplexitySearch(perplexity.queries, { maxResults: perplexity.maxResults, recency: perplexity.recency }).then((r) => tag("perplexity")(newsItems(r, max))) : Promise.resolve([]),
    perplexity && process.env["PARALLEL_API_KEY"] ? parallelSearch(perplexity.queries.join(" · "), perplexity.queries, { max: perplexity.maxResults ?? 5, afterDate: null }).then((r) => tag("parallel")(newsItems(r, max))) : Promise.resolve([]),
  ]);
  if (fc.status === "rejected" && px.status === "rejected" && pl.status === "rejected") throw fc.reason;
  const ok = <T,>(r: PromiseSettledResult<T[]>) => (r.status === "fulfilled" ? r.value : []);
  return mergeTagged([ok(fc), ok(px), ok(pl)], max);
}
