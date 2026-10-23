// One web search over both providers (Firecrawl news/web and Perplexity Search), merged and deduplicated.
// Either may fail (credits, outage): the other still answers; only when both fail is the first error raised.
import { search } from "@/lib/firecrawl";
import { perplexitySearch } from "@/lib/perplexity";
import { newsItems, type NewsItem } from "@/lib/web-research";

export async function searchBoth(
  firecrawl: { query: string; limit?: number; sources?: ("web" | "news")[]; tbs?: string } | null,
  perplexity: { queries: string[]; maxResults?: number; recency?: "day" | "week" | "month" | "year" } | null,
  max = 12,
): Promise<NewsItem[]> {
  const [fc, px] = await Promise.allSettled([
    firecrawl ? search(firecrawl.query, { limit: firecrawl.limit, sources: firecrawl.sources, tbs: firecrawl.tbs }).then((d) => newsItems(d, max)) : Promise.resolve([] as NewsItem[]),
    perplexity && process.env["PERPLEXITY_API_KEY"] ? perplexitySearch(perplexity.queries, { maxResults: perplexity.maxResults, recency: perplexity.recency }).then((r) => newsItems(r, max)) : Promise.resolve([] as NewsItem[]),
  ]);
  if (fc.status === "rejected" && px.status === "rejected") throw fc.reason;
  if (fc.status === "rejected") console.error("Firecrawl search failed", (fc.reason as Error)?.message);
  if (px.status === "rejected") console.error("Perplexity search failed", (px.reason as Error)?.message);
  return newsItems([...(fc.status === "fulfilled" ? fc.value : []), ...(px.status === "fulfilled" ? px.value : [])], max);
}
