// From gtm-lab@44f385b packages/core/src/framework.ts
import { parse, YAMLParseError } from "yaml";
import { z } from "zod";
import { formsProblem } from "./forms";
import { toolsProblem } from "./tools";
import { documentProblem } from "./document";

export const TOOLS = ["segment-score", "channel-score", "assumption-priority", "ice"] as const;

const idSchema = z.string().min(1);

const stepSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  deliverable: idSchema,
  requires: z.array(idSchema).default([]),
  /** Deliverables the AI may read for context if they are done. They never block the step. */
  uses: z.array(idSchema).default([]),
  tool: z.string().optional(),
  optional: z.boolean().default(false),
});

const frameworkSchema = z.object({
  version: z.union([z.number(), z.string()]),
  name: z.string(),
  status: z.string().optional(),
  profile: z.object({
    id: idSchema,
    questions: z.array(z.object({ id: idSchema, label: z.string().min(1) })).min(1),
  }),
  phases: z
    .array(
      z.object({
        id: idSchema,
        title: z.string().min(1),
        goal: z.string().optional(),
        steps: z.array(stepSchema).min(1),
      }),
    )
    .min(1),
  cross_cutting: z
    .array(z.object({ id: idSchema, title: z.string().min(1), tool: z.string().optional() }))
    .default([]),
  output: z.object({ id: idSchema, title: z.string().min(1), requires: z.array(idSchema).min(1) }),
  // Field-level checks live in forms.ts so that errors can name the field id.
  forms: z.record(z.string(), z.array(z.unknown())).default({}),
  // AI instruction per deliverable (own wording, decision 0002). Only for deliverables with a form.
  ai: z.record(z.string(), z.string().min(1)).default({}),
  // Calculators per tool id (SDD calculadoras). Checked in tools.ts so errors can name the id.
  tools: z.record(z.string(), z.unknown()).default({}),
  // Strategy document structure (SDD documento): sections and the deliverables each one shows.
  document: z
    .object({
      sections: z.array(
        z.object({ id: idSchema, title: z.string().min(1), deliverables: z.array(idSchema) }),
      ),
    })
    .default({ sections: [] }),
});

export type Framework = z.infer<typeof frameworkSchema>;
export type Step = z.infer<typeof stepSchema>;

export class FrameworkError extends Error {
  override name = "FrameworkError";
}

export function parseFramework(text: string): Framework {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0]?.line ?? "?";
      throw new FrameworkError(
        `YAML inválido en la línea ${line}: ${error.message.split("\n")[0]}`,
      );
    }
    throw error;
  }

  const result = frameworkSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new FrameworkError(`Estructura inválida:\n- ${issues.join("\n- ")}`);
  }

  validate(result.data);
  return result.data;
}

export function allSteps(framework: Framework): Step[] {
  return framework.phases.flatMap((phase) => phase.steps);
}

function validate(framework: Framework): void {
  const steps = allSteps(framework);

  const seen = new Set<string>();
  const ids = [
    framework.profile.id,
    ...framework.phases.map((p) => p.id),
    ...steps.map((s) => s.id),
    ...framework.cross_cutting.map((c) => c.id),
    framework.output.id,
  ];
  for (const id of ids) {
    if (seen.has(id)) throw new FrameworkError(`Id duplicado: "${id}"`);
    seen.add(id);
  }

  const questions = new Set<string>();
  for (const { id } of framework.profile.questions) {
    if (questions.has(id)) throw new FrameworkError(`Pregunta duplicada en el perfil: "${id}"`);
    questions.add(id);
  }

  for (const step of steps) {
    const repeated = step.requires.find((r, i) => step.requires.indexOf(r) !== i);
    if (repeated) throw new FrameworkError(`"${step.id}" tiene "${repeated}" repetido en requires`);
  }

  for (const step of steps) {
    const repeated = step.uses.find((u, i) => step.uses.indexOf(u) !== i);
    if (repeated) throw new FrameworkError(`"${step.id}" tiene "${repeated}" repetido en uses`);
    const both = step.uses.find((u) => step.requires.includes(u));
    if (both) throw new FrameworkError(`"${step.id}" tiene "${both}" en requires y en uses`);
    if (step.uses.includes(step.deliverable)) {
      throw new FrameworkError(
        `"${step.id}" no puede leer su propio entregable "${step.deliverable}"`,
      );
    }
  }

  const producers = new Map<string, Step>();
  for (const step of steps) {
    if (producers.has(step.deliverable) || step.deliverable === framework.profile.id) {
      throw new FrameworkError(`Entregable duplicado: "${step.deliverable}"`);
    }
    producers.set(step.deliverable, step);
  }

  const deliverables = new Set([framework.profile.id, ...producers.keys()]);
  const references: { from: string; ref: string; via?: string }[] = [
    ...steps.flatMap((s) => s.requires.map((r) => ({ from: s.id, ref: r }))),
    ...steps.flatMap((s) => s.uses.map((r) => ({ from: s.id, ref: r, via: "lee" }))),
    ...framework.output.requires.map((r) => ({ from: framework.output.id, ref: r })),
  ];
  for (const { from, ref, via } of references) {
    if (!deliverables.has(ref)) {
      throw new FrameworkError(
        `"${from}" ${via ?? "requiere"} "${ref}", que no es ningún entregable`,
      );
    }
  }

  for (const ref of framework.output.requires) {
    if (producers.get(ref)?.optional) {
      throw new FrameworkError(
        `El documento final no puede exigir un entregable opcional: "${ref}"`,
      );
    }
  }

  const tools = [...steps, ...framework.cross_cutting].flatMap((s) => (s.tool ? [s.tool] : []));
  for (const tool of tools) {
    if (!(TOOLS as readonly string[]).includes(tool)) {
      throw new FrameworkError(`Herramienta desconocida: "${tool}"`);
    }
  }

  const formProblem = formsProblem(framework.forms, producers);
  if (formProblem) throw new FrameworkError(formProblem);
  const toolProblem = toolsProblem(framework);
  if (toolProblem) throw new FrameworkError(toolProblem);
  const docProblem = documentProblem(framework);
  if (docProblem) throw new FrameworkError(docProblem);
  for (const deliverable of Object.keys(framework.ai)) {
    if (!framework.forms[deliverable]) {
      throw new FrameworkError(`Instrucción de IA para "${deliverable}", que no tiene formulario`);
    }
  }

  // Depth-first search over deliverable -> required deliverables.
  const state = new Map<string, "visiting" | "done">();
  const visit = (deliverable: string): void => {
    if (state.get(deliverable) === "done") return;
    if (state.get(deliverable) === "visiting") {
      throw new FrameworkError(`Dependencia circular en "${deliverable}"`);
    }
    state.set(deliverable, "visiting");
    for (const required of producers.get(deliverable)?.requires ?? []) visit(required);
    state.set(deliverable, "done");
  };
  for (const deliverable of producers.keys()) visit(deliverable);
}
