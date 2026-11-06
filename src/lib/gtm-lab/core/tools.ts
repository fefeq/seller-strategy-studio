// From gtm-lab@44f385b packages/core/src/tools.ts
import { allSteps, type Framework } from "./framework";
import type { FieldError } from "./forms";

export type Formula = "sum" | "risk";

export interface Criterion {
  id: string;
  label: string;
  help?: string;
}

export interface ToolSpec {
  formula: Formula;
  /** Rows come from a list field of a prerequisite deliverable, or are written by the founder (free). */
  /** `label` is the column title shown to people; `item` (list rows) is the subfield that names each row. */
  rows:
    | { from: string; list: string; item: string; label: string }
    | { free: true; label: string; min?: number; max?: number };
  criteria: Criterion[];
  help?: string;
}

export interface ToolRow {
  item: string;
  scores: Record<string, number>;
  note?: string;
}

export interface RankedRow extends ToolRow {
  /** Position in the original list. */
  index: number;
  /** null while any criterion is unscored. */
  total: number | null;
}

const FORMULAS = new Set<Formula>(["sum", "risk"]);
export const SCALE = { min: 1, max: 5 } as const;
const MAX_NOTE = 4000;
const MAX_ITEM = 4000;
/** Same limit as the database check on project_deliverables.data (bytes of the JSON text). */
const MAX_DATA_BYTES = 65536;

type Saved = ReadonlyMap<string, { status: string; data: Record<string, unknown> }>;

/** The tool behind a step's deliverable, if any. */
export function toolFor(
  framework: Framework,
  deliverableId: string,
): { id: string; spec: ToolSpec } | undefined {
  const step = allSteps(framework).find((s) => s.deliverable === deliverableId);
  const spec = step?.tool ? (framework.tools[step.tool] as ToolSpec | undefined) : undefined;
  return step?.tool && spec ? { id: step.tool, spec } : undefined;
}

/** Checks the `tools` section; returns a message naming the id at fault, or null. */
export function toolsProblem(framework: Framework): string | null {
  const steps = allSteps(framework);
  const tools = framework.tools as Record<
    string,
    { formula?: unknown; criteria?: Criterion[]; rows?: Record<string, unknown> }
  >;

  for (const step of steps) {
    // "ice" belongs to the cross-cutting experiment backlog (its own SDD), not to a step calculator.
    if (step.tool && step.tool !== "ice" && !tools[step.tool])
      return `Herramienta "${step.tool}" sin definición en tools`;
  }
  for (const [id, spec] of Object.entries(tools)) {
    const users = steps.filter((s) => s.tool === id);
    if (users.length === 0) return `Herramienta "${id}": ningún paso la usa`;
    if (!FORMULAS.has(spec.formula as Formula))
      return `Herramienta "${id}": fórmula desconocida "${String(spec.formula)}"`;

    const criteria = Array.isArray(spec.criteria) ? spec.criteria : [];
    if (criteria.length === 0) return `Herramienta "${id}": sin criterios`;
    const seen = new Set<string>();
    for (const c of criteria) {
      if (!c?.id || !c.label) return `Herramienta "${id}": criterio sin id o sin label`;
      if (seen.has(c.id)) return `"${c.id}": criterio duplicado en "${id}"`;
      seen.add(c.id);
    }
    if (spec.formula === "risk" && !(seen.has("importance") && seen.has("evidence"))) {
      return `Herramienta "${id}": la fórmula risk necesita los criterios importance y evidence`;
    }

    const rows: Record<string, unknown> = spec.rows ?? {};
    if (typeof rows.label !== "string" || !rows.label)
      return `Herramienta "${id}": rows necesita label`;
    if (rows.free) {
      const min = (rows.min as number | undefined) ?? 0;
      const max = rows.max as number | undefined;
      if (max !== undefined && min > max)
        return `Herramienta "${id}": min (${min}) es mayor que max (${max})`;
      continue;
    }
    const from = String(rows.from);
    for (const step of users) {
      if (!step.requires.includes(from))
        return `"${from}" no es un requisito del paso "${step.id}" que usa "${id}"`;
    }
    const field = (
      framework.forms[from] as { id: string; type: string; fields?: { id: string }[] }[] | undefined
    )?.find((f) => f.id === rows.list);
    if (!field || field.type !== "list")
      return `"${String(rows.list)}" no es un campo lista de "${from}"`;
    if (!field.fields?.some((f) => f.id === rows.item))
      return `"${String(rows.item)}" no es un subcampo de "${from}.${String(rows.list)}"`;
  }
  return null;
}

