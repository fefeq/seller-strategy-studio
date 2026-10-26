import { describe, expect, it } from "vitest";
import { accountColumnMapping, cleanDomain, planAccountImport } from "./account-import";

const csv = [
  {
    Empresa: "Agencia Norte",
    Web: "https://www.agencianorte.es/",
    Sector: "Agencia de marca personal",
    Empleados: "8",
    Tier: "a",
    Segmento: "Agencias",
  },
  {
    Empresa: "Agencia Norte",
    Web: "agencianorte.es",
    Sector: "",
    Empleados: "",
    Tier: "",
    Segmento: "",
  },
  { Empresa: "Ya Estaba", Web: "", Sector: "", Empleados: "", Tier: "Z", Segmento: "Otro" },
  { Empresa: "", Web: "nueva.io", Sector: "SaaS", Empleados: "40", Tier: "B", Segmento: "" },
  { Empresa: "", Web: "", Sector: "", Empleados: "", Tier: "", Segmento: "" },
];

describe("account import", () => {
  const mapping = accountColumnMapping(Object.keys(csv[0]));
  it("maps Spanish headers", () =>
    expect(mapping).toEqual({
      Empresa: "name",
      Web: "domain",
      Sector: "industry",
      Empleados: "size",
      Tier: "tier",
      Segmento: "segment",
    }));
  it("cleans domains", () => {
    expect(cleanDomain("https://www.Acme.com/es")).toBe("acme.com");
    expect(cleanDomain("no es un dominio")).toBeNull();
  });
  it("dedupes against the file and the existing accounts and says why each row was skipped", () => {
    const plan = planAccountImport(
      csv,
      mapping,
      [{ id: "s1", name: "Agencias" }],
      [{ name: "Ya estaba", domain: null }],
    );
    expect(plan.rows.map((r) => r.name)).toEqual(["Agencia Norte", "nueva.io"]);
    expect(plan.rows[0]).toMatchObject({
      domain: "agencianorte.es",
      tier: "A",
      segment_id: "s1",
      industry: "Agencia de marca personal",
      size: "8 empleados",
      is_target: true,
    });
    expect(plan.skipped).toEqual([
      { line: 3, name: "Agencia Norte", reason: "ya existe" },
      { line: 4, name: "Ya Estaba", reason: "ya existe" },
      { line: 6, name: "—", reason: "sin nombre ni dominio" },
    ]);
  });
});
