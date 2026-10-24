// «Primeros pasos» guide in Inicio: four steps a new person follows in order. Pure so the card and tests agree.

export type GuideStepId = "company" | "onboarding" | "search" | "metrics";
export type GuideInput = { hasCompany: boolean; onboardingStep: string | null | undefined; searched: boolean; metricsSeen: boolean };
export type GuideStep = { id: GuideStepId; title: string; body: string; done: boolean };

/** Search jobs that count as «lanzar una búsqueda» (people, ICP companies, weekly discoveries). */
export const SEARCH_JOB_KINDS = ["icp_companies", "key_people", "discover"];

export function guideSteps(i: GuideInput): GuideStep[] {
  return [
    { id: "company", title: "Crea tu empresa", body: "Nombre, web y moneda: Nokko lo organiza todo por empresa.", done: i.hasCompany },
    { id: "onboarding", title: "Completa el onboarding", body: "Nokko lee tu web, te propone ICP, segmentos y posicionamiento, y tú apruebas.", done: i.onboardingStep === "roadmap" },
    { id: "search", title: "Lanza tu primera búsqueda", body: "Empresas de tu ICP o personas clave: corre en segundo plano y te avisa al terminar.", done: i.searched },
    { id: "metrics", title: "Mira tus Métricas", body: "Cobertura, embudo, CAC y finanzas a partir de lo que vas metiendo.", done: i.metricsSeen },
  ];
}

/** First step not done (the one the guide highlights); null when everything is done. */
export function currentStep(steps: GuideStep[]): GuideStep | null {
  return steps.find((s) => !s.done) ?? null;
}

/** The guide shows until every step is done or the person hides it. */
export function showGuide(steps: GuideStep[], hidden: boolean): boolean {
  return !hidden && steps.some((s) => !s.done);
}

/** Per company and browser: whether Métricas was opened, and whether the guide was hidden. */
export const guideKey = (orgId: string, what: "metrics" | "hidden") => `nokko-guide:${orgId}:${what}`;
