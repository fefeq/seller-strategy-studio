import { describe, expect, it } from "vitest";
import { icpCompanyQuery, icpForSegment, icpPeopleQuery, icpReadiness, icpSizeText, parseIcpStructure } from "./icp";

describe("icp", () => {
  it("structured fields win over prose in the company query", () => {
    const r = icpCompanyQuery({ industries: "agencias", geography: "España", company_size: "10-50", search_keywords: ["marketing agency"], countries: ["es", "mx", "xxx"], min_employees: 200, max_employees: 51 });
    expect(r.structured).toBe(true);
    expect(r.query).toMatchObject({ keywords: ["marketing agency"], countries: ["ES", "MX"], minEmployees: 51, maxEmployees: 200 });
  });
  it("falls back to the prose fields when nothing is structured", () => {
    const r = icpCompanyQuery({ industries: "fintech, logística", company_size: "50-500", geography: null });
    expect(r.structured).toBe(false);
    expect(r.query.minEmployees).toBe(50);
    expect(r.query.maxEmployees).toBe(500);
  });
  it("uses the ICP of the account's segment, else the first", () => {
    const icps = [{ id: "a", segment_id: "s1" }, { id: "b", segment_id: "s2" }];
    expect(icpForSegment(icps, "s2")?.id).toBe("b");
    expect(icpForSegment(icps, null)?.id).toBe("a");
    expect(icpForSegment([], "s1")).toBeNull();
  });
  it("people query keeps known levels only and defaults when empty", () => {
    expect(icpPeopleQuery({ target_titles: ["VP Sales", " "], seniorities: ["vp", "intern"] })).toEqual({ titles: ["VP Sales"], levels: ["vp"] });
    expect(icpPeopleQuery({})).toEqual({ titles: undefined, levels: undefined });
  });
  it("size text prefers the structured range", () => {
    expect(icpSizeText({ min_employees: 51, max_employees: 200, company_size: "pymes" })).toBe("51–200 empleados");
    expect(icpSizeText({ company_size: "pymes" })).toBe("pymes");
  });
  it("readiness names what each flow is missing", () => {
    const r = icpReadiness({ search_keywords: ["saas"], countries: ["ES"] });
    expect(r.find((c) => c.id === "search")?.missing).toBe("rango de empleados");
    expect(r.find((c) => c.id === "people")?.ready).toBe(false);
  });
  it("parses the AI structure and drops invalid values", () => {
    expect(parseIcpStructure(JSON.stringify({ search_keywords: ["saas"], countries: ["es", "Spain"], min_employees: -3, max_employees: 200, target_titles: ["CRO"], seniorities: ["vp", "boss"], pains: "x" })))
      .toEqual({ search_keywords: ["saas"], countries: ["ES"], min_employees: null, max_employees: 200, target_titles: ["CRO"], seniorities: ["vp"], pains: "x" });
    expect(parseIcpStructure("nope")).toEqual({});
  });
});
