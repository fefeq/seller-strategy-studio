// One web search over three providers (Firecrawl news/web, Perplexity Search and Parallel Search, which reuses
// the Perplexity queries), merged and deduplicated. Any may fail (credits, outage): the others still answer;
// only when all fail is the first error raised.
import { search } from "@/lib/firecrawl";
import { perplexitySearch } from "@/lib/perplexity";
import { parallelSearch } from "@/lib/parallel-gateway";
import { newsItems, type NewsItem } from "@/lib/web-research";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

export async function searchBoth(
  firecrawl: { query: string; limit?: number; sources?: ("web" | "news")[]; tbs?: string } | null,
  perplexity: {
    queries: string[];
    maxResults?: number;
    recency?: "day" | "week" | "month" | "year";
  } | null,
  max = 12,
): Promise<NewsItem[]> {
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
