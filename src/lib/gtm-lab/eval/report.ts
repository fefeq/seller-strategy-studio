// Reading of a pass, fixed before running it (SDD-20261101-gtm-lab-1-core CA-19, criterio.md §5). Pure.
import type { Checks } from "./checks";
import type { Verdict } from "./judge-request";

export interface CaseResult {
  id: string;
  /** Set when the provider failed (HTTP error, rejected schema…): not a model failure, and it stops the run. */
  providerError: string | null;
  stopReason: string | null;
  checks: Checks | null;
  /** All automatic checks pass. */
  pass: boolean;
  verdict: Verdict | null;
}

const CRITERIA = ["concreta", "coherente", "accionable"] as const;
type Criterion = (typeof CRITERIA)[number];

export interface PassSummary {
  cases: number;
  /** All 24 cases ran and none hit a provider error. */
  complete: boolean;
  providerErrors: string[];
  refusalsOrCut: string[];
  inventions: string[];
  passChecks: number;
  /** Finished normally but without a verdict (judge skipped, cut or refused): the threshold cannot be claimed. */
  unjudged: string[];
  judged: number;
  /** Means over the judged cases; null with none. */
  means: Record<Criterion, number | null>;
  lowScores: string[];
  /** criterio.md §5, only for a complete run of 24 cases; null otherwise. */
  meetsThreshold: boolean | null;
}

export const FULL_CASES = 24;

export function summarize(results: CaseResult[]): PassSummary {
  const providerErrors = results.filter((r) => r.providerError !== null).map((r) => r.id);
  const answered = results.filter((r) => r.providerError === null);
  const refusalsOrCut = answered.filter((r) => r.stopReason !== "end_turn").map((r) => r.id);
  const verdicts = answered.flatMap((r) => (r.verdict ? [[r.id, r.verdict] as const] : []));
  const unjudged = answered
    .filter((r) => r.stopReason === "end_turn" && !r.verdict)
    .map((r) => r.id);
  const mean = (c: Criterion) =>
    verdicts.length ? verdicts.reduce((s, [, v]) => s + v[c].nota, 0) / verdicts.length : null;
  const means = {
    concreta: mean("concreta"),
    coherente: mean("coherente"),
    accionable: mean("accionable"),
  };
  const lowScores = verdicts
    .filter(([, v]) => CRITERIA.some((c) => v[c].nota <= 2))
    .map(([id]) => id);
  const inventions = verdicts.filter(([, v]) => v.invencion.hay).map(([id]) => id);
  const passChecks = answered.filter((r) => r.pass).length;
  const complete = results.length === FULL_CASES && providerErrors.length === 0;
  return {
    cases: results.length,
    complete,
    providerErrors,
    refusalsOrCut,
    inventions,
    passChecks,
    unjudged,
    judged: verdicts.length,
    means,
    lowScores,
    meetsThreshold: complete
      ? refusalsOrCut.length === 0 &&
        inventions.length === 0 &&
        unjudged.length === 0 &&
        passChecks >= 22 &&
        CRITERIA.every((c) => (means[c] ?? 0) >= 4) &&
        lowScores.length === 0
      : null,
  };
}

/** Informative comparison with the reference (CA-19): flags «requiere decisión de Fede», never closes E-3. */
export function compareWithReference(full: PassSummary, reference: PassSummary) {
  const EPS = 1e-9;
  const fewerPassing = reference.passChecks - full.passChecks >= 2;
  const lowerActionable =
    full.means.accionable !== null &&
    reference.means.accionable !== null &&
    reference.means.accionable - full.means.accionable >= 0.25 - EPS;
  return { fewerPassing, lowerActionable, needsDecision: fewerPassing || lowerActionable };
}
