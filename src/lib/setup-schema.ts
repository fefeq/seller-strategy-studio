// Single declarative definition of the strategy data an org needs.
// Used by the setup wizard, the AI extraction, the agent interview and the completeness meter.

export type SetupData = {
  currency: string | null;
  segments: { name: string; acv_min: number | null; acv_max: number | null; win_rate_target: number | null; ae_quota: number | null }[];
  icps: { industries: string | null; company_size: string | null; why_fit: string | null; anti_icp: string | null }[];
  positioning: Record<string, string | null> | null;
  pillars: { title: string; message: string | null }[];
  quotas: { period: string; amount: number }[];
  accounts: number;
  /** Accounts with segment, sector and size: what the ICP fit (scoring.ts) is measured against. */
  accountsWithFit: number;
  deals: number;
  quarter: string;
};

/** Share of accounts that need segment, sector and size for the fit step to count as done (a few imported extras don't block it). */
export const FIT_SHARE = 0.8;
export const accountFitDone = (d: Pick<SetupData, "accounts" | "accountsWithFit">) => d.accounts > 0 && d.accountsWithFit >= Math.ceil(d.accounts * FIT_SHARE);

// The five fields of April Dunford's framework come first: the statement and the pitch are built on them,
// so the milestone is not done while they are empty.
export const DUNFORD_FIELDS = [
  ["best_customers", "Tus mejores clientes"],
  ["alternatives", "Alternativas competitivas"],
  ["differentiation", "Diferenciación"],
  ["value", "Valor"],
  ["trend", "Tendencia"],
] as const;

export const POSITIONING_FIELDS = [
  ...DUNFORD_FIELDS,
  ["target_customer", "Cliente objetivo"],
  ["need", "Necesidad / dolor"],
  ["category", "Categoría de mercado"],
  ["key_benefit", "Beneficio clave"],
  ["competitive_alternative", "Alternativa competitiva"],
  ["differentiator", "Diferenciador"],
  ["one_liner", "Frase de una línea"],
  ["elevator_pitch", "Elevator pitch"],
] as const;

const filled = (v: unknown) => typeof v === "string" ? v.trim().length > 0 : v != null;

export type SetupItem = {
  id: string;
  label: string;
  weight: number;
  unlocks: string;
  link: string;
  done: (d: SetupData) => boolean;
};

export const SETUP_ITEMS: SetupItem[] = [
  { id: "positioning", label: "Posicionamiento (marco de Dunford y frase, 13 campos)", weight: 20, unlocks: "Mensajes coherentes en la preparación de llamadas, las propuestas y el agente", link: "/strategy",
    done: (d) => POSITIONING_FIELDS.every(([k]) => filled(d.positioning?.[k])) },
  { id: "icp", label: "Al menos un ICP con sectores, tamaño, encaje y anti-ICP", weight: 15, unlocks: "Priorización de cuentas y research de stakeholders", link: "/strategy",
    done: (d) => d.icps.some((i) => filled(i.industries) && filled(i.company_size) && filled(i.why_fit) && filled(i.anti_icp)) },
  { id: "segments", label: "Segmentos con rango de ACV", weight: 10, unlocks: "Recomendación de motion por ACV", link: "/strategy",
    done: (d) => d.segments.length > 0 && d.segments.every((s) => s.acv_min != null || s.acv_max != null) },
  { id: "benchmarks", label: "Win rate objetivo y cuota AE por segmento", weight: 10, unlocks: "Calculadora de capacidad y payback", link: "/strategy",
    done: (d) => d.segments.length > 0 && d.segments.every((s) => s.win_rate_target != null && s.ae_quota != null) },
  { id: "pillars", label: "Tres pilares de mensaje", weight: 10, unlocks: "Narrativa para outbound y demos", link: "/strategy",
    done: (d) => d.pillars.filter((p) => filled(p.title) && filled(p.message)).length >= 3 },
  { id: "quota", label: "Cuota del trimestre actual", weight: 15, unlocks: "Cobertura de pipeline y forecast", link: "/metrics",
    done: (d) => d.quotas.some((q) => q.period === d.quarter && Number(q.amount) > 0) },
  { id: "accounts", label: "Primeras cuentas objetivo", weight: 5, unlocks: "Planes de cuenta, ABM y planificador de reuniones", link: "/accounts",
    done: (d) => d.accounts > 0 },
  // Without these three fields the score shows «sin datos de encaje» (fase A measurement, 21 oct): the step asks for them
  // right after the accounts exist instead of waiting for someone to open each account sheet.
  { id: "account_fit", label: "Segmento, sector y tamaño de tus cuentas", weight: 5, unlocks: "Puntuación de encaje con el ICP en Leads y Cuentas", link: "/accounts",
    done: accountFitDone },
  { id: "deals", label: "Pipeline: al menos un deal", weight: 10, unlocks: "Métricas, Asesor GTM y alertas de riesgo", link: "/deals",
    done: (d) => d.deals > 0 },
];

export function setupStatus(d: SetupData) {
  const items = SETUP_ITEMS.map((i) => ({ id: i.id, label: i.label, unlocks: i.unlocks, link: i.link, weight: i.weight, done: i.done(d) }));
  const total = items.reduce((s, i) => s + i.weight, 0);
  const got = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  const missing = items.filter((i) => !i.done).sort((a, b) => b.weight - a.weight);
  return { pct: Math.round((got / total) * 100), items, missing, next: missing[0] ?? null };
}
