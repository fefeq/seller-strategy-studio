// Sales flow strip: where you are in Lead → Cuenta → Pipeline → Métricas and what comes next.
// Pure and tested so the strip and the menu agree on the same places.
export type FlowStep = { to: string; label: string; what: string };

export const FLOW: FlowStep[] = [
  { to: "/leads", label: "Leads", what: "Entra el interés y se decide si merece seguimiento." },
  { to: "/accounts", label: "Cuentas", what: "La empresa y sus personas: el contexto de todo lo demás." },
  { to: "/deals", label: "Pipeline", what: "Las oportunidades abiertas y su siguiente paso." },
  { to: "/metrics", label: "Métricas", what: "Lo que pasó con todo lo anterior: embudo, pérdidas y tendencia." },
];

export type FlowPosition = { steps: FlowStep[]; index: number; current: FlowStep; prev: FlowStep | null; next: FlowStep | null };

/** Position of a path in the flow (detail pages such as /accounts/123 count), or null outside it. */
export function flowFor(path: string): FlowPosition | null {
  const index = FLOW.findIndex((s) => path === s.to || path.startsWith(`${s.to}/`));
  if (index < 0) return null;
  return { steps: FLOW, index, current: FLOW[index]!, prev: FLOW[index - 1] ?? null, next: FLOW[index + 1] ?? null };
}
