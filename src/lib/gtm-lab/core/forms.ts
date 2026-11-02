// From gtm-lab@44f385b packages/core/src/forms.ts
import type { Framework } from "./framework";
import { toolFor, validateToolData } from "./tools";

export type ScalarFieldType = "text" | "long_text" | "select";

export interface ScalarField {
  id: string;
  type: ScalarFieldType;
  label: string;
  help?: string;
  required?: boolean;
  options?: string[];
}

export interface ListField {
  id: string;
  type: "list";
  label: string;
  help?: string;
  required?: boolean;
  min?: number;
  max?: number;
  fields: ScalarField[];
}

export type Field = ScalarField | ListField;
export type FormSpec = Field[];

export type ListItem = Record<string, string>;
export type DeliverableData = Record<string, string | ListItem[]>;

export interface FieldError {
  field: string;
  label: string;
  message: string;
}

export const MAX_LENGTH: Record<ScalarFieldType, number> = { text: 200, long_text: 4000, select: 200 };
/** Same limit as the database check on project_deliverables.data (bytes of the JSON text). */
export const MAX_DATA_BYTES = 65536;
const SCALAR_TYPES = new Set<string>(["text", "long_text", "select"]);

/** Checks the `forms` section of a framework; returns a message naming the id at fault, or null. */
export function formsProblem(forms: Record<string, unknown>, deliverables: Map<string, { tool?: string }>): string | null {
  for (const [deliverable, spec] of Object.entries(forms)) {
    const owner = deliverables.get(deliverable);
    if (!owner) return `Formulario para "${deliverable}", que no es ningún entregable`;
    if (owner.tool) return `"${deliverable}" usa una herramienta y no lleva formulario en la v1`;
    if (!Array.isArray(spec) || spec.length === 0) return `El formulario de "${deliverable}" no tiene campos`;
    const problem = fieldsProblem(spec, true);
    if (problem) return `${problem} (formulario "${deliverable}")`;
  }
  return null;
}

function fieldsProblem(fields: unknown[], allowList: boolean): string | null {
  const seen = new Set<string>();
  for (const raw of fields) {
    const field = raw as { id?: unknown; label?: unknown; type?: unknown; min?: number; max?: number; fields?: unknown; options?: unknown };
    const id = typeof field.id === "string" ? field.id : "";
    if (!id || typeof field.label !== "string" || !field.label) return `Campo sin id o sin label: "${id}"`;
    if (seen.has(id)) return `"${id}": campo duplicado`;
    seen.add(id);

    if (field.type === "list") {
      if (!allowList) return `"${id}": una lista no puede contener otra lista (tipo no válido)`;
      const min = field.min ?? 0;
      if (field.max !== undefined && min > field.max) return `"${id}": min (${min}) es mayor que max (${field.max})`;
      if (!Array.isArray(field.fields) || field.fields.length === 0) return `"${id}": la lista no tiene subcampos`;
      const problem = fieldsProblem(field.fields, false);
      if (problem) return `${problem} (lista "${id}")`;
    } else if (!SCALAR_TYPES.has(String(field.type))) {
      return `"${id}": tipo de campo desconocido "${String(field.type)}"`;
    } else if (field.type === "select" && (!Array.isArray(field.options) || field.options.length === 0)) {
      return `"${id}": un select necesita opciones`;
    }
  }
  return null;
}

/** The form of a deliverable: the profile's questions, a declared form, or undefined (tool steps). */
export function formFor(framework: Framework, deliverableId: string): FormSpec | undefined {
  if (deliverableId === framework.profile.id) {
    return framework.profile.questions.map((q) => ({ id: q.id, type: "long_text", label: q.label, required: true }));
  }
  return framework.forms[deliverableId] as FormSpec | undefined;
}

function knownOrThrow(framework: Framework, deliverableId: string): FormSpec {
  const isStep = framework.phases.some((p) => p.steps.some((s) => s.deliverable === deliverableId));
  if (deliverableId !== framework.profile.id && !isStep) {
    throw new Error(`"${deliverableId}" no es un entregable de la metodología`);
  }
  return formFor(framework, deliverableId) ?? [];
}

const blank = (value: unknown) => typeof value !== "string" || value.trim() === "";

