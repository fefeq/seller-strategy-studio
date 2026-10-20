import { createFileRoute } from "@tanstack/react-router";
import { sitemapXml } from "@/lib/seo";
import { PUBLIC_LASTMOD } from "@/lib/site";

// Lists PUBLIC_PATHS for search engines; declared in public/robots.txt.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(sitemapXml(PUBLIC_LASTMOD), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
