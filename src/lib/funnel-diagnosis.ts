// AARRR diagnosis per segment and quarter (SDD-20261027-segment-motion-aarrr-diagnosis, CA-5 to CA-7). Pure: the Estrategia view and
// the get_funnel_diagnosis tool run this same function over rows they load. It never calls a provider and never estimates:
// a phase without data says «sin datos» and why, never 0. «fuga» needs a target to compare against (win_rate_target for win rate,
// payback_months for payback); everything else is shown without judgment.
import { quarterRange } from "@/lib/metrics";
import { segmentCoverage, type DealLike, type SegLike } from "@/lib/segment-coverage";
import type { CostLike } from "@/lib/cac";
import type { QuarterBudgetLike } from "@/lib/segment-budget";
import { cohort, type Trial } from "@/lib/self-service";
import { readAcquisitionMotion, type AcquisitionMotion } from "@/lib/acquisition-motion";

export type PhaseId = "acquisition" | "activation" | "retention" | "revenue" | "referral";
export type MeasureStatus = "ok" | "sin_datos" | "no_medido";
export type Verdict = "fuga" | "en_objetivo";
export type Unit = "leads" | "deals" | "%" | "meses";

export type Measure = {
  id: string;
  label: string;
  status: MeasureStatus;
  value: number | null;
  unit: Unit;
  numerator: number | null;
  denominator: number | null;
  target: number | null;
  /** Only with a target to compare against; null means «sin juicio». */
  verdict: Verdict | null;
  source: string;
  /** What is missing when the status is not ok. */
  missing: string | null;
};
export type Phase = { id: PhaseId; label: string; status: MeasureStatus; measures: Measure[] };
/** won_in_quarter / inferred_won: deals won in the quarter and how many of them were assigned by amount (D8). */
export type SegmentDiagnosis = { segment_id: string; name: string; acquisition_motion: AcquisitionMotion | null; won_in_quarter: number; inferred_won: number; phases: Phase[] };
export type FunnelDiagnosis = { quarter: string; segments: SegmentDiagnosis[]; company: { retention: Measure } };

export type SegmentInput = SegLike & { acquisition_motion?: string | null };
export type LeadLike = { segment_id: string | null; created_at: string };
/** The latest Stripe snapshot of the company (a rolling window, not the quarter). */
export type StripeLike = { logo_churn_pct: number | string | null; churned_customers: number | null; window_days: number; taken_at: string };
export type DiagnosisInput = {
  quarter: string;
  segments: SegmentInput[];
  deals: DealLike[];
  /** Leads created in the quarter. */
  leads: LeadLike[];
  /** Trials of any date: the cohort of the quarter is cut here. */
  trials: Trial[];
  costs: CostLike[];
  /** segment_budget_quarters of the quarter's year: the payback margin follows the one chain (segmentMargin). */
  budgetRows?: QuarterBudgetLike[];
  /** posthog_connections.activation_event; null when the company set none or has no connection. */
  activationEvent: string | null;
  stripe: StripeLike | null;
};

export const PHASE_LABEL: Record<PhaseId, string> = { acquisition: "Acquisition", activation: "Activation", retention: "Retention", revenue: "Revenue", referral: "Referral" };

const noData = (id: string, label: string, unit: Unit, source: string, missing: string): Measure =>
  ({ id, label, status: "sin_datos", value: null, unit, numerator: null, denominator: null, target: null, verdict: null, source, missing });

const phaseStatus = (ms: Measure[]): MeasureStatus => (ms.some((m) => m.status === "ok") ? "ok" : ms.every((m) => m.status === "no_medido") ? "no_medido" : "sin_datos");
const phase = (id: PhaseId, measures: Measure[]): Phase => ({ id, label: PHASE_LABEL[id], status: phaseStatus(measures), measures });
const round1 = (n: number) => Math.round(n * 10) / 10;

function acquisition(leads: number): Measure {
  const source = "Leads creados en el trimestre (tabla leads)";
  if (!leads) return noData("leads", "Leads de entrada", "leads", source, "No hay leads de este segmento en el trimestre.");
  return { id: "leads", label: "Leads de entrada", status: "ok", value: leads, unit: "leads", numerator: leads, denominator: null, target: null, verdict: null, source, missing: null };
}

function activation(trials: Trial[], event: string | null): Measure {
  const source = event ? `Pruebas activadas entre pruebas del trimestre; evento de PostHog «${event}»` : "Pruebas activadas entre pruebas del trimestre";
  if (!event) return noData("activation", "Activación de pruebas", "%", source, "La empresa no ha elegido el evento de activación de PostHog (Conexiones).");
  if (!trials.length) return noData("activation", "Activación de pruebas", "%", source, "No hay pruebas con alta en el trimestre en este segmento.");
  const activated = trials.filter((t) => t.activated_at).length;
  return { id: "activation", label: "Activación de pruebas", status: "ok", value: round1((activated / trials.length) * 100), unit: "%", numerator: activated, denominator: trials.length, target: null, verdict: null, source, missing: null };
}

