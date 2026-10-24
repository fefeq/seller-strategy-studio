import { describe, expect, it } from "vitest";
import { chunk, clampCount, enrichLookup, enrichPatch, listInput, listProcessor, readEnrichRows, readEntities, readReport, reportMarkdown, searchAsNews } from "./parallel";

describe("deep account report", () => {
  it("reads each field with its sources and confidence", () => {
    const r = readReport({ content: { summary: "Hace formularios", financials: "" }, basis: [{ field: "summary", confidence: "high", citations: [{ url: "https://a.com", title: "A" }, { url: "https://a.com" }, { url: "ftp://x" }] }] });
    expect(r!.summary).toEqual({ value: "Hace formularios", confidence: "high", sources: [{ url: "https://a.com", title: "A" }] });
    expect(r!.financials).toEqual({ value: "Sin datos", confidence: null, sources: [] });
    expect(readReport({ content: "not json" })).toBeNull();
    const md = reportMarkdown("Acme", r!, new Date("2026-10-24T12:00:00Z"));
    expect(md).toContain("## Resumen (confianza alta)");
    expect(md).toContain("Fuentes: [A](https://a.com)");
  });
});

describe("ICP list", () => {
  it("picks the processor by size and clamps the count", () => {
    expect(listProcessor(25)).toBe("ultra");
    expect(listProcessor(26)).toBe("ultra2x");
    expect(clampCount(500)).toBe(100);
    expect(clampCount(1)).toBe(5);
  });
  it("builds the brief from the ICP", () => {
    const t = listInput({ industries: "Fintech", company_size: "50-200", geography: "Madrid", anti_icp: "Bancos" }, "Serie A", 30);
    expect(t).toContain("Encuentra 30 empresas");
    expect(t).toContain("Sectores: Fintech.");
    expect(t).toContain("Excluye: Bancos.");
    expect(t).toContain("Criterios adicionales: Serie A");
  });
  it("turns entities into accounts, one per domain, marking existing ones", () => {
    const e = readEntities({ content: { entities: [{ name: "Acme", url: "https://www.acme.com/about" }, { name: "Acme Dup", url: "acme.com" }, { name: "Beta", url: "https://beta.io" }, { name: "", url: "x" }] } }, [{ id: "a1", domain: "beta.io", name: "Beta SL" }]);
    expect(e).toEqual([
      { name: "Acme", domain: "acme.com", url: "https://www.acme.com/about", existingId: null },
      { name: "Beta", domain: "beta.io", url: "https://beta.io", existingId: "a1" },
    ]);
  });
});

describe("enrichment table", () => {
  it("chunks in fives and maps rows back by key", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7]).map((c) => c.length)).toEqual([5, 2]);
    const lookup = enrichLookup([{ key: "r1", name: "Typeform", domain: "typeform.com", id: "acc1" }, { key: "r2", name: "Factorial", domain: "https://factorialhr.com", id: "acc2" }]);
    const rows = readEnrichRows({ rows: [{ key: "r1", industry: "SaaS", size: "null", country: "España", funding: null, technology: "HubSpot", source_url: "https://x.com" }, { key: "zz", industry: "x" }, { key: "factorialhr.com", industry: "HR" }, { key: "Typeform", industry: "dup" }] }, lookup);
    expect(rows.map((r) => [r.account_id, r.industry])).toEqual([["acc1", "SaaS"], ["acc2", "HR"]]);
    expect(rows[0]).toEqual({ account_id: "acc1", industry: "SaaS", size: null, country: "ES", funding: null, technology: "HubSpot", source_url: "https://x.com" });
  });
  it("fills only empty fields and adds funding and technology as a note line", () => {
    const p = enrichPatch({ industry: "Fintech", size: null, country: "", notes: "Cliente potente" }, { account_id: "a", industry: "SaaS", size: "200 empleados", country: "ES", funding: "Serie A 10 M€ (2026)", technology: null, source_url: null });
    expect(p).toEqual({ size: "200 empleados", country: "ES", notes: "Cliente potente\nFinanciación: Serie A 10 M€ (2026)" });
  });
});

describe("search results", () => {
  it("map to news items without tracking parameters", () => {
    expect(searchAsNews([{ url: "https://t.com/a?utm_source=parallel&utm_medium=ai#x", title: "T", publish_date: "2026-10-06", excerpts: ["e"] }])).toEqual([{ url: "https://t.com/a#x", title: "T", snippet: "e", date: "2026-10-06" }]);
  });
});
