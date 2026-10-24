import { describe, expect, it } from "vitest";
import {
  autoFillText, decideFill, evidenceInText, extractVisibleText, isBlockedHost, isFreeEmailDomain, isSafePublicHost, missingFields,
  normalizeCountry, parseExtraction, planEnrichment, readAutoEnrichment, readAutoFilled, type SourceRunner,
} from "./enrichment";

const empty = { industry: null, size: null, country: null, auto_filled: {} };

describe("decideFill (CA-2, CA-3, CA-6)", () => {
  it("fills empty fields", () => {
    expect(decideFill(empty, "industry", "web")).toBe(true);
    expect(decideFill({ ...empty, industry: "  " }, "industry", "web")).toBe(true);
  });
  it("never overwrites a manual value, whatever the source", () => {
    const a = { ...empty, industry: "Fintech" };
    expect(decideFill(a, "industry", "web")).toBe(false);
    expect(decideFill(a, "industry", "provider")).toBe(false);
  });
  it("a provider may replace a web value, but web may not replace a provider value", () => {
    const web = { ...empty, size: "Empleados: 10", auto_filled: { size: { source: "web", at: "2026-10-23" } } };
    const prov = { ...empty, size: "Empleados: 12", auto_filled: { size: { source: "provider", at: "2026-10-23" } } };
    expect(decideFill(web, "size", "provider")).toBe(true);
    expect(decideFill(web, "size", "web")).toBe(false);
    expect(decideFill(prov, "size", "web")).toBe(false);
  });
  it("lists only the fields a source may still write", () => {
    expect(missingFields({ ...empty, country: "ES" }, "web")).toEqual(["industry", "size"]);
  });
  it("reads auto_filled defensively", () => {
    expect(readAutoFilled(null)).toEqual({});
    expect(readAutoFilled({ industry: { source: "web", at: "x" }, size: 3, foo: {} })).toEqual({ industry: { source: "web", at: "x" } });
  });
});

describe("normalizeCountry", () => {
  it("accepts ISO codes and Spanish or English names", () => {
    expect(normalizeCountry("es")).toBe("ES");
    expect(normalizeCountry("España")).toBe("ES");
    expect(normalizeCountry("Spain")).toBe("ES");
    expect(normalizeCountry("México")).toBe("MX");
    expect(normalizeCountry("Estados Unidos")).toBe("US");
  });
  it("returns null when it cannot map with certainty", () => {
    expect(normalizeCountry("Atlantis")).toBeNull();
    expect(normalizeCountry("")).toBeNull();
    expect(normalizeCountry(null)).toBeNull();
  });
});

describe("domains (CA-11, CA-14)", () => {
  it("skips free-email domains", () => {
    expect(isFreeEmailDomain("gmail.com")).toBe(true);
    expect(isFreeEmailDomain("acme.es")).toBe(false);
  });
  it("blocks LinkedIn hosts", () => {
    expect(isBlockedHost("linkedin.com")).toBe(true);
    expect(isBlockedHost("www.linkedin.com")).toBe(true);
    expect(isBlockedHost("lnkd.in")).toBe(true);
    expect(isBlockedHost("notlinkedin.com")).toBe(false);
  });
  it("accepts only public named hosts", () => {
    expect(isSafePublicHost("acme.es")).toBe(true);
    expect(isSafePublicHost("www.acme.co.uk")).toBe(true);
    for (const bad of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "intranet", "a.local", "db.internal", "acme.es:8080", "linkedin.com", "", null, "a..b.com", "-"]) {
      expect(isSafePublicHost(bad as string | null)).toBe(false);
    }
  });
});

describe("page extraction (CA-8)", () => {
  const text = extractVisibleText("<html><script>var x=1</script><body><h1>Acme</h1><p>Somos una empresa de logística con sede en Madrid, España. Más de 1.200 empleados.</p></body></html>");
  it("strips scripts and tags", () => {
    expect(text).toContain("Somos una empresa de logística");
    expect(text).not.toContain("var x");
  });
  it("checks evidence against the text", () => {
    expect(evidenceInText("empresa de logística con sede en Madrid", text)).toBe(true);
    expect(evidenceInText("fabricamos coches", text)).toBe(false);
    expect(evidenceInText("", text)).toBe(false);
  });
  it("accepts values backed by evidence", () => {
    const raw = JSON.stringify({
      industry: "Logística", industry_evidence: "empresa de logística",
      employees: 1200, employees_evidence: "Más de 1.200 empleados",
      country: "España", country_evidence: "sede en Madrid, España",
    });
    expect(parseExtraction(raw, text)).toEqual({ industry: "Logística", size: "Empleados: 1200", country: "ES" });
  });
  it("drops values without evidence in the page (no guessing)", () => {
    const raw = JSON.stringify({
      industry: "Fintech", industry_evidence: "somos una fintech",
      employees: 50, employees_evidence: "Más de 1.200 empleados",
      country: "Francia", country_evidence: null,
    });
    expect(parseExtraction(raw, text)).toEqual({});
  });
  it("never throws on bad model output", () => {
    expect(parseExtraction("no json", text)).toEqual({});
    expect(parseExtraction("{}", text)).toEqual({});
  });
});

describe("planEnrichment (CA-1, CA-12)", () => {
  const web: SourceRunner = { id: "web", run: async () => ({ patch: { industry: "Logística", country: "ES" }, usage: { pages: 2 } }) };
  const provider: SourceRunner = { id: "provider", run: async () => ({ patch: { industry: "Transporte", size: "Empleados: 80" } }) };
  const acct = { name: "Acme", domain: "acme.es", ...empty };

  it("asks the provider first and the web only for what is left", async () => {
    const r = await planEnrichment(acct, [web, provider]);
    expect(r.patch).toEqual({ industry: "Transporte", size: "Empleados: 80", country: "ES" });
    expect(r.marks).toEqual({ industry: "provider", size: "provider", country: "web" });
    expect(r.usage).toEqual({ "web.pages": 2 });
  });
  it("does not ask for fields that already have a value", async () => {
    let asked: string[] = [];
    const spy: SourceRunner = { id: "web", run: async (c) => { asked = c.fields; return { patch: {} }; } };
    await planEnrichment({ ...acct, industry: "Retail", country: "ES" }, [spy]);
    expect(asked).toEqual(["size"]);
  });
  it("a failing source is reported, not thrown, and the next one still runs", async () => {
    const boom: SourceRunner = { id: "provider", run: async () => { throw new Error("timeout"); } };
    const r = await planEnrichment(acct, [web, boom]);
    expect(r.errors[0]).toContain("provider: timeout");
    expect(r.patch).toEqual({ industry: "Logística", country: "ES" });
  });
  it("returns an empty patch when nothing is found", async () => {
    const none: SourceRunner = { id: "web", run: async () => ({ patch: {} }) };
    expect((await planEnrichment(acct, [none])).patch).toEqual({});
  });
});

describe("company switch and badge (CA-4, CA-17)", () => {
  it("is on unless the company turned it off", () => {
    expect(readAutoEnrichment(null)).toBe(true);
    expect(readAutoEnrichment({})).toBe(true);
    expect(readAutoEnrichment({ auto_enrichment: true })).toBe(true);
    expect(readAutoEnrichment({ auto_enrichment: false })).toBe(false);
  });
  it("describes source and date", () => {
    expect(autoFillText(undefined)).toBeNull();
    expect(autoFillText({ source: "web", at: "2026-10-23T10:00:00Z" })).toContain("Web de la empresa");
    expect(autoFillText({ source: "web", at: "nope" })).toBe("Web de la empresa");
  });
});
