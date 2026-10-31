// Executing an accepted strategic suggestion (SDD-20261027 strategic-suggestions-engine, F3 · H-5). Pure: what a change may
// write, who may confirm it, when it waits for a person, how it is undone, and the drafts of a task or an experiment.
// Nothing here talks to the database (strategy-execute-core.ts does) and nothing calls a model.
import { originOf, readSources, type FieldSources } from "@/lib/provenance";
import { POSITIONING_FIELDS } from "@/lib/setup-schema";

export const SOURCE = "strategic_review";
export const SOURCE_NAME = "Revisión estratégica";
export const UNDO_HOURS = 24;
const HOUR = 3_600_000,
  DAY = 86_400_000;

export type ChangeTable = "icp_profiles" | "segments" | "positioning" | "products";
export type Value = string | number | boolean | string[] | null;
export type ChangePayload = {
  table: ChangeTable;
  op: "create" | "update";
  id?: string;
  values: Record<string, Value>;
};

/** The only fields a proposal may write: nothing outside this list is ever sent to the database. */
export const WRITABLE: Record<ChangeTable, readonly string[]> = {
  icp_profiles: [
    "name",
    "industries",
    "company_size",
    "geography",
    "countries",
    "why_fit",
    "anti_icp",
  ],
  segments: [
    "name",
    "acv_min",
    "acv_max",
    "win_rate_target",
    "cac_target",
    "payback_months",
    "notes",
  ],
  positioning: POSITIONING_FIELDS.map(([k]) => k),
  products: ["name", "description", "price", "active"],
};
/** Tables whose rows keep field_sources (who wrote each value). Products do not: its values are read as unmarked. */
export const HAS_SOURCES: Record<ChangeTable, boolean> = {
  icp_profiles: true,
  segments: true,
  positioning: true,
  products: false,
};
export const TABLE_ELEMENT: Record<
  ChangeTable,
  "icp" | "segment" | "positioning" | "product_price"
> = {
  icp_profiles: "icp",
  segments: "segment",
  positioning: "positioning",
  products: "product_price",
};

export function parseChange(v: unknown): ChangePayload | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const table = c.table as ChangeTable;
  if (!(table in WRITABLE) || (c.op !== "create" && c.op !== "update")) return null;
  if (c.op === "update" && (typeof c.id !== "string" || !c.id)) return null;
  if (!c.values || typeof c.values !== "object" || Array.isArray(c.values)) return null;
  const values: Record<string, Value> = {};
  for (const [k, x] of Object.entries(c.values as Record<string, unknown>)) {
    if (!WRITABLE[table].includes(k)) return null;
    if (!(
      x === null ||
      ["string", "number", "boolean"].includes(typeof x) ||
      (Array.isArray(x) && x.every((y) => typeof y === "string"))
    ))
      return null;
    values[k] = x as Value;
  }
  if (!Object.keys(values).length) return null;
  return { table, op: c.op, ...(c.op === "update" ? { id: c.id as string } : {}), values };
}

