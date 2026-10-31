import { describe, expect, it } from "vitest";
import { BINDINGS } from "./field-catalog";
import { normalizeAmount, normalizeCountries, normalizeCountry, normalizeForSave, normalizeSize, parseEmployees } from "./field-normalize";

const ok = <T>(n: { status: string; value?: T }) => (n.status === "ok" ? n.value : n.status);

describe("field normalization", () => {
  it("CA-3: country written four ways saves as one ISO code", () => {
    for (const v of ["ES", " es ", "España", "Spain"]) expect(ok(normalizeCountry(v)), v).toBe("ES");
    expect(ok(normalizeCountry("Estados Unidos"))).toBe("US");
  });

  it("CA-3: a country list drops repeats and returns what it does not know apart", () => {
    expect(normalizeCountries("España, spain; Francia")).toEqual({ value: ["ES", "FR"], unnormalized: [] });
    expect(normalizeCountries(["ES", "Atlantis"])).toEqual({ value: ["ES"], unnormalized: ["Atlantis"] });
  });

  it("a country that does not fit is kept as the original, never turned into a code", () => {
    expect(normalizeCountry("Atlantis")).toMatchObject({ status: "unnormalized", original: "Atlantis" });
    expect(normalizeCountry("  ")).toEqual({ status: "empty" });
  });

  it("CA-3: company size from Apollo, Clay and a person lands on one text", () => {
    expect(ok(normalizeSize("123 empleados"))).toBe("123 empleados");
    expect(ok(normalizeSize("51-200 empleados"))).toBe("51–200 empleados");
    expect(ok(normalizeSize("51 a 200"))).toBe("51–200 empleados");
    expect(ok(normalizeSize("Empleados: 200"))).toBe("200 empleados");
    expect(ok(normalizeSize("1.000-5.000 employees"))).toBe("1000–5000 empleados");
  });

  it("size understands open ranges and is idempotent", () => {
    expect(parseEmployees("más de 500 empleados")).toEqual({ min: 500, max: null });
    expect(parseEmployees("hasta 50 empleados")).toEqual({ min: null, max: 50 });
    expect(parseEmployees("500+")).toEqual({ min: 500, max: null });
    const once = ok(normalizeSize("51-200"));
    expect(ok(normalizeSize(once as string))).toBe(once);
  });

  it("size refuses what is not a headcount", () => {
    for (const v of ["scale-up", "2.000 EUR", "facturación 5M", "fundada en 2015 por tres socios", "10 a 20 a 30", "0"]) expect(parseEmployees(v), v).toBeNull();
    expect(normalizeSize("scale-up")).toMatchObject({ status: "unnormalized", original: "scale-up" });
  });

  it("CA-3: an amount typed with Spanish, English or plain format is the same number", () => {
    for (const v of ["1.234,56", "1,234.56", "1234.56", "€ 1.234,56", "1 234,56", 1234.56]) expect(ok(normalizeAmount(v)), String(v)).toBe(1234.56);
  });

  it("one separator followed by three digits is thousands, otherwise decimals", () => {
    expect(ok(normalizeAmount("1.234"))).toBe(1234);
    expect(ok(normalizeAmount("12,5"))).toBe(12.5);
    expect(ok(normalizeAmount("0,500"))).toBe(0.5);
    expect(ok(normalizeAmount("1.234.567"))).toBe(1234567);
    expect(ok(normalizeAmount("10.2.3"))).toBe("unnormalized");
  });

  it("an amount keeps two decimals at most and refuses non-numbers and negatives", () => {
    expect(ok(normalizeAmount(10.005))).toBe(10.01);
    expect(normalizeAmount("abc")).toMatchObject({ status: "unnormalized" });
    expect(normalizeAmount(Number.NaN)).toMatchObject({ status: "unnormalized" });
    expect(normalizeAmount("-5")).toMatchObject({ status: "unnormalized", reason: "El importe no puede ser negativo." });
    expect(ok(normalizeAmount("-5", { allowNegative: true }))).toBe(-5);
    expect(normalizeAmount("")).toEqual({ status: "empty" });
    expect(normalizeAmount(null)).toEqual({ status: "empty" });
  });

  it("CA-1: saving goes through the catalog, so every catalogued column has a rule", () => {
    expect(normalizeForSave("accounts", "country", "España")).toEqual({ status: "ok", value: "ES" });
    expect(normalizeForSave("account_assignment_rules", "country", "Mexico")).toEqual({ status: "ok", value: "MX" });
    expect(normalizeForSave("icp_profiles", "countries", "ES, Francia")).toEqual({ status: "ok", value: ["ES", "FR"] });
    expect(normalizeForSave("accounts", "size", "51-200")).toEqual({ status: "ok", value: "51–200 empleados" });
    expect(normalizeForSave("icp_profiles", "min_employees", "50")).toEqual({ status: "ok", value: 50 });
    expect(normalizeForSave("icp_profiles", "min_employees", "50,5")).toMatchObject({ status: "unnormalized" });
    expect(normalizeForSave("deals", "amount", "1.200,50")).toEqual({ status: "ok", value: 1200.5 });
    expect(normalizeForSave("people", "source", "cold_list")).toEqual({ status: "ok", value: "cold_list" });
    expect(normalizeForSave("people", "source", "outbound")).toMatchObject({ status: "unnormalized" });
    for (const b of BINDINGS) expect(normalizeForSave(b.table, b.column, null).status, `${b.table}.${b.column}`).not.toBe("uncatalogued");
  });

  it("an unnormalized free text stays as written; an uncatalogued column passes through", () => {
    expect(normalizeForSave("accounts", "size", " scale-up ")).toMatchObject({ status: "unnormalized", value: "scale-up", original: "scale-up" });
    expect(normalizeForSave("accounts", "notes", "x")).toEqual({ status: "uncatalogued", value: "x" });
    expect(normalizeForSave("leads", "source", " CSV ")).toEqual({ status: "ok", value: "CSV" });
  });
});
