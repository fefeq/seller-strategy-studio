// B1/B2 (PLAN-UX-20261115): old addresses keep working. Pure, tested.
// /setup → Configuración inside Onboarding; /hub?seccion=rules|voice → Estrategia › Reglas y voz.

export const RULES_TAB = "rules" as const;
export const RULES_SECTIONS = ["rules", "voice"] as const;

export function setupRedirect(): { to: "/onboarding/completar" } {
  return { to: "/onboarding/completar" };
}

/** Where an old Conocimiento address for rules or voice goes now; null keeps it in Conocimiento. */
export function hubRedirect(search: { seccion?: string; doc?: string; q?: string }):
  | { to: "/strategy"; search: { tab: typeof RULES_TAB; seccion?: string; doc?: string } }
  | null {
  if (!search.seccion || !(RULES_SECTIONS as readonly string[]).includes(search.seccion)) return null;
  return {
    to: "/strategy",
    search: {
      tab: RULES_TAB,
      ...(search.seccion !== "rules" ? { seccion: search.seccion } : {}),
      ...(search.doc ? { doc: search.doc } : {}),
    },
  };
}
