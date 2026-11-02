// From gtm-lab@44f385b packages/core/src/tasks.ts
import { parse, YAMLParseError } from "yaml";
import { z } from "zod";
import { allSteps, type Framework } from "./framework";

export const TASK_STAGES = ["before", "launch", "after"] as const;
export const TASK_KINDS = ["decision", "workshop", "framework", "guide", "habit", "campaign", "analysis", "quick"] as const;
export const TASK_DURATIONS = ["hour", "hours", "day", "days", "weeks", "month", "ongoing"] as const;
/** Statuses a founder can save. A task with no saved row is pending with no date. */
export const SAVED_TASK_STATUSES = ["pending", "in_progress", "done", "dropped"] as const;

export type TaskStage = (typeof TASK_STAGES)[number];
export type TaskKind = (typeof TASK_KINDS)[number];
export type TaskDuration = (typeof TASK_DURATIONS)[number];
export type SavedTaskStatus = (typeof SAVED_TASK_STATUSES)[number];
export type TaskStatus = SavedTaskStatus;

export class TasksError extends Error {
  override name = "TasksError";
}

// Values are checked by hand below so that errors can name the task id (zod would only give an array index).
const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  stage: z.string(),
  category: z.string(),
  kind: z.string(),
  duration: z.string().optional(),
  /** The task is done through this strategy step, so its status comes from that deliverable. */
  step: z.string().optional(),
  /** Deliverables worth having first. A hint only: it never blocks the task. */
  needs: z.array(z.string()).default([]),
  /** The task is about writing or publishing on LinkedIn, which is done with Postin. */
  postin: z.boolean().default(false),
});

const catalogSchema = z.object({
  categories: z.array(z.object({ id: z.string().min(1), title: z.string().min(1) })).min(1),
  tasks: z.array(taskSchema).min(1),
});

export interface Task {
  id: string;
  title: string;
  summary: string;
  stage: TaskStage;
  category: string;
  kind: TaskKind;
  duration?: TaskDuration;
  step?: string;
  needs: string[];
  postin: boolean;
}

export interface TaskCatalog {
  categories: { id: string; title: string }[];
  tasks: Task[];
}

function oneOf<T extends string>(allowed: readonly T[], value: string): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function parseTasks(text: string): TaskCatalog {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0]?.line ?? "?";
      throw new TasksError(`YAML inválido en la línea ${line}: ${error.message.split("\n")[0]}`);
    }
    throw error;
  }

  const result = catalogSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new TasksError(`Estructura inválida:\n- ${issues.join("\n- ")}`);
  }
  const { categories, tasks } = result.data;

  const categoryIds = new Set<string>();
  for (const { id } of categories) {
    if (categoryIds.has(id)) throw new TasksError(`Categoría duplicada: "${id}"`);
    categoryIds.add(id);
  }

  const ids = new Set<string>();
  const titles = new Map<string, string>();
  for (const task of tasks) {
    if (ids.has(task.id)) throw new TasksError(`Tarea duplicada: "${task.id}"`);
    ids.add(task.id);
    if (!task.title.trim()) throw new TasksError(`La tarea "${task.id}" no tiene título`);
    if (!task.summary.trim()) throw new TasksError(`La tarea "${task.id}" no tiene resumen`);
    const title = task.title.trim();
    if (titles.has(title)) throw new TasksError(`La tarea "${task.id}" repite el título de "${titles.get(title)}"`);
    titles.set(title, task.id);
    if (!oneOf(TASK_STAGES, task.stage)) throw new TasksError(`La tarea "${task.id}" tiene una etapa desconocida: "${task.stage}"`);
    if (!categoryIds.has(task.category)) throw new TasksError(`La tarea "${task.id}" usa la categoría "${task.category}", que no existe`);
    if (!oneOf(TASK_KINDS, task.kind)) throw new TasksError(`La tarea "${task.id}" tiene un tipo desconocido: "${task.kind}"`);
    if (task.duration !== undefined && !oneOf(TASK_DURATIONS, task.duration)) {
      throw new TasksError(`La tarea "${task.id}" tiene una duración desconocida: "${task.duration}"`);
    }
  }

  return { categories, tasks: tasks as Task[] };
}

/** Checks that every link points at something the framework has. Returns a message naming the task and the id, or null. */
export function tasksProblem(catalog: TaskCatalog, framework: Framework): string | null {
  const steps = new Set(allSteps(framework).map((s) => s.id));
  const deliverables = new Set([framework.profile.id, ...allSteps(framework).map((s) => s.deliverable)]);
  for (const task of catalog.tasks) {
    if (task.step !== undefined && !steps.has(task.step)) return `La tarea "${task.id}" usa el paso "${task.step}", que no existe`;
    for (const id of task.needs) {
      if (!deliverables.has(id)) return `La tarea "${task.id}" necesita "${id}", que no es ningún entregable`;
    }
  }
  return null;
}

/**
 * A task done through a strategy step follows that step's deliverable and ignores saved rows.
 * Any other task takes its saved status, or is pending.
 */
export function taskStatus(
  task: Task,
  framework: Framework,
  doneDeliverables: ReadonlySet<string>,
  saved: ReadonlyMap<string, SavedTaskStatus>,
): TaskStatus {
  if (task.step !== undefined) {
    const step = allSteps(framework).find((s) => s.id === task.step);
    return step && doneDeliverables.has(step.deliverable) ? "done" : "pending";
  }
  return saved.get(task.id) ?? "pending";
}

export interface TaskCounts {
  done: number;
  inProgress: number;
  pending: number;
  dropped: number;
  /** Done, in progress and pending. Dropped tasks are left out. */
  total: number;
}

export interface TasksSummary extends TaskCounts {
  byStage: Record<TaskStage, TaskCounts>;
  byCategory: Record<string, TaskCounts>;
}

const emptyCounts = (): TaskCounts => ({ done: 0, inProgress: 0, pending: 0, dropped: 0, total: 0 });

function count(counts: TaskCounts, status: TaskStatus): void {
  if (status === "done") counts.done += 1;
  else if (status === "in_progress") counts.inProgress += 1;
  else if (status === "dropped") counts.dropped += 1;
  else counts.pending += 1;
  if (status !== "dropped") counts.total += 1;
}

/** `statuses` maps task id to status; a task missing from it counts as pending. */
export function summarizeTasks(catalog: TaskCatalog, statuses: ReadonlyMap<string, TaskStatus>): TasksSummary {
  const summary: TasksSummary = {
    ...emptyCounts(),
    byStage: { before: emptyCounts(), launch: emptyCounts(), after: emptyCounts() },
    byCategory: Object.fromEntries(catalog.categories.map((c) => [c.id, emptyCounts()])),
  };
  for (const task of catalog.tasks) {
    const status = statuses.get(task.id) ?? "pending";
    count(summary, status);
    count(summary.byStage[task.stage], status);
    const category = summary.byCategory[task.category];
    if (category) count(category, status);
  }
  return summary;
}
