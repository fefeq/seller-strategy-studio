// From gtm-lab@44f385b packages/core/src/progress.ts
import { allSteps, type Framework } from "./framework";

export type StepStatus = "done" | "in_progress" | "available" | "blocked";

export interface StepProgress {
  id: string;
  status: StepStatus;
  /** Required deliverables not done yet, in declaration order. Empty unless blocked. */
  missing: string[];
}

export interface ProjectProgress {
  profile: Exclude<StepStatus, "blocked">;
  steps: StepProgress[];
}

/**
 * `done` holds the ids of finished deliverables, including the profile id; `inProgress` the ones with a saved draft.
 * Only `done` unlocks later steps.
 */
export function projectProgress(
  framework: Framework,
  done: ReadonlySet<string>,
  inProgress: ReadonlySet<string> = new Set(),
): ProjectProgress {
  const profileId = framework.profile.id;
  return {
    profile: done.has(profileId) ? "done" : inProgress.has(profileId) ? "in_progress" : "available",
    steps: allSteps(framework).map((step) => {
      if (done.has(step.deliverable)) return { id: step.id, status: "done", missing: [] };
      // A draft never bypasses its prerequisites: if one was reopened, the step is blocked again (answers are kept).
      const missing = step.requires.filter((required) => !done.has(required));
      if (missing.length) return { id: step.id, status: "blocked", missing };
      return { id: step.id, status: inProgress.has(step.deliverable) ? "in_progress" : "available", missing };
    }),
  };
}

/** True for the profile id and every step deliverable; the only ids the app may store. */
export function isKnownDeliverable(framework: Framework, id: string): boolean {
  return id === framework.profile.id || allSteps(framework).some((step) => step.deliverable === id);
}

export function strategyDocReady(framework: Framework, done: ReadonlySet<string>): boolean {
  const mandatory = allSteps(framework)
    .filter((step) => !step.optional)
    .map((step) => step.deliverable);
  return [framework.profile.id, ...mandatory, ...framework.output.requires].every((id) => done.has(id));
}
