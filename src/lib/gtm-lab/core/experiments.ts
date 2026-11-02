// From gtm-lab@44f385b packages/core/src/experiments.ts
import type { Framework } from "./framework";
import type { FieldError } from "./forms";
import { iceScore, rankBacklog } from "./ice";

export const EXPERIMENT_STATUSES = ["idea", "running", "done", "dropped"] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];
const OPEN = new Set<ExperimentStatus>(["idea", "running"]);

export interface Experiment {
  id?: string;
  title: string;
  learning?: string | null;
  impact: number | null;
  confidence: number | null;
  ease: number | null;
  status: ExperimentStatus;
  result?: string | null;
  source?: "plan" | "manual";
  createdAt?: string;
}

const FIELDS = new Set(["id", "title", "learning", "impact", "confidence", "ease", "status", "result", "source", "createdAt"]);
const SCORES = [
  ["impact", "Impacto"],
  ["confidence", "Confianza"],
  ["ease", "Facilidad"],
] as const;
const MAX_TITLE = 200;
const MAX_TEXT = 4000;
/** The plan's form (deliverable `experiments`) that «Importar del plan» reads. */
const PLAN = { deliverable: "experiments", list: "experiments" } as const;

/** Rules for saving an experiment from the backlog screen. Names the field that fails. */
export function validateExperiment(experiment: Experiment): FieldError[] {
  const errors: FieldError[] = [];
  const add = (field: string, label: string, message: string) => errors.push({ field, label, message });
  const record = experiment as unknown as Record<string, unknown>;

  for (const key of Object.keys(record)) if (!FIELDS.has(key)) add(key, key, `Campo desconocido: "${key}"`);
  if (typeof experiment.title !== "string" || !experiment.title.trim()) add("title", "Experimento", "Obligatorio");
  else if (experiment.title.length > MAX_TITLE) add("title", "Experimento", `Máximo ${MAX_TITLE} caracteres`);
  for (const [field, label] of SCORES) {
    const value = experiment[field];
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10) {
      add(field, label, "Debe ser un entero entre 1 y 10");
    }
  }
  if (!EXPERIMENT_STATUSES.includes(experiment.status)) add("status", "Estado", "Estado no válido");
  for (const [field, label] of [["learning", "Qué quieres aprender"], ["result", "Resultado"]] as const) {
    const value = experiment[field];
    if (value != null && (typeof value !== "string" || value.length > MAX_TEXT)) add(field, label, `Máximo ${MAX_TEXT} caracteres`);
  }
  return errors;
}

export interface BacklogEntry {
  experiment: Experiment;
  /** null while any of the three scores is missing. */
  ice: number | null;
}

const scored = (e: Experiment) => e.impact !== null && e.confidence !== null && e.ease !== null;

/** Open experiments by ICE (ties: oldest first), unscored ones last; closed ones apart, oldest first. */
export function orderBacklog(experiments: readonly Experiment[]): { open: BacklogEntry[]; closed: BacklogEntry[] } {
  const byDate = (a: Experiment, b: Experiment) => Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? "");
  const open = experiments.filter((e) => OPEN.has(e.status));
  const ranked = rankBacklog(
    open.filter(scored).map((e) => ({
      experiment: e,
      impact: e.impact!,
      confidence: e.confidence!,
      ease: e.ease!,
      createdAt: e.createdAt ?? "",
    })),
  ).map(({ experiment }) => ({ experiment, ice: iceScoreOf(experiment) }));
  const unscored = open
    .filter((e) => !scored(e))
    .sort(byDate)
    .map((experiment) => ({ experiment, ice: null }));
  const closed = experiments
    .filter((e) => !OPEN.has(e.status))
    .sort(byDate)
    .map((experiment) => ({ experiment, ice: scored(experiment) ? iceScoreOf(experiment) : null }));
  return { open: [...ranked, ...unscored], closed };
}

function iceScoreOf(e: Experiment): number {
  return iceScore({ impact: e.impact!, confidence: e.confidence!, ease: e.ease! });
}

/**
 * New backlog rows from the experiments written in «Planifica cómo validarlos». Skips the ones already in the
 * backlog (same title), so importing twice adds nothing.
 */
export function planToBacklog(
  framework: Framework,
  saved: ReadonlyMap<string, { status: string; data: Record<string, unknown> }>,
  existing: readonly Experiment[],
): Experiment[] {
  if (!framework.forms[PLAN.deliverable]) return [];
  const list = saved.get(PLAN.deliverable)?.data[PLAN.list];
  if (!Array.isArray(list)) return [];
  const titles = new Set(existing.map((e) => e.title.trim()));
  const fresh: Experiment[] = [];
  for (const raw of list as Record<string, unknown>[]) {
    // Trim again after cutting: the app stores titles trimmed, and a trailing space would never match.
    const title = String(raw.assumption ?? "").trim().slice(0, MAX_TITLE).trimEnd();
    if (!title || titles.has(title)) continue;
    titles.add(title);
    const learning = [raw.method && `Cómo: ${String(raw.method)}`, raw.success && `Lo confirma: ${String(raw.success)}`]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_TEXT);
    fresh.push({ title, learning, impact: null, confidence: null, ease: null, status: "idea", source: "plan" });
  }
  return fresh;
}
