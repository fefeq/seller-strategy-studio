// Strategy simple start: the five sections a new manager sees first.
// Pure logic, mirrors public.strategy_core_missing_for on the server.

export type CoreSectionKey =
  | "ideal_customer"
  | "segments"
  | "positioning"
  | "value_proposition"
  | "messages";

export interface CoreSection {
  key: CoreSectionKey;
  label: string;
  hint: string;
}

export const CORE_SECTIONS: readonly CoreSection[] = [
  { key: "ideal_customer", label: "Cliente ideal", hint: "A quién le vendes: industria y por qué encaja." },
  { key: "segments", label: "Segmentos", hint: "Los grupos de clientes que atiendes." },
  { key: "positioning", label: "Posicionamiento", hint: "Qué te hace distinto frente a la competencia." },
  { key: "value_proposition", label: "Propuesta de valor", hint: "El beneficio principal que recibe tu cliente." },
  { key: "messages", label: "Mensajes", hint: "Lo que dice tu equipo al hablar con clientes." },
];

export interface StrategySnapshot {
  icpProfiles: { industries?: string | null; why_fit?: string | null }[];
  segments: { name?: string | null }[];
  positioning: {
    differentiator?: string | null;
    differentiation?: string | null;
    key_benefit?: string | null;
    value?: string | null;
  }[];
  pillars: { message?: string | null }[];
}

const filled = (v: string | null | undefined): boolean => (v ?? "").trim() !== "";

export function missingCoreSections(s: StrategySnapshot): CoreSectionKey[] {
  const missing: CoreSectionKey[] = [];
  if (!s.icpProfiles.some((p) => filled(p.industries) || filled(p.why_fit))) missing.push("ideal_customer");
  if (!s.segments.some((x) => filled(x.name))) missing.push("segments");
  if (!s.positioning.some((p) => filled(p.differentiator) || filled(p.differentiation))) missing.push("positioning");
  if (!s.positioning.some((p) => filled(p.key_benefit) || filled(p.value))) missing.push("value_proposition");
  if (!s.pillars.some((p) => filled(p.message))) missing.push("messages");
  return missing;
}

export function sectionLabel(key: string): string {
  return CORE_SECTIONS.find((s) => s.key === key)?.label ?? "una sección";
}

type FieldValue = string | number | boolean | null;

/**
 * Builds the update to send when saving from the five-section view.
 * Only fields that are visible AND were edited are included, so hidden
 * sections are never emptied or overwritten.
 */
export function buildCorePatch(
  original: Record<string, FieldValue | undefined>,
  edited: Record<string, FieldValue | undefined>,
  visibleKeys: readonly string[],
): Record<string, FieldValue> {
  const patch: Record<string, FieldValue> = {};
  for (const key of visibleKeys) {
    if (!(key in edited)) continue;
    const next = edited[key];
    if (next === undefined) continue;
    if (next === (original[key] ?? null)) continue;
    patch[key] = next;
  }
  return patch;
}

export interface ApprovalResult {
  approved: boolean;
  missing: string[];
}

export function parseApprovalResult(raw: unknown): ApprovalResult {
  if (raw && typeof raw === "object") {
    const r = raw as { approved?: unknown; missing?: unknown };
    const missing = Array.isArray(r.missing) ? r.missing.filter((m): m is string => typeof m === "string") : [];
    return { approved: r.approved === true, missing };
  }
  return { approved: false, missing: [] };
}

export function approvalMessage(result: ApprovalResult): string {
  if (result.approved) return "Tu estrategia quedó aprobada.";
  if (result.missing.length === 0) return "No pudimos aprobar la estrategia. Inténtalo de nuevo.";
  const names = result.missing.map(sectionLabel);
  return names.length === 1
    ? `Falta completar: ${names[0]}.`
    : `Faltan completar: ${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}.`;
}

/** Clear message for the person, never the raw error text. */
export function approvalErrorMessage(error: { code?: string | null } | null | undefined): string {
  if (error?.code === "42501") return "Solo el gerente o quien tenga ese permiso puede aprobar la estrategia.";
  return "No pudimos aprobar la estrategia. Inténtalo de nuevo en un momento.";
}
