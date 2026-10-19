// GTM cycle phases (BMAD analogy) and the hub's pure "what next?" rule.
import type { ArtifactKind, PhaseId } from "./workflows";

export const PHASES: { id: PhaseId; label: string; bmad: string; description: string; artifacts: ArtifactKind[] }[] = [
  { id: "analysis", label: "Análisis", bmad: "Analysis", description: "Mercado, cliente y apuesta.", artifacts: ["brief"] },
  { id: "plan", label: "Plan", bmad: "Planning (PRD)", description: "Segmentos, motion, objetivos y mensajes.", artifacts: ["plan"] },
  { id: "architecture", label: "Arquitectura", bmad: "Solutioning", description: "Capacidad, playbooks y revisión antes de salir.", artifacts: ["architecture", "readiness"] },
  { id: "execution", label: "Ejecución", bmad: "Implementation", description: "Account Plans, deals y semana comercial.", artifacts: [] },
  { id: "retro", label: "Retro", bmad: "Retrospective", description: "Win/Loss y retro trimestral que realimentan el ciclo.", artifacts: ["retro", "winloss"] },
];

export type CycleState = {
  approved: ArtifactKind[];
  drafts: ArtifactKind[];
  setupPct: number;
  openDeals: number;
  closedDealsWithoutWinloss: number;
  daysSinceRetro: number | null; // null = never
};

export type NextStep = { id: string; title: string; why: string; persona: string; workflow: string; priority: number };

const LEADERS = ["owner", "sales_leader"];

/** Current phase = first phase whose required artifacts are not all approved. */
export function currentPhase(s: CycleState): PhaseId {
  const ok = new Set(s.approved);
  if (!ok.has("brief")) return "analysis";
  if (!ok.has("plan")) return "plan";
  if (!ok.has("architecture") || !ok.has("readiness")) return "architecture";
  if (s.daysSinceRetro === null ? false : s.daysSinceRetro > 90) return "retro";
  return "execution";
}

/** Prioritized next steps for the user's roles (lower priority number = first). */
export function nextSteps(s: CycleState, roles: string[]): NextStep[] {
  const ok = new Set(s.approved);
  const draft = new Set(s.drafts);
  const leader = roles.some((r) => LEADERS.includes(r));
  const steps: NextStep[] = [];
  const add = (st: NextStep) => steps.push(st);

  if (s.setupPct < 60) add({ id: "context", title: "Completa el contexto de empresa", why: `Está al ${s.setupPct}%: todos los agentes trabajan mejor con él.`, persona: "paul", workflow: "company_context", priority: 1 });

  const phaseDoc = (kind: ArtifactKind, persona: string, workflow: string, title: string, prio: number) => {
    if (ok.has(kind)) return;
    if (draft.has(kind)) add({ id: `approve_${kind}`, title: `Revisa y aprueba: ${title}`, why: "Hay un borrador esperando aprobación.", persona, workflow, priority: prio });
    else add({ id: `draft_${kind}`, title: `Crea el ${title}`, why: "Es la entrada de la siguiente fase.", persona, workflow, priority: prio });
  };

  if (leader || roles.includes("marketing")) phaseDoc("brief", "paul", "brief", "GTM Brief", 2);
  if (leader && ok.has("brief")) phaseDoc("plan", "reid", "plan", "Plan GTM", 2);
  if (leader && ok.has("plan")) phaseDoc("architecture", "benioff", "architecture", "Arquitectura de Revenue", 3);
  if (leader && ok.has("plan") && ok.has("architecture")) phaseDoc("readiness", "benioff", "readiness", "revisión antes de salir al mercado", 3);

  if (s.openDeals > 0) {
    if (roles.includes("sales_leader")) add({ id: "weekly", title: "Prepara el plan de la semana", why: `${s.openDeals} deals abiertos que priorizar.`, persona: "sheryl", workflow: "weekly_plan", priority: 4 });
    if (roles.some((r) => ["ae", "sdr", "se"].includes(r))) add({ id: "advance", title: "Avanza tu deal más importante", why: "Revisa qué le falta para pasar de etapa.", persona: "jason", workflow: "advance_deal", priority: 4 });
  }
  if (roles.includes("cs")) add({ id: "churn", title: "Revisa el riesgo de churn", why: "Anticípate a las renovaciones.", persona: "brian", workflow: "churn_risk", priority: 5 });
  if (s.closedDealsWithoutWinloss > 0 && (leader || roles.includes("ae"))) add({ id: "winloss", title: `Haz el win/loss de ${s.closedDealsWithoutWinloss} deal(s) cerrado(s)`, why: "Las lecciones realimentan el Brief y el Plan.", persona: "jason", workflow: "winloss", priority: 5 });
  if (leader && ok.has("plan") && (s.daysSinceRetro === null || s.daysSinceRetro > 90)) add({ id: "retro", title: "Haz la retro trimestral", why: s.daysSinceRetro === null ? "Aún no hay ninguna retro." : "Han pasado más de 90 días desde la última.", persona: "reid", workflow: "retro", priority: 6 });

  return steps.sort((a, b) => a.priority - b.priority);
}
