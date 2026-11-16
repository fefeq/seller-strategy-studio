// Experiments with a close criterion (SDD-20261027 strategic-suggestions-engine, F2 · H-4). Pure: what an experiment must say
// before and after it runs, the review decision (scale, adjust or close) and the change it may propose. No AI.
import type { TablesUpdate } from "@/integrations/supabase/types";
import { buildStrategySuggestion, type StrategySuggestion } from "@/lib/strategy-suggestions";

export const DECISIONS = ["scale", "adjust", "close"] as const;
export type ExperimentDecision = (typeof DECISIONS)[number];
export const DECISION_LABEL: Record<ExperimentDecision, string> = {
  scale: "Escalar",
  adjust: "Ajustar",
  close: "Cerrar",
};
export const CHANGE_ELEMENTS = ["icp", "segment", "positioning", "product_price"] as const;
export type ChangeElement = (typeof CHANGE_ELEMENTS)[number];
export const CHANGE_LABEL: Record<ChangeElement, string> = {
  icp: "ICP",
  segment: "Segmento",
  positioning: "Posicionamiento",
  product_price: "Producto y precio",
};
export const MAX_TEXT = 500;
/** Days after the end date without a result before the experiment is flagged (CA-30). */
export const OVERDUE_DAYS = 14;
const DAY = 86_400_000;

export type ExperimentLike = {
  id: string;
  title: string;
  status: string;
  hypothesis: string;
  metric: string;
  target: string;
  result: string;
  learning: string;
  success_threshold: string;
  close_rule: string;
  review_on: string | null;
  ends_on: string | null;
  decision: string | null;
};

/** CA-26: the five things an experiment states, in the order the editor shows them. Each one is editable. */
export const CRITERIA_FIELDS = [
  ["hypothesis", "Hipótesis"],
  ["metric", "Métrica"],
  ["success_threshold", "Umbral de éxito"],
  ["close_rule", "Regla de cierre"],
  ["review_on", "Fecha de revisión"],
] as const;
export const missingCriteria = (
  e: Pick<
    ExperimentLike,
    "hypothesis" | "metric" | "success_threshold" | "close_rule" | "review_on"
  >,
) =>
  CRITERIA_FIELDS.filter(([k]) => {
    const v = e[k];
    return v == null || String(v).trim() === "";
  }).map(([, l]) => l);
/** A review date is offered, never imposed: the end date when there is one, else empty. The person edits it. */
export const suggestedReviewOn = (e: Pick<ExperimentLike, "ends_on" | "review_on">) =>
  e.review_on ?? e.ends_on ?? null;

const isOpen = (e: ExperimentLike) => e.status === "running";
const empty = (v: string | null | undefined) => !v || !v.trim();
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
const today = (now: Date) => day(now.toISOString());
const ev = (e: ExperimentLike) => [{ table: "gtm_experiments", id: e.id, label: e.title }];

/** CA-27: a running experiment without a close rule. */
export function closeRuleMissing(es: ExperimentLike[]): StrategySuggestion[] {
  return es
    .filter((e) => isOpen(e) && empty(e.close_rule))
    .map((e) =>
      buildStrategySuggestion({
        element: "experiment",
        kind: "missing_data",
        action_type: "data_to_complete",
        cause: `close_rule:${e.id}`,
        priority: 2,
        title: `El experimento «${e.title}» está en marcha y no tiene regla de cierre`,
        body: "Define cuándo y con qué evidencia lo cierras, para que no se alargue sin decisión.",
        evidence: ev(e),
        link: "/theory-u",
      }),
    );
}

/** CA-28: review date reached without a decision → decide: scale, adjust or close. */
export function reviewDue(es: ExperimentLike[], now: Date): StrategySuggestion[] {
  return es
    .filter((e) => isOpen(e) && e.review_on && !e.decision && day(e.review_on) <= today(now))
    .map((e) =>
      buildStrategySuggestion({
        element: "experiment",
        kind: "validate",
        action_type: "commercial_action",
        cause: `review:${e.id}:${e.review_on}`,
        priority: 1,
        title: `El experimento «${e.title}» llegó a su fecha de revisión`,
        body: "¿Lo escalas, lo ajustas o lo cierras? Registra la decisión con el resultado.",
        evidence: ev(e),
        link: "/theory-u",
      }),
    );
}