/** «Total: 14 de 20», «Riesgo: 25 de 25» or «Sin puntuar». Shared by the app and the AI context. */
export function formatToolTotal(spec: ToolSpec, total: number | null): string {
  if (total === null) return "Sin puntuar";
  const max = spec.formula === "risk" ? SCALE.max * SCALE.max : spec.criteria.length * SCALE.max;
  return `${spec.formula === "risk" ? "Riesgo" : "Total"}: ${total} de ${max}`;
}

function rowTotal(spec: ToolSpec, row: ToolRow): number | null {
  const values = spec.criteria.map((c) => row.scores[c.id]);
  if (values.some((v) => typeof v !== "number")) return null;
  if (spec.formula === "risk")
    return row.scores.importance! * (SCALE.max + 1 - row.scores.evidence!);
  return (values as number[]).reduce((a, b) => a + b, 0);
}

/** Total per row and ranking: high to low; ties by importance (risk) and then by list order; unscored last. */
export function scoreTool(spec: ToolSpec, rows: readonly ToolRow[]): RankedRow[] {
  return rows
    .map((row, index) => ({ ...row, index, total: rowTotal(spec, row) }))
    .sort((a, b) => {
      if (a.total === null || b.total === null)
        return a.total === null ? (b.total === null ? a.index - b.index : 1) : -1;
      if (b.total !== a.total) return b.total - a.total;
      if (spec.formula === "risk") {
        const byImportance = (b.scores.importance ?? 0) - (a.scores.importance ?? 0);
        if (byImportance) return byImportance;
      }
      return a.index - b.index;
    });
}

function sourceItems(spec: ToolSpec, saved: Saved): string[] {
  if (!("from" in spec.rows)) return [];
  const list = saved.get(spec.rows.from)?.data[spec.rows.list];
  const key = spec.rows.item;
  return Array.isArray(list)
    ? list.map((item) => String((item as Record<string, unknown>)[key] ?? "").trim())
    : [];
}

/**
 * Rows to show: for list-sourced tools, one per current source item (keeping scores of items that still exist,
 * matched by name and occurrence); for free tools, the saved rows. `changed` is true when saved rows were
 * dropped or new items appeared.
 */
export function toolRows(
  framework: Framework,
  deliverableId: string,
  saved: Saved,
  data: Record<string, unknown>,
): { rows: ToolRow[]; changed: boolean; duplicates: string[] } {
  const tool = toolFor(framework, deliverableId);
  if (!tool) throw new Error(`"${deliverableId}" no es una herramienta`);
  const savedRows = Array.isArray(data.rows) ? (data.rows as ToolRow[]) : [];
  if (!("from" in tool.spec.rows)) return { rows: savedRows, changed: false, duplicates: [] };

  const pool = new Map<string, ToolRow[]>();
  for (const row of savedRows) pool.set(row.item, [...(pool.get(row.item) ?? []), row]);
  let reused = 0;
  const items = sourceItems(tool.spec, saved);
  const duplicates = [...new Set(items.filter((item, i) => items.indexOf(item) !== i))];
  const rows = items.map((item) => {
    const match = pool.get(item)?.shift();
    if (match) reused++;
    return match ?? { item, scores: {} };
  });
  const changed =
    savedRows.length > 0 && (reused !== savedRows.length || rows.length !== savedRows.length);
  return { rows, changed, duplicates };
}

