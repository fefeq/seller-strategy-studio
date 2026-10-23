import { describe, expect, it } from "vitest";
import { accountsToRefresh, ageText, companyName, firecrawlErrorText, newsItems, pickPages, publicUrl, sourcesMarkdown } from "./web-research";
import { accountSignal } from "./proactive/detectors/account-signal";
import type { Snapshot } from "./proactive/types";

describe("publicUrl", () => {
  it("accepts a domain or URL and refuses private hosts", () => {
    expect(publicUrl("acme.com")).toBe("https://acme.com/");
    expect(publicUrl("http://www.acme.com/precios#x")).toBe("http://www.acme.com/precios");
    expect(() => publicUrl("localhost:3000")).toThrow(/no es válida/);
    expect(() => publicUrl("http://192.168.1.1")).toThrow(/no es válida/);
  });
});

describe("pickPages", () => {
  it("picks pricing, customers, product and about on the same site, skipping blog and deep pages", () => {
    const links = [
      "https://www.acme.com/", "https://www.acme.com/blog/pricing-tips", "https://acme.com/pricing", "https://acme.com/es/precios-y-planes/extra/deep",
      "https://acme.com/customers", "https://other.com/pricing", "https://acme.com/about", "https://acme.com/product", "https://acme.com/legal/terms",
    ];
    expect(pickPages(links, "https://acme.com/", 3)).toEqual(["https://acme.com/pricing", "https://acme.com/customers", "https://acme.com/product"]);
  });
});

describe("newsItems", () => {
  it("merges news and web, drops duplicates and markdown links in snippets", () => {
    const out = newsItems({ news: [{ title: "Acme raises", url: "https://news.com/a", snippet: "[Acme](https://acme.com) raised 10M", date: "2026-10-01" }], web: [{ title: "Acme raises", url: "https://news.com/a" }, { title: "", url: "https://x.com" }] });
    expect(out).toEqual([{ title: "Acme raises", url: "https://news.com/a", snippet: "Acme raised 10M", date: "2026-10-01", source: "news.com" }]);
  });
});

describe("signals", () => {
  it("refreshes only ABM targets with a domain not checked this week, oldest first", () => {
    const now = new Date("2026-10-24T00:00:00Z");
    const list = [
      { id: "a", domain: "a.com", is_target: true, signals_checked_at: "2026-10-20T00:00:00Z" },
      { id: "b", domain: "b.com", is_target: true, signals_checked_at: null },
      { id: "c", domain: "c.com", is_target: true, signals_checked_at: "2026-10-01T00:00:00Z" },
      { id: "d", domain: null, is_target: true, signals_checked_at: null },
      { id: "e", domain: "e.com", is_target: false, signals_checked_at: null },
    ];
    expect(accountsToRefresh(list, now, 5).map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("suggests actionable signals of the last 7 days to the account owner", () => {
    const now = new Date("2026-10-24T00:00:00Z");
    const s = {
      now, accounts: [{ id: "acc", name: "Acme", is_target: true, owner_id: "u1" }],
      signals: [
        { id: "s1", account_id: "acc", title: "Acme raises 10M", kind: "funding", summary: "Ronda de 10M", relevance: "Más presupuesto", url: "https://n.com/1", found_at: "2026-10-22T00:00:00Z" },
        { id: "s2", account_id: "acc", title: "Old", kind: "funding", summary: "", relevance: "", url: "https://n.com/2", found_at: "2026-10-01T00:00:00Z" },
        { id: "s3", account_id: "acc", title: "Results", kind: "results", summary: "", relevance: "", url: "https://n.com/3", found_at: "2026-10-23T00:00:00Z" },
      ],
    } as unknown as Snapshot;
    const out = accountSignal(s);
    expect(out.map((x) => [x.dedupe_key, x.priority, x.user_id, x.link])).toEqual([["signal:s1", 2, "u1", "/accounts/acc?tab=signals"]]);
  });
});

describe("companyName", () => {
  it("drops notes in brackets and legal suffixes, else uses the domain stem", () => {
    expect(companyName("Typeform (prueba)")).toBe("Typeform");
    expect(companyName("Acme Logística S.L.")).toBe("Acme Logística");
    expect(companyName("Globex, Inc.")).toBe("Globex");
    expect(companyName("", "www.initech.io")).toBe("initech");
  });
});

describe("texts", () => {
  it("ages, sources and errors read well", () => {
    expect(ageText("2026-10-21T00:00:00Z", new Date("2026-10-24T00:00:00Z"))).toBe("hace 3 días");
    expect(sourcesMarkdown([{ title: "A [b]", url: "https://a.com" }, { title: "bad", url: "ftp://x" }])).toBe("\n\n**Fuentes**\n- [A b](https://a.com)");
    expect(firecrawlErrorText(402, "")).toMatch(/créditos/);
    expect(firecrawlErrorText(401, "")).toMatch(/Conexiones/);
  });
});
