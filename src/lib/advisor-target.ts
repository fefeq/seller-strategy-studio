// B4 (PLAN-UX-20261115): where an Advisor proposal lands in Estrategia. Pure keyword rules over the proposal's
// own text (title, rationale, KPI, actions); no AI schema change. Falls back to the AI review tab.
import type { AdvisorRecommendation } from "@/lib/advisor";

export type StrategyTab =
  "motions" | "diagnosis" | "payback" | "budget" | "icp" | "positioning" | "pillars" | "review";

const RULES: { tab: StrategyTab; label: string; re: RegExp }[] = [
  {
    tab: "icp",
    label: "ICP",
    re: /\b(icp|perfil de cliente|cliente ideal|anti-icp|buyer persona)\b/i,
  },
  {
    tab: "pillars",
    label: "Mensajes",
    re: /\b(mensaje|mensajes|messaging|pilar|pilares|copy|narrativa)\b/i,
  },
  {
    tab: "positioning",
    label: "Posicionamiento",
    re: /\b(posicionamiento|propuesta de valor|diferencia|competencia|competidor)/i,
  },
  {
    tab: "budget",
    label: "Presupuesto vs real",
    re: /\b(presupuesto|gasto|inversi[oó]n|budget)\b/i,
  },
  { tab: "payback", label: "Payback real", re: /\b(payback|cac|ltv|margen)\b/i },
  {
    tab: "diagnosis",
    label: "Diagnóstico AARRR",
    re: /\b(aarrr|activaci[oó]n|retenci[oó]n|conversi[oó]n|funnel|embudo|churn)\b/i,
  },
  {
    tab: "motions",
    label: "Modelos de venta",
    re: /\b(motion|modelo de venta|plg|self-service|outbound|inbound|abm|partners?|canal|segmento|acv|ticket)\b/i,
  },
];

export function strategyTargetFor(
  rec: Pick<AdvisorRecommendation, "title" | "rationale" | "kpi" | "actions">,
): {
  tab: StrategyTab;
  label: string;
} {
  const title = rec.title ?? "";
  const rest = [rec.rationale, rec.kpi, ...(rec.actions ?? [])].join(" ");
  for (const text of [title, rest]) {
    const hit = RULES.find((r) => r.re.test(text));
    if (hit) return { tab: hit.tab, label: hit.label };
  }
  return { tab: "review", label: "Revisión con IA" };
}