/** CA-30: past its end date by more than 14 days with no result → record it or close it. */
export function resultOverdue(es: ExperimentLike[], now: Date): StrategySuggestion[] {
  return es
    .filter(
      (e) =>
        isOpen(e) &&
        e.ends_on &&
        empty(e.result) &&
        today(now) - day(e.ends_on) > OVERDUE_DAYS * DAY,
    )
    .map((e) =>
      buildStrategySuggestion({
        element: "experiment",
        kind: "close",
        action_type: "data_to_complete",
        cause: `overdue:${e.id}`,
        priority: 2,
        title: `El experimento «${e.title}» terminó hace más de ${OVERDUE_DAYS} días y no tiene resultado`,
        body: "Registra el resultado o ciérralo.",
        evidence: ev(e),
        link: "/theory-u",
      }),
    );
}

export type DecisionInput = {
  decision: ExperimentDecision;
  result: string;
  learning: string;
  next_review_on?: string | null;
  change_element?: ChangeElement | null;
  change_note?: string | null;
};
export type DecisionPlan =
  | { ok: true; patch: TablesUpdate<"gtm_experiments">; proposal: StrategySuggestion | null }
  | { ok: false; error: string };

/**
 * CA-29: the patch to save when the experiment is decided, and the strategy change to propose as a pending suggestion.
 * Close and scale need result and learning; adjust needs a new review date in the future. The proposal exists only when the
 * person names the element it affects: nothing is guessed.
 */
export function planDecision(
  e: ExperimentLike & { title: string },
  i: DecisionInput,
  now: Date,
  by: string,
): DecisionPlan {
  if (!DECISIONS.includes(i.decision))
    return { ok: false, error: "Elige si lo escalas, lo ajustas o lo cierras." };
  const result = (i.result ?? "").trim(),
    learning = (i.learning ?? "").trim(),
    note = (i.change_note ?? "").trim();
  if ([result, learning, note].some((t) => t.length > MAX_TEXT))
    return { ok: false, error: `Cada texto admite hasta ${MAX_TEXT} caracteres.` };
  if (i.decision !== "adjust" && (!result || !learning))
    return { ok: false, error: "Para escalar o cerrar, escribe el resultado y el aprendizaje." };
  const at = now.toISOString();
  const patch: TablesUpdate<"gtm_experiments"> = {
    decision: i.decision,
    decided_at: at,
    decided_by: by,
    result: result || e.result,
    learning: learning || e.learning,
  };
  if (i.decision === "adjust") {
    if (!i.next_review_on || day(i.next_review_on) <= today(now))
      return {
        ok: false,
        error: "Para ajustarlo, pon una nueva fecha de revisión posterior a hoy.",
      };
    patch.review_on = i.next_review_on;
    patch.decision = null;
    patch.decided_at = null;
    patch.decided_by = null; // still running, decision pending at the new date
    return { ok: true, patch, proposal: null };
  }
  patch.status = i.decision === "scale" ? "adopted" : "learned";
  if (i.change_element) {
    patch.change_element = i.change_element;
    patch.change_note = note;
  }
  const proposal =
    i.change_element && CHANGE_ELEMENTS.includes(i.change_element)
      ? buildStrategySuggestion({
          element: i.change_element,
          kind: "change",
          action_type: "strategy_change",
          cause: `experiment:${e.id}`,
          priority: 2,
          title: `El experimento «${e.title}» propone un cambio en ${CHANGE_LABEL[i.change_element]}`,
          body: `${note ? `${note} ` : ""}Resultado: ${result}. Aprendizaje: ${learning}.`.slice(
            0,
            1000,
          ),
          evidence: ev(e),
          link: "/theory-u",
        })
      : null;
  return { ok: true, patch, proposal };
}
