// The one AI call of the strategic review (SDD-20261027 F4). Pure of the database: the caller loads the sources, the last
// review and the month's budget, and saves the result. `ask` is injected so tests never reach a model.
import { budgetState } from "@/lib/orchestrator/planner";
import {
  buildReviewInput,
  inputFingerprint,
  parseReview,
  reviewPrompt,
  REVIEW_SCHEMA,
  type ReviewDepth,
  type ReviewMode,
  type ReviewSource,
} from "@/lib/strategy-review";
import type { StrategySuggestion } from "@/lib/strategy-suggestions";

/** Rough cost in EUR of one review, for the budget; replaced by real usage when the gateway reports it. */
export const REVIEW_COST_EUR: Record<ReviewDepth, number> = { low: 0.05, medium: 0.25 };

export type LastReview = {
  id: string;
  created_at: string;
  fingerprint: string;
  suggestions: StrategySuggestion[];
};
export type ReviewStatus = "fresh" | "reused" | "budget" | "error" | "no_data";
export type ReviewResult = {
  status: ReviewStatus;
  suggestions: StrategySuggestion[];
  fingerprint: string | null;
  cost: number;
  notice: string | null;
  discarded: number;
};
export type ReviewDeps = {
  sources: ReviewSource[];
  mode: ReviewMode;
  depth: ReviewDepth;
  last: LastReview | null;
  budget: { limit: number | null; spent: number };
  ask: (
    system: string,
    user: string,
    opts: { effort: ReviewDepth; schema: { name: string; schema: unknown } },
  ) => Promise<string>;
  /** Extra names to mask besides those the sources declare. */
  names?: string[];
};

export async function runReview(d: ReviewDeps): Promise<ReviewResult> {
  const keep = d.last?.suggestions ?? [];
  const base = { suggestions: keep, fingerprint: null, cost: 0, discarded: 0 };
  if (!d.sources.length)
    return {
      ...base,
      status: "no_data",
      notice:
        "Todavía no hay datos que revisar: completa ICP, segmentos o deals y vuelve a pedir la revisión.",
    };
  const { payload, refs, names } = buildReviewInput(d.sources);
  const fingerprint = inputFingerprint(payload, d.mode, d.depth);
  if (d.last && d.last.fingerprint === fingerprint)
    return {
      ...base,
      status: "reused",
      fingerprint,
      notice:
        "Los datos no han cambiado desde la última revisión: te mostramos esa, sin gastar IA.",
    };
  const b = budgetState(d.budget.spent, d.budget.limit);
  if (b.paused)
    return {
      ...base,
      status: "budget",
      notice:
        "Has agotado el presupuesto de IA de este mes. Te mostramos la última revisión; el Owner puede subir el límite.",
    };
  const warn = b.warn ? "Llevas más del 80 % del presupuesto de IA de este mes." : null;
  let raw: string;
  try {
    raw = await d.ask(reviewPrompt(d.mode), JSON.stringify(payload), {
      effort: d.depth,
      schema: { name: "strategy_review", schema: REVIEW_SCHEMA },
    });
  } catch (e) {
    console.error("strategy review: ask failed", e instanceof Error ? e.message : e);
    return {
      ...base,
      status: "error",
      notice:
        "No hemos podido hacer la revisión ahora. Se conserva la anterior; inténtalo de nuevo en unos minutos.",
    };
  }
  try {
    const parsed = parseReview(raw, refs, [...names, ...(d.names ?? [])]);
    return {
      status: "fresh",
      suggestions: parsed.suggestions,
      fingerprint,
      cost: REVIEW_COST_EUR[d.depth],
      notice: warn,
      discarded: parsed.discarded,
    };
  } catch (e) {
    console.error(
      "strategy review: invalid answer",
      e instanceof Error ? e.message : e,
      raw.slice(0, 200),
    );
    return {
      ...base,
      status: "error",
      notice: "La IA no devolvió una revisión válida. Se conserva la anterior; inténtalo de nuevo.",
    };
  }
}
