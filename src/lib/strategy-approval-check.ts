// Pure check mirrored from public.strategy_missing_section (migration 0109).
// Used by the screen to tell the manager which section is missing before saving.

export const STRATEGY_SECTIONS = [
  "Cliente ideal",
  "Segmentos",
  "Posicionamiento",
  "Mensajes",
  "Modelos de venta",
] as const;

export type StrategySection = (typeof STRATEGY_SECTIONS)[number];

export type StrategySnapshot = {
  icpProfiles: { name?: string | null; industries?: string | null; why_fit?: string | null }[];
  segments: { name?: string | null; motion?: string | null }[];
  positioning: {
    one_liner?: string | null;
    elevator_pitch?: string | null;
    differentiation?: string | null;
  }[];
  messagingPillars: { title?: string | null; message?: string | null }[];
};

const PLACEHOLDER =
  /^(describe aqu|escribe aqu|ejemplo:|texto de ejemplo|lorem ipsum|por completar|completar aqu|pendiente$|tbd$|xxx|[.]{3}$|-$)/;

export function isEmptyStrategyText(value: string | null | undefined): boolean {
  if (value == null) return true;
  if (value.replace(/\s/g, "") === "") return true;
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();
  return PLACEHOLDER.test(normalized);
}

const filled = (value: string | null | undefined) => !isEmptyStrategyText(value);

export function firstMissingStrategySection(s: StrategySnapshot): StrategySection | null {
  if (!s.icpProfiles.some((i) => filled(i.name) && (filled(i.industries) || filled(i.why_fit)))) {
    return "Cliente ideal";
  }
  if (!s.segments.some((x) => filled(x.name))) return "Segmentos";
  if (
    !s.positioning.some(
      (p) => filled(p.one_liner) || filled(p.elevator_pitch) || filled(p.differentiation),
    )
  ) {
    return "Posicionamiento";
  }
  if (!s.messagingPillars.some((m) => filled(m.title) && filled(m.message))) return "Mensajes";
  if (!s.segments.some((x) => filled(x.name) && filled(x.motion))) return "Modelos de venta";
  return null;
}

export function missingSectionMessage(section: StrategySection): string {
  return `Falta completar la sección «${section}» antes de aprobar`;
}
