import { describe, expect, it } from "vitest";
import { icpCompanyQuery, icpForSegment, icpPeopleQuery, icpReadiness, icpSaveSources, icpSizeText, parseIcpStructure } from "./icp";

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

type Marks = Record<string, { kind?: string; confirmed?: boolean; confirmedBy?: string }>;

describe("icpSaveSources (NK-0024)", () => {
  const at = "2026-10-31T10:00:00.000Z";
  const saved = { countries: [], min_employees: null, max_employees: null, geography: "", company_size: "" };
  const next = { countries: ["ES", "MX"], min_employees: 51, max_employees: 200, geography: "", company_size: "" };

  it("keeps AI origin, not confirmed, for values equal to the proposal", () => {
    const r = icpSaveSources({}, saved, next, { countries: ["ES", "MX"], min_employees: 51, max_employees: 200 }, "u1", at) as Marks;
    for (const f of ["countries", "min_employees", "max_employees"]) expect(r[f]).toMatchObject({ kind: "ia", confirmed: false });
  });
  it("marks an edited or unproposed value as persona and confirmed by the person", () => {
    const r = icpSaveSources({}, saved, next, { countries: ["ES", "MX"], min_employees: 40 }, "u1", at) as Marks;
    expect(r.countries).toMatchObject({ kind: "ia", confirmed: false });
    expect(r.min_employees).toMatchObject({ kind: "persona", confirmed: true, confirmedBy: "u1" });
    expect(r.max_employees).toMatchObject({ kind: "persona", confirmed: true });
  });
  it("leaves unchanged fields and unreadable entries alone, and drops the mark of an emptied value", () => {
    const prev = { countries: { source: "persona", at, kind: "persona", confirmed: true }, odd: "x" };
    const r = icpSaveSources(prev, { ...saved, countries: ["ES"], max_employees: 9 }, { ...saved, countries: ["ES"], max_employees: null }, {}, "u1", at) as Marks;
    expect(r.countries).toEqual(prev.countries);
    expect(r.odd).toBe("x");
    expect(r.max_employees).toBeUndefined();
  });
  it("returns null when no tracked field changed", () => {
    expect(icpSaveSources({}, saved, { ...saved, pains: "x" }, { countries: ["ES"] }, "u1", at)).toBeNull();
  });
});