/** A done calculator whose source list changed since it was scored: its saved ranking is out of date. */
export function toolIsStale(framework: Framework, deliverableId: string, saved: Saved): boolean {
  const own = saved.get(deliverableId);
  return Boolean(own && toolRows(framework, deliverableId, saved, own.data).changed);
}

/** Validates a tool deliverable. `draft` allows missing scores; `done` requires every row fully scored. */
export function validateToolData(
  framework: Framework,
  deliverableId: string,
  data: Record<string, unknown>,
  mode: "draft" | "done",
): FieldError[] {
  const tool = toolFor(framework, deliverableId);
  if (!tool) throw new Error(`"${deliverableId}" no es una herramienta`);
  const { spec } = tool;
  const errors: FieldError[] = [];
  const add = (field: string, label: string, message: string) =>
    errors.push({ field, label, message });
  const criteria = new Map(spec.criteria.map((c) => [c.id, c]));
  const free = "free" in spec.rows;

  for (const key of Object.keys(data))
    if (key !== "rows") add(key, key, `Campo desconocido: "${key}"`);
  const rows = data.rows ?? [];
  if (!Array.isArray(rows)) {
    add("rows", spec.rows.label, "Debe ser una lista");
    return errors;
  }

  const max = free ? (spec.rows as { max?: number }).max : undefined;
  const min = free ? ((spec.rows as { min?: number }).min ?? 0) : 1;
  if (max !== undefined && rows.length > max) add("rows", spec.rows.label, `Máximo ${max} filas`);
  if (mode === "done" && rows.length < min) add("rows", spec.rows.label, `Mínimo ${min} filas`);

  rows.forEach((raw, i) => {
    const row = raw as Record<string, unknown>;
    const name =
      typeof row?.item === "string" && row.item.trim() ? row.item.trim() : `Fila ${i + 1}`;
    if (typeof row !== "object" || row === null || Array.isArray(row))
      return add("rows", name, "Fila no válida");
    for (const key of Object.keys(row)) {
      if (!["item", "scores", "note"].includes(key))
        add("rows", name, `Campo desconocido: "${key}"`);
    }
    if (typeof row.item !== "string" || row.item.length > MAX_ITEM)
      add("rows", name, "Texto no válido");
    else if (mode === "done" && free && !row.item.trim())
      add("rows", `${spec.rows.label} ${i + 1}`, "Obligatorio");
    if (row.note !== undefined && (typeof row.note !== "string" || row.note.length > MAX_NOTE))
      add("rows", name, "Nota no válida");

    if (
      row.scores !== undefined &&
      (row.scores === null || typeof row.scores !== "object" || Array.isArray(row.scores))
    ) {
      return add("rows", name, "Puntuaciones no válidas");
    }
    const scores = (row.scores ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(scores)) {
      const criterion = criteria.get(key);
      if (!criterion) add("rows", name, `Criterio desconocido: "${key}"`);
      else if (
        !Number.isInteger(value) ||
        (value as number) < SCALE.min ||
        (value as number) > SCALE.max
      ) {
        add(
          "rows",
          `${name} › ${criterion.label}`,
          `Debe ser un entero entre ${SCALE.min} y ${SCALE.max}`,
        );
      }
    }
    if (mode === "done") {
      for (const c of spec.criteria)
        if (scores[c.id] === undefined) add("rows", `${name} › ${c.label}`, "Sin puntuar");
    }
  });

  if (new TextEncoder().encode(JSON.stringify(data)).length > MAX_DATA_BYTES) {
    add(
      "",
      "Tamaño total",
      "Tus respuestas superan el tamaño máximo (64 KB). Acorta algún texto largo y vuelve a guardar.",
    );
  }
  return errors;
}
