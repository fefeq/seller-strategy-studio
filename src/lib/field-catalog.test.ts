import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGIONS } from "./assignment";
import {
  allowedValues,
  BINDINGS,
  bindingOf,
  CONCEPTS,
  conceptById,
  PERSISTENCE_LABEL,
  type ConceptId,
} from "./field-catalog";
import { SOURCES } from "./roles";

// Columns of every table as the generated types declare them.
function columnsByTable(): Map<string, Set<string>> {
  const text = readFileSync(path.resolve(__dirname, "../integrations/supabase/types.ts"), "utf8");
  const out = new Map<string, Set<string>>();
  for (const m of text.matchAll(/^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm)) {
    out.set(m[1]!, new Set([...m[2]!.matchAll(/^ {10}(\w+)\??:/gm)].map((c) => c[1]!)));
  }
  return out;
}

describe("field catalog", () => {
  it("CA-1: every concept is defined once and used by at least one place", () => {
    const ids = CONCEPTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids)
      expect(
        BINDINGS.some((b) => b.concept === id),
        id,
      ).toBe(true);
  });

  it("CA-1: the first concepts decided by Fede are all there", () => {
    const need: ConceptId[] = [
      "origen_valor",
      "canal_de_entrada",
      "creado_por",
      "fuente_citada",
      "pais",
      "paises",
      "region",
      "geografia_texto",
      "tamano_empleados",
      "tamano_descripcion",
      "importe",
    ];
    for (const id of need) expect(conceptById(id).id).toBe(id);
  });

  it("CA-1: a place belongs to one concept only and its concept exists", () => {
    const seen = new Set<string>();
    for (const b of BINDINGS) {
      const key = `${b.table}.${b.column}`;
      expect(seen.has(key), `${key} repeated`).toBe(false);
      seen.add(key);
      expect(
        CONCEPTS.some((c) => c.id === b.concept),
        key,
      ).toBe(true);
    }
  });

  it("CA-4: every place declares a persistence class", () => {
    for (const b of BINDINGS)
      expect(Object.keys(PERSISTENCE_LABEL), `${b.table}.${b.column}`).toContain(b.persistence);
  });

  it("every catalogued place is a real column of the generated types", () => {
    const cols = columnsByTable();
    expect(cols.size).toBeGreaterThan(50);
    for (const b of BINDINGS)
      expect(cols.get(b.table)?.has(b.column), `${b.table}.${b.column}`).toBe(true);
  });

  it("an importe declares what it measures; nothing else does", () => {
    for (const b of BINDINGS) {
      if (b.concept === "importe") {
        expect(b.nature, `${b.table}.${b.column} nature`).toBeDefined();
        expect(b.span, `${b.table}.${b.column} span`).toBeDefined();
      } else {
        expect(b.nature).toBeUndefined();
        expect(b.span).toBeUndefined();
      }
    }
  });

  it("an unknown periodicity is written down as pending, never guessed", () => {
    for (const b of BINDINGS.filter((x) => x.span === "sin_dato"))
      expect(b.verify, `${b.table}.${b.column}`).toBeTruthy();
  });

  it("closed values per table only name tables that use the concept", () => {
    for (const c of CONCEPTS.filter((x) => x.allowedBy)) {
      const tables = new Set(BINDINGS.filter((b) => b.concept === c.id).map((b) => b.table));
      expect([...tables].sort(), c.id).toEqual(Object.keys(c.allowedBy!).sort());
    }
  });

  it("reuses the values the code already defines", () => {
    expect(allowedValues("account_assignment_rules", "region")).toEqual(Object.keys(REGIONS));
    expect(allowedValues("people", "source")).toEqual(Object.keys(SOURCES));
    expect(allowedValues("deals", "source")).toEqual([
      "outbound",
      "inbound",
      "partner",
      "plg",
      "event",
      "referral",
    ]);
    expect(allowedValues("accounts", "country")?.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
  });

  it("a deal and a person keep their own channel values (no mapping between them)", () => {
    expect(allowedValues("deals", "source")).not.toEqual(allowedValues("people", "source"));
    expect(allowedValues("leads", "source")).toBeNull();
  });

  it("a place that is not catalogued is not found", () => {
    expect(bindingOf("accounts", "notes")).toBeNull();
    expect(allowedValues("accounts", "notes")).toBeNull();
  });
});
