// Eval cases, as gtm-lab@44f385b scripts/eval-suggest.mjs builds them (checkProject, buildCase, CALIBRATION) on the
// same fictitious projects (fixtures/*.json, copied from scripts/eval/). The step under evaluation starts empty, as
// when a founder opens it for the first time. Pure: fixtures are bundled with ?raw (NK-0048 CA-15).
import { validateDeliverable, type Framework, type SavedDeliverableLike } from "../core";
import { buildSuggestCall, type SuggestCall } from "../suggest-request";
import type { EvalPass } from "./budget";
import holdoutRaw from "./fixtures/holdout.json?raw";
import projectsRaw from "./fixtures/projects.json?raw";

/** The model GTM Lab will use through OpenRouter (SDD §11): the generation of the pilot and the full pass. */
export const PINNED_MODEL = "anthropic/claude-sonnet-5.5";
/** OpenRouter's json_schema needs a name; it is not part of the prompt. */
export const SCHEMA_NAME = "suggestion";

export interface EvalProject {
  id: string;
  name: string;
  deliverables: Record<string, Record<string, unknown>>;
}

export interface EvalFixture {
  projects: EvalProject[];
  steps: string[];
}

export interface EvalCase {
  id: string;
  project: string;
  step: string;
  request: SuggestCall;
}

export const FIXTURES: Readonly<Record<"projects" | "holdout", EvalFixture>> = {
  projects: JSON.parse(projectsRaw) as EvalFixture,
  holdout: JSON.parse(holdoutRaw) as EvalFixture,
};

/** The 5 calibration cases of criterio.md §3, which are also the pilot. */
export const CALIBRATION = [
  "talleres/north-metric",
  "excedentes-obra/segment-list",
  "kyc-api/value-proposition",
  "veterinarias/core-message",
  "restaurantes/core-message",
];

/** Every saved deliverable must be valid as "done", or the case would test bad input instead of the model. */
export function checkProject(framework: Framework, project: EvalProject): string[] {
  const problems: string[] = [];
  for (const [id, data] of Object.entries(project.deliverables)) {
    for (const e of validateDeliverable(framework, id, data, "done"))
      problems.push(`${project.id}/${id}: ${e.label}: ${e.message}`);
  }
  return problems;
}

export function buildCase(framework: Framework, project: EvalProject, step: string): EvalCase {
  const saved = new Map<string, SavedDeliverableLike>(
    Object.entries(project.deliverables)
      .filter(([id]) => id !== step)
      .map(([id, data]) => [id, { status: "done", data }]),
  );
  return {
    id: `${project.id}/${step}`,
    project: project.id,
    step,
    request: buildSuggestCall(framework, step, saved),
  };
}

/** All cases of a fixture; throws when a fixture has invalid deliverables. */
export function allCases(
  framework: Framework,
  fixture: EvalFixture = FIXTURES.projects,
): EvalCase[] {
  const problems = fixture.projects.flatMap((p) => checkProject(framework, p));
  if (problems.length) throw new Error(`Fixtures no válidos:\n${problems.join("\n")}`);
  return fixture.projects.flatMap((p) => fixture.steps.map((s) => buildCase(framework, p, s)));
}

/** Pilot: the 5 calibration cases. Reference and full: the 24 cases of projects.json. */
export function casesFor(pass: EvalPass, framework: Framework): EvalCase[] {
  const cases = allCases(framework);
  if (pass !== "pilot") return cases;
  return CALIBRATION.map((id) => {
    const found = cases.find((c) => c.id === id);
    if (!found) throw new Error(`Caso de calibración desconocido: ${id}`);
    return found;
  });
}