function trialToPaid(trials: Trial[]): Measure {
  const source = "Pruebas pagadas entre pruebas con alta en el trimestre (tabla trials)";
  if (!trials.length) return noData("trial_to_paid", "Prueba a pago", "%", source, "No hay pruebas con alta en el trimestre en este segmento.");
  const paid = trials.filter((t) => t.converted_at).length;
  return { id: "trial_to_paid", label: "Prueba a pago", status: "ok", value: round1((paid / trials.length) * 100), unit: "%", numerator: paid, denominator: trials.length, target: null, verdict: null, source, missing: null };
}

/** Deals won (and win rate) of the quarter; the verdict compares win rate with win_rate_target (a percentage) only when judged. */
function dealMeasures(row: ReturnType<typeof segmentCoverage>[number], judged: boolean): Measure[] {
  const source = "Deals cerrados en el trimestre (tabla deals)";
  const { real, target, closed } = row.winRate;
  const won = row.won.deals;
  const wonM: Measure = closed
    ? { id: "won", label: "Deals ganados", status: "ok", value: won, unit: "deals", numerator: won, denominator: closed, target: null, verdict: null, source, missing: null }
    : noData("won", "Deals ganados", "deals", source, "No hay deals cerrados en el trimestre en este segmento.");
  if (real == null) return [wonM, noData("win_rate", "Win rate", "%", source, "No hay deals cerrados en el trimestre en este segmento.")];
  const value = round1(real * 100);
  const verdict: Verdict | null = judged && target != null ? (real * 100 < target ? "fuga" : "en_objetivo") : null;
  return [wonM, { id: "win_rate", label: "Win rate", status: "ok", value, unit: "%", numerator: won, denominator: closed, target: judged ? target : null, verdict, source, missing: null }];
}

/**
 * Payback is judged only on a real CAC: with the target CAC it would compare the target with itself. CAC, ACV and
 * margin are Cobertura's (unit-economics.ts, one margin chain); without a payback the measure says why and has no verdict.
 */
function paybackMeasure(row: ReturnType<typeof segmentCoverage>[number]): Measure {
  const { real, target } = row.payback;
  const source = "Payback con el CAC real del trimestre (costes introducidos / deals ganados), el ACV del segmento y su margen (presupuesto real, deals con líneas, plan u objetivo)";
  if (real == null) return noData("payback", "Payback", "meses", source, `Sin dato: ${row.payback.reason ?? "falta CAC real"}.`);
  const value = round1(real);
  const verdict: Verdict | null = target != null ? (real > target ? "fuga" : "en_objetivo") : null;
  return { id: "payback", label: "Payback", status: "ok", value, unit: "meses", numerator: null, denominator: null, target, verdict, source, missing: null };
}

export function companyRetention(stripe: StripeLike | null): Measure {
  if (!stripe || stripe.logo_churn_pct == null) return noData("logo_churn", "Churn de clientes de la empresa", "%", "Stripe", "Stripe no está conectado o aún no hay ninguna lectura.");
  return {
    id: "logo_churn", label: "Churn de clientes de la empresa", status: "ok", value: round1(Number(stripe.logo_churn_pct)), unit: "%", numerator: stripe.churned_customers, denominator: null, target: null, verdict: null,
    source: `Stripe, ventana de ${stripe.window_days} días hasta ${stripe.taken_at.slice(0, 10)} (no es el trimestre exacto)`, missing: null,
  };
}

/**
 * Revenue by the segment's acquisition motion: plg = trial to paid; slg = deals won, win rate and payback (judged against their targets);
 * marketing, partner or undefined = both sources, no judgment.
 */
export function funnelDiagnosis(input: DiagnosisInput): FunnelDiagnosis | null {
  const range = quarterRange(input.quarter);
  if (!/^\d{4}-Q[1-4]$/.test(input.quarter) || Number.isNaN(range.start.getTime())) return null;
  const rows = segmentCoverage(input.segments, input.deals, {}, range, input.costs, input.budgetRows ?? []);
  const cohortOf = cohort(input.trials, range.start, range.end);
  const leadsIn = input.leads.filter((l) => { const d = new Date(l.created_at); return d >= range.start && d < range.end; });
  const segments = input.segments.map((seg, i): SegmentDiagnosis => {
    const row = rows[i]!;
    const motion = readAcquisitionMotion(seg.acquisition_motion);
    const trials = cohortOf.filter((t) => t.segment_id === seg.id);
    const revenue = motion === "plg" ? [trialToPaid(trials)]
      : motion === "slg" ? [...dealMeasures(row, true), paybackMeasure(row)]
      : [trialToPaid(trials), ...dealMeasures(row, false)];
    return {
      segment_id: seg.id, name: seg.name, acquisition_motion: motion, won_in_quarter: row.wonInQuarter, inferred_won: row.inferredWon,
      phases: [
        phase("acquisition", [acquisition(leadsIn.filter((l) => l.segment_id === seg.id).length)]),
        phase("activation", [activation(trials, input.activationEvent)]),
        phase("retention", [noData("logo_churn", "Churn de clientes", "%", "Stripe", "Stripe no separa a los clientes por segmento; mira el churn de la empresa.")]),
        phase("revenue", revenue),
        phase("referral", [{ ...noData("referral", "Referral", "%", "Sin fuente", "No hay una fuente fiable para medirlo."), status: "no_medido" }]),
      ],
    };
  });
  return { quarter: input.quarter, segments, company: { retention: companyRetention(input.stripe) } };
}
