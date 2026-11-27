// Decides which strategy sections are shown. It never changes saved data:
// it only filters what the screen shows and protects hidden sections from
// being cleared when the strategy is approved.

export const CORE_STRATEGY_SECTIONS = [
  "icp",
  "segments",
  "positioning",
  "messaging",
  "sales_models",
] as const;

export type StrategyViewMode = "core" | "all";

export interface StrategySectionInfo {
  key: string;
  hasContent: boolean;
}

const CORE_SET = new Set<string>(CORE_STRATEGY_SECTIONS);

export function isCoreStrategySection(key: string): boolean {
  return CORE_SET.has(key);
}

/** True when a saved value has something a person wrote. */
export function hasSavedContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some((v) => hasSavedContent(v));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((v) => hasSavedContent(v));
  }
  return false;
}

/**
 * Sections to show, keeping the original order.
 * In "core" mode a non-core section stays visible if it already has saved content,
 * so nothing written before disappears from view.
 */
export function visibleStrategySections(
  sections: readonly StrategySectionInfo[],
  mode: StrategyViewMode,
): string[] {
  if (mode === "all") return sections.map((s) => s.key);
  return sections.filter((s) => isCoreStrategySection(s.key) || s.hasContent).map((s) => s.key);
}

export function hiddenStrategySections(
  sections: readonly StrategySectionInfo[],
  mode: StrategyViewMode,
): string[] {
  const visible = new Set(visibleStrategySections(sections, mode));
  return sections.filter((s) => !visible.has(s.key)).map((s) => s.key);
}

/**
 * Builds the values to save on approval. Only sections with real edits are
 * overwritten; hidden or untouched sections keep exactly what was saved.
 * An undefined edit never clears a saved value.
 */
export function mergeStrategyWithoutClearing<T extends Record<string, unknown>>(
  saved: T,
  edits: Partial<T>,
): T {
  const result: Record<string, unknown> = { ...saved };
  for (const [key, value] of Object.entries(edits)) {
    if (value === undefined) continue;
    result[key] = value;
  }
  return result as T;
}

export interface AssistantSectionTarget {
  focusSection: string;
  mode: StrategyViewMode;
  applyChanges: false;
}

/**
 * Where an assistant notice about a section should take the person.
 * It only opens the section (showing all sections if it was hidden);
 * it never applies a change by itself.
 */
export function assistantSectionTarget(
  sectionKey: string,
  currentMode: StrategyViewMode,
  sections: readonly StrategySectionInfo[],
): AssistantSectionTarget {
  const visible = visibleStrategySections(sections, currentMode);
  const mode: StrategyViewMode = visible.includes(sectionKey) ? currentMode : "all";
  return { focusSection: sectionKey, mode, applyChanges: false };
}

const APPROVER_ROLES = new Set(["owner", "sales_leader"]);

/** Only a manager of the same company can approve the strategy. */
export function canApproveStrategy(input: {
  role: string | null | undefined;
  memberOrgId: string | null | undefined;
  strategyOrgId: string | null | undefined;
}): boolean {
  if (!input.role || !input.memberOrgId || !input.strategyOrgId) return false;
  if (input.memberOrgId !== input.strategyOrgId) return false;
  return APPROVER_ROLES.has(input.role);
}

export const STRATEGY_APPROVAL_DENIED_MESSAGE =
  "Solo un gerente de tu empresa puede aprobar la estrategia.";