/** CA-38: who may confirm a change. Leaders change strategy; prices and the catalog also belong to deal desk (same as canPrice). */
export function canApplyChange(roles: readonly string[], table: ChangeTable | null): boolean {
  const leader = roles.some((r) => r === "owner" || r === "sales_leader");
  return table === "products" ? leader || roles.includes("deal_desk") : leader;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const empty = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

export type StoredChange = {
  op: "create" | "update" | "manual";
  target_table: ChangeTable | null;
  target_id: string | null;
  values: Record<string, Value>;
  base: Record<string, Value>;
  previous: { values: Record<string, Value>; sources: FieldSources } | null;
  status: string;
  applied_at: string | null;
  undo_until: string | null;
};
export type CurrentRow = { values: Record<string, Value>; field_sources?: unknown } | null;

/** What the field held when the proposal was made (CA-32: the current value is only read, never changed). */
export const baseOf = (p: ChangePayload, row: CurrentRow): Record<string, Value> =>
  Object.fromEntries(Object.keys(p.values).map((k) => [k, row?.values[k] ?? null]));

/** CA-34: a value a person wrote or confirmed is never replaced without an explicit confirmation of the replacement. */
export function personFields(table: ChangeTable, row: CurrentRow, fields: string[]): string[] {
  if (!row) return [];
  const marks = HAS_SOURCES[table] ? readSources(row.field_sources) : {};
  return fields.filter((f) => {
    if (empty(row.values[f])) return false;
    const o = originOf(marks[f]);
    // A filled value of a table with no marks, or with no mark, is not known to be automatic: treated as the person's.
    return !o || o.kind === "persona" || o.confirmed;
  });
}

export type ApplyPlan =
  | {
      ok: true;
      values: Record<string, Value>;
      field_sources?: FieldSources;
      previous: { values: Record<string, Value>; sources: FieldSources };
    }
  | {
      ok: false;
      code: "role" | "status" | "stale" | "needs_confirmation" | "manual";
      message: string;
      fields?: string[];
    };

/** CA-33: the write for a confirmed change, marked with the origin «Revisión estratégica», and what is needed to undo it. */
export function planApply(
  c: StoredChange,
  row: CurrentRow,
  roles: readonly string[],
  by: string,
  now: Date,
  overwrite = false,
): ApplyPlan {
  if (c.op === "manual")
    return {
      ok: false,
      code: "manual",
      message:
        "Esta propuesta no trae un valor que escribir: aplícala a mano y márcala como hecha.",
    };
  if (!canApplyChange(roles, c.target_table))
    return {
      ok: false,
      code: "role",
      message:
        "Tu rol puede ver la propuesta, pero no aplicarla. Pídeselo a quien gestione la estrategia.",
    };
  if (c.status !== "pending")
    return { ok: false, code: "status", message: "Esta propuesta ya no está pendiente." };
  const fields = Object.keys(c.values);
  if (c.op === "update") {
    if (!row)
      return {
        ok: false,
        code: "stale",
        message: "El registro ya no existe; descarta la propuesta.",
      };
    if (fields.some((f) => !same(row.values[f] ?? null, c.base[f] ?? null)))
      return {
        ok: false,
        code: "stale",
        message: "El valor cambió desde que se propuso. Revisa la propuesta antes de aplicarla.",
        fields: fields.filter((f) => !same(row.values[f] ?? null, c.base[f] ?? null)),
      };
    const theirs = personFields(
      c.target_table!,
      row,
      fields.filter((f) => !same(row.values[f], c.values[f])),
    );
    if (theirs.length && !overwrite)
      return {
        ok: false,
        code: "needs_confirmation",
        message:
          "Sustituiría un valor que escribió o confirmó una persona. Confirma la sustitución para aplicarlo.",
        fields: theirs,
      };
  }
  const at = now.toISOString();
  const prevSources = readSources(row?.field_sources);
  const marks: FieldSources = { ...prevSources };
  for (const f of fields)
    marks[f] = {
      source: SOURCE,
      kind: "fuente",
      at,
      confirmed: true,
      confirmedBy: by,
      confirmedAt: at,
    };
  return {
    ok: true,
    values: c.values,
    ...(HAS_SOURCES[c.target_table!] ? { field_sources: marks } : {}),
    previous: {
      values: Object.fromEntries(fields.map((f) => [f, row?.values[f] ?? null])),
      sources: Object.fromEntries(
        fields.filter((f) => prevSources[f]).map((f) => [f, prevSources[f]!]),
      ),
    },
  };
}

export const undoUntil = (now: Date) => new Date(now.getTime() + UNDO_HOURS * HOUR).toISOString();

export type UndoPlan =
  | { ok: true; values: Record<string, Value>; field_sources?: FieldSources; remove: boolean }
  | { ok: false; message: string };
/** CA-33: undo during 24 hours, only while the value is still the one the change wrote. */
export function planUndo(
  c: StoredChange,
  row: CurrentRow,
  roles: readonly string[],
  now: Date,
): UndoPlan {
  if (!canApplyChange(roles, c.target_table))
    return { ok: false, message: "Tu rol no puede deshacer este cambio." };
  if (c.status !== "applied" || !c.previous)
    return { ok: false, message: "Este cambio no está aplicado." };
  if (!c.undo_until || now.getTime() > new Date(c.undo_until).getTime())
    return {
      ok: false,
      message: "Ya pasaron 24 horas: el cambio no se puede deshacer desde aquí.",
    };
  if (!row) return { ok: false, message: "El registro ya no existe." };
  const fields = Object.keys(c.values);
  if (fields.some((f) => !same(row.values[f] ?? null, c.values[f] ?? null)))
    return {
      ok: false,
      message: "El valor se editó después del cambio; no lo deshago para no pisar esa edición.",
    };
  const marks = { ...readSources(row.field_sources) };
  for (const f of fields) {
    if (c.previous.sources[f]) marks[f] = c.previous.sources[f]!;
    else delete marks[f];
  }
  return {
    ok: true,
    remove: c.op === "create",
    values: c.previous.values,
    ...(HAS_SOURCES[c.target_table!] ? { field_sources: marks } : {}),
  };
}

// ---- Drafts (CA-35, CA-36): proposed, never saved until the person edits and confirms ----
type SugLike = {
  title: string;
  body: string | null;
  strategy: { evidence: { table: string; id: string }[] };
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const DEFAULT_REVIEW_DAYS = 14;
export const DEFAULT_TASK_DAYS = 3;

export type ExperimentDraft = {
  title: string;
  hypothesis: string;
  metric: string;
  review_on: string;
};
/** CA-35: hypothesis from the suggestion text; the metric stays empty when the rule did not bring one (never invented) and the form asks for it. */
export const experimentDraft = (s: SugLike, now: Date, metric = ""): ExperimentDraft => ({
  title: s.title.slice(0, 200),
  hypothesis: (s.body ?? "").slice(0, 500),
  metric,
  review_on: iso(new Date(now.getTime() + DEFAULT_REVIEW_DAYS * DAY)),
});
export const experimentDraftIssues = (d: ExperimentDraft) =>
  [
    !d.hypothesis.trim() && "la hipótesis",
    !d.metric.trim() && "la métrica",
    !d.review_on && "la fecha de revisión",
  ].filter(Boolean) as string[];

export type TaskDraft = {
  title: string;
  owner_id: string;
  due_date: string;
  deal_id: string | null;
};
/** CA-36: owner = the person accepting, date in a few days, the first cited deal when there is one. All editable. */
export const taskDraft = (s: SugLike, me: string, now: Date): TaskDraft => ({
  title: s.title.slice(0, 200),
  owner_id: me,
  due_date: iso(new Date(now.getTime() + DEFAULT_TASK_DAYS * DAY)),
  deal_id: s.strategy.evidence.find((e) => e.table === "deals")?.id ?? null,
});

// ---- Drafts that arrive from outside the form (NK-0041): checked before the decision is logged ----
const isText = (v: unknown): v is string => typeof v === "string";
/** A calendar date as the form sends it (AAAA-MM-DD); «2026-02-31» is refused. */
export const isIsoDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/**
 * Why a draft cannot be accepted, or null when it can: its shape (an object with text fields and real dates), that its kind is the
 * one the suggestion needs (experiment ↔ experiment, task ↔ task) and the rules of the form. Checks nothing that needs a query
 * (owner_id, deal_id exist): the database refuses those. The messages do not end in a full stop; the callers add one.
 */
export function executeIssue(needs: "experiment" | "task" | null, execute: unknown): string | null {
  if (!needs) return "Esta sugerencia no lleva formulario";
  const e = execute as { kind?: unknown; draft?: unknown } | null;
  if (!e || typeof e !== "object" || Array.isArray(e) || e.kind !== needs)
    return "El formulario no corresponde a esta sugerencia. Ábrela en Sugerencias y completa el formulario allí";
  const d = e.draft as Record<string, unknown> | null;
  if (!d || typeof d !== "object" || Array.isArray(d))
    return "El formulario llega vacío. Ábrela en Sugerencias y completa el formulario allí";
  const texts =
    needs === "experiment"
      ? ["title", "hypothesis", "metric", "review_on"]
      : ["title", "owner_id", "due_date"];
  if (
    texts.some((k) => !isText(d[k])) ||
    (needs === "task" && d.deal_id != null && !isText(d.deal_id))
  )
    return "Algún campo del formulario no es texto. Ábrela en Sugerencias y completa el formulario allí";
  const date = (needs === "experiment" ? d.review_on : d.due_date) as string;
  if (date !== "" && !isIsoDate(date))
    return "Hay una fecha que no es válida. Ábrela en Sugerencias y completa el formulario allí";
  if (needs === "experiment") {
    const issues = experimentDraftIssues(d as unknown as ExperimentDraft);
    return issues.length ? `Antes de aceptarla, completa ${issues.join(", ")}` : null;
  }
  return (d.title as string).trim() ? null : "Escribe el título de la tarea";
}
