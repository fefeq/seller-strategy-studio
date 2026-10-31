import { describe, expect, it } from "vitest";
import { clayErrorText, companyFilters, companyToAccount, employeesText, enrichChanges, enrichPatch, existingByDomain, existingStakeholder, icpToQuery, isoFromCountry, peopleFilters, personToStakeholder } from "./clay";

describe("clay filters", () => {
  it("builds company filters with English country names and an employee range", () => {
    expect(companyFilters({ keywords: ["payments", " "], countries: ["ES", "US"], minEmployees: 50, maxEmployees: 200, revenues: ["1M-5M", "bogus"] })).toEqual({
      description_keywords: ["payments"], country_names: ["Spain", "United States"], minimum_member_count: 50, maximum_member_count: 200, annual_revenues: ["1M-5M"],
    });
  });
  it("refuses an empty search so no allowance is spent on everything", () => {
    expect(() => companyFilters({ keywords: [] })).toThrow(/al menos un criterio/);
  });
  it("refuses a minimum above the maximum", () => {
    expect(() => companyFilters({ minEmployees: 500, maxEmployees: 50 })).toThrow(/mínimo/);
  });
  it("searches people by the account's clean domain and needs one", () => {
    expect(peopleFilters("https://www.Acme.com/about", { seniority: ["vp", "x"], titles: ["Sales"] })).toEqual({ company_identifier: ["acme.com"], job_title_keywords: ["Sales"], job_title_seniority_levels_v2: ["vp"] });
    expect(() => peopleFilters(null, {})).toThrow(/dominio/);
  });
});

describe("clay mapping", () => {
  it("maps a company to account fields", () => {
    const d = companyToAccount({ name: "PIX4D", domain: "www.pix4d.com", industry: "Software Development", size: "1,001-5,000 employees", country: "Spain", description: "x" });
    expect(d).toMatchObject({ name: "PIX4D", domain: "pix4d.com", industry: "Software Development", size: "1001-5000 empleados", country: "ES", description: "x" });
  });
  it("reads countries in English, Spanish or ISO", () => {
    expect(isoFromCountry("United States")).toBe("US");
    expect(isoFromCountry("México")).toBe("MX");
    expect(isoFromCountry("es")).toBe("ES");
    expect(isoFromCountry("Atlantis")).toBeNull();
  });
  it("NK-0035: UK and England aliases give GB, existing GB spellings stay", () => {
    for (const v of ["UK", "uk", "England", "england", "Great Britain", "Gran Bretaña", "Gran Bretana", "Inglaterra"]) expect(isoFromCountry(v), v).toBe("GB");
    for (const v of ["United Kingdom", "Reino Unido", "GB", "gb"]) expect(isoFromCountry(v), v).toBe("GB");
    expect(isoFromCountry("Atlantis")).toBeNull();
    expect(isoFromCountry("Scotland")).toBeNull();
  });
  it("keeps size numbers readable for the ICP rule", () => {
    expect(employeesText("51-200 employees")).toBe("51-200 empleados");
    expect(employeesText(null)).toBeNull();
  });
  it("maps a person to a stakeholder using the matched title", () => {
    expect(personToStakeholder({ name: "Jay Choi", url: "https://linkedin.com/in/jay", latest_experience_title: "CEO", matched_experience: { job_title: "Chief Executive" }, structured_location: { city: "Seattle", country: "United States" } }))
      .toEqual({ name: "Jay Choi", title: "Chief Executive", linkedin_url: "https://linkedin.com/in/jay", location: "Seattle, United States" });
  });
});

describe("clay dedupe", () => {
  it("flags companies already in Nokko by domain", () => {
    const has = existingByDomain([{ id: "a1", domain: "https://www.acme.com" }]);
    expect(has("acme.com")).toBe("a1");
    expect(has("other.com")).toBeNull();
  });
  it("flags stakeholders by LinkedIn, else by name", () => {
    const has = existingStakeholder([{ id: "s1", name: "Ana", linkedin_url: "https://www.linkedin.com/in/ana/" }, { id: "s2", name: "Luis Pérez", linkedin_url: null }]);
    expect(has({ name: "Otra", title: null, linkedin_url: "linkedin.com/in/ana", location: null })).toBe("s1");
    expect(has({ name: "luis pérez", title: null, linkedin_url: "linkedin.com/in/luis", location: null })).toBe("s2");
    expect(has({ name: "Ana", title: null, linkedin_url: "linkedin.com/in/ana-2", location: null })).toBeNull();
  });
});

describe("clay enrichment", () => {
  const draft = companyToAccount({ name: "Acme", domain: "acme.com", industry: "Fintech", size: "51-200 employees", country: "Spain", description: "Pagos" });
  it("pre-selects only empty fields and skips equal ones", () => {
    const ch = enrichChanges({ industry: "fintech", size: null, country: "MX", notes: null }, draft);
    expect(ch.map((c) => [c.field, c.empty])).toEqual([["size", true], ["country", false], ["notes", true]]);
    expect(enrichPatch(ch, ["size", "notes"])).toEqual({ size: "51-200 empleados", notes: "Pagos" });
  });
});

describe("clay ICP and errors", () => {
  it("turns an ICP into a first query", () => {
    expect(icpToQuery({ industries: "Fintech, logística y retail", company_size: "50-500 empleados", geography: "España, México" }))
      .toMatchObject({ keywords: ["Fintech", "logística", "retail"], countries: ["ES", "MX"], minEmployees: 50, maxEmployees: 500 });
    expect(icpToQuery({ industries: null, company_size: "más de 1.000", geography: null })).toMatchObject({ minEmployees: 1000, maxEmployees: null });
  });
  it("explains auth and rate errors in Spanish", () => {
    expect(clayErrorText(401, "bad key")).toMatch(/Conexiones/);
    expect(clayErrorText(429, "slow")).toMatch(/minuto/);
  });
});
