import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BINDINGS, CONCEPTS, placesOf, SHOWN_IN } from "./field-catalog";
import { BASELINE, BASELINE_MAX } from "./field-baseline";
import { columnsFromTypes, conceptCandidates, coverage, explain } from "./field-coverage";

const root = path.resolve(__dirname, "../..");
const real = () => columnsFromTypes(readFileSync(path.join(root, "src/integrations/supabase/types.ts"), "utf8"));

const fake = (rows: string) => columnsFromTypes(`      t: {\n        Row: {\n${rows}\n        }\n      }`);

describe("field coverage", () => {
  it("CA-10: every column of the generated types is catalogued or in the baseline", () => {
    const cov = coverage(real(), BINDINGS, BASELINE);
    expect(cov.uncatalogued.map(explain)).toEqual([]);
  });

  it("CA-10: a new column in neither fails and names the concept to assign", () => {
    const cols = fake("          id: string\n          size_band: string | null\n          country_code: string");
    const cov = coverage(cols, [], { t: ["id"] });
    expect(cov.uncatalogued.map((u) => u.column).sort()).toEqual(["country_code", "size_band"]);
    const country = cov.uncatalogued.find((u) => u.column === "country_code")!;
    expect(country.candidates).toContain("pais");
    expect(explain(country)).toContain("t.country_code no está en el catálogo");
    expect(explain(country)).toContain("pais");
  });

  it("CA-10: a column that matches no concept says a new concept may be needed", () => {
    const cov = coverage(fake("          nickname: string"), [], {});
    expect(cov.uncatalogued[0]!.candidates).toEqual([]);
    expect(explain(cov.uncatalogued[0]!)).toContain("crea uno en CONCEPTS");
  });

  it("CA-10: the baseline only shrinks and holds nothing stale", () => {
    const cov = coverage(real(), BINDINGS, BASELINE);
    expect(cov.staleBaseline).toEqual([]);
    expect(cov.missingBindings).toEqual([]);
    const size = Object.values(BASELINE).reduce((n, cs) => n + cs.length, 0);
    expect(size).toBeLessThanOrEqual(BASELINE_MAX);
  });

  it("a column that is catalogued and also in the baseline is reported as stale", () => {
    const cov = coverage(fake("          country: string"), [{ table: "t", column: "country" }], { t: ["country", "gone"] });
    expect(cov.staleBaseline).toEqual([{ table: "t", column: "country", reason: "catalogued" }, { table: "t", column: "gone", reason: "missing" }]);
  });

  it("§8: free-form jsonb columns are listed as pending and never fail", () => {
    const cov = coverage(fake("          id: string\n          detail: Json\n          meta: Json | null"), [], { t: ["id"] });
    expect(cov.uncatalogued).toEqual([]);
    expect(cov.pendingJson).toEqual([{ table: "t", column: "detail" }, { table: "t", column: "meta" }]);
    expect(coverage(real(), BINDINGS, BASELINE).pendingJson.length).toBeGreaterThan(30);
  });

  it("CA-11: any concept lists where it is stored and where it is shown", () => {
    const pais = placesOf("pais");
    expect(pais.stored.map((b) => `${b.table}.${b.column}`)).toEqual(["accounts.country", "account_assignment_rules.country"]);
    expect(pais.shown).toContain("src/components/country-pick.tsx");
    expect(placesOf("importe").stored.length).toBe(BINDINGS.filter((b) => b.concept === "importe").length);
  });

  it("CA-11: every concept has places and every place named exists", () => {
    for (const c of CONCEPTS) {
      const p = placesOf(c.id);
      expect(p.stored.length, c.id).toBeGreaterThan(0);
      expect(p.shown.length, c.id).toBeGreaterThan(0);
    }
    for (const files of Object.values(SHOWN_IN)) for (const f of files) expect(existsSync(path.join(root, f)), f).toBe(true);
  });

  it("name hints cover the four first concepts and periodo", () => {
    expect(conceptCandidates("company_size")).toContain("tamano_empleados");
    expect(conceptCandidates("plan_revenue")).toEqual(["importe"]);
    expect(conceptCandidates("lead_source")).toContain("canal_de_entrada");
    expect(conceptCandidates("period")).toEqual(["periodo"]);
  });

  it("the change log is infrastructure: its columns are not concepts, and it must exist in the types", () => {
    expect(real().has("field_edit_log")).toBe(true);
    const cov = coverage(real(), BINDINGS, BASELINE);
    expect(cov.uncatalogued.some((u) => u.table === "field_edit_log")).toBe(false);
  });
});

