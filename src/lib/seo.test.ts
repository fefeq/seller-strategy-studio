import { describe, expect, it } from "vitest";
import { homeJsonLd, isIndexablePath, robotsTagFor, sitemapXml } from "@/lib/seo";
import { CONSENT_BOOT, eventPayload } from "@/lib/analytics";
import { GTM_ID, PUBLIC_PATHS } from "@/lib/site";

const html = "text/html; charset=utf-8";

describe("robots", () => {
  it("leaves public pages indexable", () => {
    expect(isIndexablePath("/")).toBe(true);
    expect(robotsTagFor("/", html)).toBeNull();
  });

  it("keeps the app behind the login out of the index", () => {
    for (const p of ["/home", "/leads", "/accounts/123", "/.lovable/oauth/consent", "/no-existe"]) {
      expect(robotsTagFor(p, html)).toBe("noindex, nofollow");
    }
  });

  it("lets /auth pass links but not rank", () => {
    expect(robotsTagFor("/auth", html)).toBe("noindex, follow");
    expect(robotsTagFor("/auth/", html)).toBe("noindex, follow");
  });

  it("does not tag non-HTML responses", () => {
    expect(robotsTagFor("/robots.txt", "text/plain")).toBeNull();
    expect(robotsTagFor("/sitemap.xml", "application/xml")).toBeNull();
    expect(robotsTagFor("/api/public/leads", "application/json")).toBeNull();
    expect(robotsTagFor("/home", null)).toBeNull();
  });
});

describe("sitemap", () => {
  it("lists every public path with an absolute URL", () => {
    const xml = sitemapXml("2026-10-21");
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.match(/<loc>/g)).toHaveLength(PUBLIC_PATHS.length);
    expect(xml).toContain("<loc>https://nokko.ai/</loc>");
    expect(xml).toContain("<lastmod>2026-10-21</lastmod>");
  });
});

describe("structured data", () => {
  it("is valid JSON that cannot break out of its script tag", () => {
    const raw = homeJsonLd();
    expect(raw).not.toContain("<");
    const data = JSON.parse(raw);
    const types = data["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
  });
});

describe("analytics", () => {
  it("starts with every consent denied and loads the Nokko container", () => {
    expect(CONSENT_BOOT).toContain('analytics_storage:"denied"');
    expect(CONSENT_BOOT).toContain('ad_storage:"denied"');
    expect(CONSENT_BOOT.indexOf('"consent","default"')).toBeLessThan(
      CONSENT_BOOT.indexOf("gtm.js"),
    );
    expect(CONSENT_BOOT).toContain(GTM_ID);
  });

  it("sends only the event name and fixed parameters, resetting unused ones", () => {
    expect(eventPayload("login", { method: "google" })).toEqual({
      event: "login",
      method: "google",
      location: undefined,
    });
    const p = eventPayload("cta_click", { location: "hero_empezar" });
    expect(Object.keys(p).sort()).toEqual(["event", "location", "method"]);
    expect(p.method).toBeUndefined();
  });
});