function scalarErrors(field: ScalarField, value: unknown, label: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string") return `${label}: debe ser texto`;
  if (value.length > MAX_LENGTH[field.type]) return `${label}: máximo ${MAX_LENGTH[field.type]} caracteres`;
  if (field.type === "select" && value !== "" && !field.options?.includes(value)) return `${label}: opción no válida`;
  return null;
}

/**
 * Validates answers for a deliverable. `draft` allows missing answers but not unknown fields or wrong types;
 * `done` also requires required fields and list minimums. Returns [] when valid.
 */
export function validateDeliverable(
  framework: Framework,
  deliverableId: string,
  data: Record<string, unknown>,
  mode: "draft" | "done",
): FieldError[] {
  const form = knownOrThrow(framework, deliverableId);
  if (toolFor(framework, deliverableId)) return validateToolData(framework, deliverableId, data, mode);
  const errors: FieldError[] = [];
  const add = (field: string, label: string, message: string) => errors.push({ field, label, message });
  const byId = new Map(form.map((f) => [f.id, f]));

  for (const key of Object.keys(data)) {
    if (!byId.has(key)) add(key, key, `Campo desconocido: "${key}"`);
  }

  for (const field of form) {
    const value = data[field.id];
    if (field.type !== "list") {
      const problem = scalarErrors(field, value, field.label);
      if (problem) add(field.id, field.label, problem);
      else if (mode === "done" && field.required && blank(value)) add(field.id, field.label, "Obligatorio");
      continue;
    }

    if (value === undefined) {
      if (mode === "done" && (field.required || (field.min ?? 0) > 0)) add(field.id, field.label, "Obligatorio");
      continue;
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== "object" || item === null || Array.isArray(item))) {
      add(field.id, field.label, `${field.label}: debe ser una lista`);
      continue;
    }
    if (field.max !== undefined && value.length > field.max) {
      add(field.id, field.label, `${field.label}: máximo ${field.max} elementos`);
      continue;
    }
    const min = Math.max(field.min ?? 0, field.required ? 1 : 0);
    if (mode === "done" && value.length < min) {
      add(field.id, field.label, min === 1 ? "Obligatorio" : `Mínimo ${min} elementos`);
      continue;
    }

    const subById = new Map(field.fields.map((f) => [f.id, f]));
    const itemErrors = new Map<string, string>();
    for (const item of value as Record<string, unknown>[]) {
      for (const key of Object.keys(item)) {
        if (!subById.has(key)) itemErrors.set(field.label, `${field.label}: subcampo desconocido "${key}"`);
      }
      for (const sub of field.fields) {
        const label = `${field.label} › ${sub.label}`;
        const problem = scalarErrors(sub, item[sub.id], label);
        if (problem) itemErrors.set(label, problem);
        else if (mode === "done" && sub.required && blank(item[sub.id])) itemErrors.set(label, "Obligatorio");
      }
    }
    for (const [label, message] of itemErrors) add(field.id, label, message);
  }
  if (new TextEncoder().encode(JSON.stringify(data)).length > MAX_DATA_BYTES) {
    add("", "Tamaño total", "Tus respuestas superan el tamaño máximo (64 KB). Acorta algún texto largo y vuelve a guardar.");
  }
  return errors;
}

/** Drops answers whose field no longer exists in the form (e.g. after a methodology change). */
export function pruneDeliverable(
  framework: Framework,
  deliverableId: string,
  data: Record<string, unknown>,
): { data: Record<string, unknown>; dropped: string[] } {
  const form = knownOrThrow(framework, deliverableId);
  const byId = new Map(form.map((f) => [f.id, f]));
  const dropped: string[] = [];
  const kept: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const field = byId.get(key);
    if (!field) {
      dropped.push(key);
      continue;
    }
    if (field.type === "list" && Array.isArray(value)) {
      const subIds = new Set(field.fields.map((f) => f.id));
      kept[key] = value.map((item) => {
        if (typeof item !== "object" || item === null) return item;
        const clean: Record<string, unknown> = {};
        for (const [subKey, subValue] of Object.entries(item as Record<string, unknown>)) {
          if (subIds.has(subKey)) clean[subKey] = subValue;
          else if (!dropped.includes(`${key}.${subKey}`)) dropped.push(`${key}.${subKey}`);
        }
        return clean;
      });
    } else {
      kept[key] = value;
    }
  }
  return { data: kept, dropped };
}
