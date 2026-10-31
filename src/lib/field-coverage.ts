// Coherence check of the field catalog (SDD universal-field-definitions, U-4): every column of the generated
// types is either catalogued (field-catalog.ts) or listed in the baseline of columns still to catalogue
// (field-baseline.ts). A column in neither fails the check and says which concept to assign or create.
// Free-form jsonb columns never fail: they are listed as pending. Pure; the test reads types.ts.
import type { Binding, ConceptId } from "@/lib/field-catalog";

/** Tables that hold no user field: the change log records edits of other tables, and the strategy decision log records who decided what (their own columns are not concepts). */
export const INFRASTRUCTURE_TABLES: ReadonlySet<string> = new Set(["field_edit_log", "strategy_decisions", "strategy_changes", "strategy_links", "strategy_reviews"]);

export type ColumnType = "json" | "other";
export type Columns = Map<string, Map<string, ColumnType>>;

/** Tables and columns as the generated types declare them (the Row block of each table). */
export function columnsFromTypes(text: string): Columns {
  const out: Columns = new Map();
  for (const m of text.matchAll(/^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm)) {
    const cols = new Map<string, ColumnType>();
    for (const c of m[2]!.matchAll(/^ {10}(\w+)\??: (.+)$/gm))
      cols.set(c[1]!, /^Json\b/.test(c[2]!) ? "json" : "other");
    out.set(m[1]!, cols);
  }
  return out;
}

/** Name patterns that point a new column to a catalogued concept (or to a family that is not catalogued yet). */
const HINTS: { test: RegExp; concepts: (ConceptId | "periodo")[] }[] = [
  { test: /countr|geograph|region/i, concepts: ["pais", "paises", "region", "geografia_texto"] },
  { test: /size|employees|headcount/i, concepts: ["tamano_empleados", "tamano_descripcion"] },
  { test: /amount|revenue|price|cost|mrr|total|budget|quota/i, concepts: ["importe"] },
  {
    test: /source|origin|channel|created_by_app/i,
    concepts: ["origen_valor", "canal_de_entrada", "creado_por", "fuente_citada"],
  },
  { test: /period|quarter|year|week|month/i, concepts: ["periodo"] },
];

/** Concepts worth looking at for a column name; empty when nothing matches (then a new concept may be needed). */
export function conceptCandidates(column: string): (ConceptId | "periodo")[] {
  return [...new Set(HINTS.filter((h) => h.test.test(column)).flatMap((h) => h.concepts))];
}

export type Coverage = {
  /** In the types, in neither the catalog nor the baseline: the check fails on these. */
  uncatalogued: { table: string; column: string; candidates: (ConceptId | "periodo")[] }[];
  /** In the baseline but catalogued already, or no longer in the types: remove them from the baseline. */
  staleBaseline: { table: string; column: string; reason: "catalogued" | "missing" }[];
  /** Catalogued but no longer in the types. */
  missingBindings: { table: string; column: string }[];
  /** Free-form jsonb columns not catalogued: pending, never failing. */
  pendingJson: { table: string; column: string }[];
};

export function coverage(
  columns: Columns,
  bindings: Pick<Binding, "table" | "column">[],
  baseline: Record<string, readonly string[]>,
): Coverage {
  const catalogued = new Set(bindings.map((b) => `${b.table}.${b.column}`));
  const based = new Set(Object.entries(baseline).flatMap(([t, cs]) => cs.map((c) => `${t}.${c}`)));
  const out: Coverage = {
    uncatalogued: [],
    staleBaseline: [],
    missingBindings: [],
    pendingJson: [],
  };
  for (const [table, cols] of columns) {
    if (INFRASTRUCTURE_TABLES.has(table)) continue;
    for (const [column, type] of cols) {
      const key = `${table}.${column}`;
      if (catalogued.has(key)) continue;
      if (type === "json") out.pendingJson.push({ table, column });
      else if (!based.has(key))
        out.uncatalogued.push({ table, column, candidates: conceptCandidates(column) });
    }
  }
  for (const [table, cs] of Object.entries(baseline)) {
    for (const column of cs) {
      const key = `${table}.${column}`;
      if (catalogued.has(key)) out.staleBaseline.push({ table, column, reason: "catalogued" });
      else if (!columns.get(table)?.has(column))
        out.staleBaseline.push({ table, column, reason: "missing" });
    }
  }
  for (const b of bindings)
    if (!columns.get(b.table)?.has(b.column))
      out.missingBindings.push({ table: b.table, column: b.column });
  return out;
}

/** The sentence a failing check shows: which column, and which concept to assign or create. */
export function explain(u: Coverage["uncatalogued"][number]): string {
  const hint = u.candidates.length
    ? `Mira si es uno de estos conceptos: ${u.candidates.join(", ")}.`
    : "Ningún concepto encaja por el nombre: crea uno en CONCEPTS (src/lib/field-catalog.ts) o asígnale el que corresponda.";
  return `${u.table}.${u.column} no está en el catálogo. Añade su binding en src/lib/field-catalog.ts con concepto y clase de persistencia. ${hint}`;
}
