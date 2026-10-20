import { PUBLIC_PATHS, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

const normalize = (pathname: string) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

/** True for pages listed in PUBLIC_PATHS (trailing slash ignored). */
export function isIndexablePath(pathname: string): boolean {
  const p = normalize(pathname);
  return (PUBLIC_PATHS as readonly string[]).includes(p);
}

/**
 * The X-Robots-Tag an HTML response should carry, or null to leave it indexable.
 * /auth can pass link equity but is not a landing page; everything else outside
 * PUBLIC_PATHS is the private app or a technical screen.
 */
export function robotsTagFor(pathname: string, contentType: string | null): string | null {
  if (!contentType || !contentType.includes("text/html")) return null;
  if (isIndexablePath(pathname)) return null;
  if (normalize(pathname) === "/auth") return "noindex, follow";
  return "noindex, nofollow";
}

export function sitemapXml(lastmod: string): string {
  const urls = PUBLIC_PATHS.map(
    (p) => `  <url>\n    <loc>${absoluteUrl(p)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Organization + WebSite + SoftwareApplication for the home page. Only facts stated on the site. */
export function homeJsonLd(): string {
  const org = `${SITE_URL}/#organization`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.png`,
        description: SITE_DESCRIPTION,
        // Add LinkedIn, Crunchbase, G2… here as they are created.
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        inLanguage: "es",
        publisher: { "@id": org },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "es",
        description: SITE_DESCRIPTION,
        publisher: { "@id": org },
      },
    ],
  };
  // Escape "<" so the JSON can never close the <script> tag it lives in.
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
