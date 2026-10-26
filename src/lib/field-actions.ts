// Common rules for editing, deleting, confirming and undoing (SDD field-actions-edit-delete-confirm, U-1).
// One matrix says which actions an element has and who can do them, so every screen and the agent read the same
// answer. Roles as decided by Fede: editing and confirming belong to any member, deleting to the Owner (what the
// row-level policies already enforce). Pure and tested.
import { readSources, type FieldSources } from "@/lib/provenance";

export type ElementKind = "company_field" | "icp" | "segment" | "positioning" | "pillar" | "onboarding_source" | "finding";
export type Action = "edit" | "delete" | "confirm" | "undo";

export const ACTION_LABEL: Record<Action, string> = { edit: "Editar", delete: "Borrar", confirm: "Confirmar", undo: "Deshacer" };

/** Who may do an action on an element: every member, only the Owner, or nobody (the action does not exist there). */
type Who = "members" | "owner" | "none";

const MATRIX: Record<ElementKind, Record<Action, Who>> = {
  company_field: { edit: "members", delete: "none", confirm: "members", undo: "members" },
  icp: { edit: "members", delete: "owner", confirm: "members", undo: "members" },
  segment: { edit: "members", delete: "owner", confirm: "members", undo: "members" },
  positioning: { edit: "members", delete: "none", confirm: "members", undo: "members" },
  pillar: { edit: "members", delete: "owner", confirm: "members", undo: "members" },
  onboarding_source: { edit: "none", delete: "members", confirm: "none", undo: "members" },
  finding: { edit: "members", delete: "members", confirm: "members", undo: "members" },
};

export type Availability = {
  /** The action exists for this element: show it. */
  available: boolean;
  /** The person's role may do it; when false and available, show it disabled with the reason. */
  allowed: boolean;
  reason: string | null;
};

/** CA-7: a role that may not do an action sees it disabled with the reason, never silently missing. */
export function canDo(kind: ElementKind, action: Action, roles: readonly string[]): Availability {
  const who = MATRIX[kind][action];
  if (who === "none") return { available: false, allowed: false, reason: null };
  if (who === "owner" && !roles.includes("owner")) {
    const why = action === "undo" ? "Solo el Owner puede deshacer un borrado." : "Solo el Owner puede borrar.";
    return { available: true, allowed: false, reason: why };
  }
  return { available: true, allowed: true, reason: null };
}

/** Undoing a delete is the Owner's, as deleting is; undoing an edit is anyone's who can edit. */
export function canUndo(kind: ElementKind, what: "edit" | "delete", roles: readonly string[]): Availability {
  const base = canDo(kind, what === "delete" ? "delete" : "edit", roles);
  return what === "delete" && base.available && !base.allowed ? { ...base, reason: "Solo el Owner puede deshacer un borrado." } : base;
}

/** The actions to show for an element, in the order the screens use. */
export function actionsFor(kind: ElementKind, roles: readonly string[]): (Availability & { action: Action })[] {
  return (["edit", "confirm", "delete", "undo"] as Action[]).map((action) => ({ action, ...canDo(kind, action, roles) })).filter((a) => a.available);
}

/** §8: a required field may not be saved empty. */
export function validateEdit(value: string | null | undefined, required: boolean): { ok: true } | { ok: false; reason: string } {
  if (required && !value?.trim()) return { ok: false, reason: "Este dato es obligatorio: escríbelo antes de guardar." };
  return { ok: true };
}

// ---- Unsaved changes (CA-3) ----

export type LeaveChoice = "save" | "discard" | "stay";

/** True when a draft differs from what is saved (values compared as written, lists in order). */
export function isDirty(saved: Record<string, unknown> | null | undefined, draft: Record<string, unknown> | null | undefined): boolean {
  if (!saved || !draft) return false;
  const keys = new Set([...Object.keys(saved), ...Object.keys(draft)]);
  const norm = (v: unknown) => (v == null || v === "" ? "" : JSON.stringify(v));
  for (const k of keys) if (norm(saved[k]) !== norm(draft[k])) return true;
  return false;
}

/** Whether leaving is blocked after the person chose; a failed save keeps them on the screen with their draft. */
export function blocksLeaving(choice: LeaveChoice, saved: boolean | null): boolean {
  if (choice === "stay") return true;
  if (choice === "save") return saved === false;
  return false;
}

// ---- Confirmation per field and per block (CA-8, CA-9, CA-10) ----

export type ConfirmSummary = { total: number; confirmed: number; pending: string[]; allConfirmed: boolean };

/** How many of a block's fields are confirmed. A block with no fields is not confirmed. */
export function confirmSummary(fields: string[], marks: unknown): ConfirmSummary {
  const m: FieldSources = readSources(marks);
  const pending = fields.filter((f) => !m[f]?.confirmed);
  return { total: fields.length, confirmed: fields.length - pending.length, pending, allConfirmed: fields.length > 0 && pending.length === 0 };
}

/** «Confirmado por Laura el 24 oct», or null while it is not confirmed. */
export function confirmedText(mark: { confirmed?: boolean; confirmedAt?: string } | undefined, byName: string | null): string | null {
  if (!mark?.confirmed) return null;
  const d = mark.confirmedAt ? new Date(mark.confirmedAt) : null;
  const day = d && !isNaN(d.getTime()) ? ` el ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : "";
  return `Confirmado${byName ? ` por ${byName}` : ""}${day}`;
}

/**
 * The fields whose origin and confirmation are tracked per element (the columns of the track_field_sources triggers in
 * migrations 0058 and 0061; a test compares them). The screens and the agent confirm only these.
 */
export const TRACKED_FIELDS = {
  account: ["industry", "size", "country", "notes", "linkedin_url"],
  icp: ["countries", "geography", "min_employees", "max_employees", "company_size"],
  positioning: ["best_customers", "alternatives", "differentiation", "value", "trend", "target_customer", "need", "product_name", "category", "key_benefit", "competitive_alternative", "differentiator", "tagline", "one_liner", "short_pitch", "elevator_pitch"],
  pillar: ["title", "pain", "message", "proof"],
  segment: ["name", "motion", "acv_min", "acv_max", "win_rate_target", "ae_quota", "cac_target", "cycle_days", "gross_margin_pct", "payback_months", "sdr_per_ae", "ae_per_se", "notes"],
} as const;
export type TrackedKind = keyof typeof TRACKED_FIELDS;

