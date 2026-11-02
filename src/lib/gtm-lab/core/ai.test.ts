// From gtm-lab@44f385b packages/core/src/ai.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { aiInstructionFor, allSteps, buildAiRequest, formFor, formJsonSchema, parseFramework, validateDeliverable } from "./index";
import { loadFrameworkFile } from "./node";

const real = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));
const formSteps = allSteps(real).filter((s) => formFor(real, s.deliverable));

type Schema = { type: string; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; required?: string[]; additionalProperties?: boolean };

// Builds the smallest object that satisfies a schema, the way a well-behaved model answer would.
function sample(schema: Schema): unknown {
  if (schema.type === "object") {
    return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([k, v]) => [k, sample(v)]));
  }
  if (schema.type === "array") return [sample(schema.items!)];
  return schema.enum ? schema.enum[0] : "Texto";
}

describe("AI instructions in the framework", () => {
  it("every step with a form has its own AI instruction, and the profile has none", () => {
    for (const step of formSteps) expect(aiInstructionFor(real, step.deliverable), step.id).toBeTruthy();
    expect(aiInstructionFor(real, "project-profile")).toBeUndefined();
  });

  it("rejects an AI instruction for a deliverable without form, naming it", () => {
    const text = `
version: 1
name: t
profile: { id: project-profile, questions: [{ id: q, label: Q }] }
phases:
  - id: p
    title: P
    steps:
      - { id: a, title: A, deliverable: da, requires: [project-profile] }
output: { id: doc, title: Doc, requires: [da] }
forms:
  da: [{ id: x, type: text, label: X }]
ai:
  da: "Propón X."
`;
    expect(() => parseFramework(text)).not.toThrow();
    expect(() => parseFramework(text.replace("ai:\n  da:", "ai:\n  zz:"))).toThrow(/"zz"/);
  });
});

describe("formJsonSchema (CA-1)", () => {
  it.each(formSteps.map((s) => s.deliverable))("%s: a schema-valid answer passes draft validation", (id) => {
    const schema = formJsonSchema(real, id) as Schema;
    expect(validateDeliverable(real, id, sample(schema) as Record<string, unknown>, "draft")).toEqual([]);
  });

  it("closes every object, lists the select options and names the limits the API cannot enforce", () => {
    const schema = formJsonSchema(real, "competitor-map") as Schema;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["alternatives"]);
    const item = schema.properties!.alternatives!.items!;
    expect(item.additionalProperties).toBe(false);
    expect(item.properties!.kind!.enum).toEqual(["Competidor directo", "Otra forma de resolverlo", "No hacer nada"]);
    expect(JSON.stringify(schema.properties!.alternatives)).toMatch(/Máximo 10 elementos/);
    // Unsupported by structured outputs: must not be sent.
    expect(JSON.stringify(schema)).not.toMatch(/maxLength|minLength|maxItems|minItems/);
  });

  it("an answer with an unknown field or option still fails core validation (control)", () => {
    expect(validateDeliverable(real, "competitor-map", { alternatives: [{ name: "X", kind: "Otra" }] }, "draft")).not.toEqual([]);
  });

  it("throws for a deliverable without form", () => {
    expect(() => formJsonSchema(real, "segment-scores")).toThrow(/"segment-scores"/);
  });
});

describe("buildAiRequest (CA-2)", () => {
  const saved = new Map<string, { status: "done" | "in_progress"; data: Record<string, unknown> }>([
    ["project-profile", { status: "done", data: { product: "Agenda para talleres" } }],
    ["end-goal", { status: "done", data: { goal: "20 talleres" } }],
    ["segment-list", { status: "done", data: { segments: [{ name: "Talleres" }] } }],
    ["competitor-map", { status: "in_progress", data: { alternatives: [{ name: "Papel" }] } }],
    ["north-metric", { status: "done", data: { metric: "Citas" } }],
  ]);

  it("includes the profile, done prerequisites (direct and indirect) and the current draft", () => {
    const withDraft = new Map(saved).set("entry-segment", { status: "in_progress", data: { segment: "Segmento-del-borrador-7Q" } });
    // entry-segment requires segment-scores and competitor-map; segment-scores requires segment-list.
    withDraft.set("segment-scores", { status: "done", data: {} });
    withDraft.set("competitor-map", { status: "done", data: { alternatives: [{ name: "Papel" }] } });
    const { user } = buildAiRequest(real, "entry-segment", withDraft);
    expect(user).toContain("Agenda para talleres"); // profile
    expect(user).toContain("Papel"); // direct prerequisite
    expect(user).toContain("Talleres"); // indirect prerequisite
    expect(user).toContain("Segmento-del-borrador-7Q"); // current draft
    expect(user).not.toContain("20 talleres"); // end-goal is not a prerequisite of entry-segment
    expect(user).not.toContain("Citas");
  });

  it("renders a calculator prerequisite as its ranking", () => {
    const withScores = new Map(saved)
      .set("segment-list", { status: "done", data: { segments: [{ name: "Talleres" }, { name: "Motos" }] } })
      .set("competitor-map", { status: "done", data: { alternatives: [{ name: "Papel" }] } })
      .set("segment-scores", {
        status: "done",
        data: {
          rows: [
            { item: "Talleres", scores: { pain: 2, budget: 2, access: 2, fit: 2 } },
            { item: "Motos", scores: { pain: 5, budget: 4, access: 4, fit: 3 } },
          ],
        },
      });
    const { user } = buildAiRequest(real, "entry-segment", withScores);
    expect(user).toContain("1. Motos — Total: 16 de 20");
    expect(user).toContain("2. Talleres — Total: 8 de 20");
  });

  it("flags a calculator ranking that no longer matches its source list", () => {
    const stale = new Map(saved)
      .set("competitor-map", { status: "done", data: { alternatives: [{ name: "Papel" }] } })
      .set("segment-scores", { status: "done", data: { rows: [{ item: "Viejo", scores: { pain: 5, budget: 5, access: 5, fit: 5 } }] } });
    const { user } = buildAiRequest(real, "entry-segment", stale);
    expect(user).not.toContain("Viejo");
    expect(user).toContain("(puntuaciones desactualizadas");
  });

  it("leaves out prerequisites that are only in progress", () => {
    const { user } = buildAiRequest(real, "entry-segment", saved);
    expect(user).not.toContain("Papel");
  });

  it("is deterministic and keeps the stable instructions in the system prompt", () => {
    const a = buildAiRequest(real, "north-metric", saved);
    const shuffled = new Map([...saved].reverse());
    const b = buildAiRequest(real, "north-metric", shuffled);
    expect(a).toEqual(b);
    expect(a.system).not.toContain("Agenda para talleres");
    expect(a.user).toContain(aiInstructionFor(real, "north-metric")!);
  });
});

// SDD instrucciones-ia: rules from the eval report (docs/evaluacion/informe.md §5).
describe("writing rules for suggestions (SDD instrucciones-ia)", () => {
  const { system } = buildAiRequest(real, "end-goal", new Map());

  it("the system prompt states the five rules: brevity, one check, data vs proposals, real proofs, no filler (CA-1)", () => {
    expect(system).toMatch(/breve/i);
    expect(system).toContain("[Comprueba: …]");
    expect(system).toMatch(/como mucho un/i);
    expect(system).toContain("[propuesta: …]");
    expect(system).toMatch(/pruebas/i);
    expect(system).toMatch(/lista vacía/i);
    expect(system).toMatch(/tercera persona/i);
    expect(system).toMatch(/palabras de moda/i);
  });

  it("second iteration: «sin dato» only as a field's whole value, proposals only for figures, no invented results (CA-1)", () => {
    expect(system).toMatch(/no añadas notas de «sin dato»/i);
    expect(system).toMatch(/solo para cifras/i);
    expect(system).toMatch(/no repitas la cifra fuera/i);
    expect(system).toMatch(/frase corta/i);
    expect(system).toMatch(/no atribuyas .*resultados/i);
  });

  it("no longer forbids every new number: proposed figures are allowed when marked (CA-1)", () => {
    expect(system).not.toMatch(/si hace falta un número que no está en el contexto, escribe «sin dato»/);
    expect(system).toMatch(/cifras que propongas tú .*\[propuesta: …\]/);
  });

  it("third iteration: length includes marks, «sin dato» only for measured values, context figures unmarked (CA-1)", () => {
    expect(system).toMatch(/incluye las marcas/i);
    expect(system).toMatch(/solo en campos que piden un valor medido/i);
    expect(system).toMatch(/ya están en el contexto .*sin marca/i);
    expect(aiInstructionFor(real, "north-metric")).toMatch(/150 caracteres/);
  });

  it("each field says how long the suggestion should be, and keeps the form maximum (CA-2)", () => {
    const schema = formJsonSchema(real, "value-proposition") as { properties: Record<string, { description: string }> };
    expect(schema.properties.for_whom!.description).toMatch(/150 caracteres/);
    expect(schema.properties.for_whom!.description).toMatch(/Máximo 200 caracteres/);
    expect(schema.properties.problem!.description).toMatch(/300 caracteres/);
    expect(schema.properties.problem!.description).toMatch(/Máximo 4000 caracteres/);
  });

  it("the north metric, core message and segment steps carry their own rules (CA-3)", () => {
    expect(aiInstructionFor(real, "north-metric")).toContain("[propuesta: …]");
    expect(aiInstructionFor(real, "core-message")).toMatch(/sin corchetes/i);
    expect(aiInstructionFor(real, "core-message")).toMatch(/solo .*contexto/i);
    expect(aiInstructionFor(real, "segment-list")).toMatch(/una sola frase/i);
    expect(aiInstructionFor(real, "segment-list")).toMatch(/problema distinto/i);
  });
});

describe("step instructions do not contradict the system prompt (review of SDD instrucciones-ia)", () => {
  it("no step instruction asks for brackets of its own: only [propuesta: …] and the system prompt's single check note exist", () => {
    for (const step of formSteps) {
      const text = aiInstructionFor(real, step.deliverable)!.replaceAll("[propuesta: …]", "");
      expect(text, step.id).not.toMatch(/entre corchetes/i);
      expect(text, step.id).not.toMatch(/\[/);
    }
  });

  it("differentiators say what to measure when there is no proof yet, instead of asking for a bracketed note", () => {
    expect(aiInstructionFor(real, "differentiators")).toMatch(/qué tendría que medir/i);
  });

  it("the core of rule 5 stays: no plausible but unsupported details about customers, product or market", () => {
    const { system } = buildAiRequest(real, "end-goal", new Map());
    expect(system).toMatch(/No añadas detalles sobre los clientes, el producto o el mercado que no estén en él/);
  });
});

describe("uses in the AI context (SDD plan, CA-3)", () => {
  const text = `
version: 1
name: t
profile: { id: project-profile, questions: [{ id: q, label: Q }] }
phases:
  - id: p
    title: P
    steps:
      - { id: a, title: Paso A, deliverable: da, requires: [project-profile] }
      - { id: b, title: Paso B, deliverable: db, requires: [da] }
      - { id: z, title: Paso Z, deliverable: dz, requires: [db] }
      - { id: c, title: Paso C, deliverable: dc, requires: [project-profile], uses: [dz] }
output: { id: doc, title: Doc, requires: [da] }
forms:
  da: [{ id: x, type: text, label: X }]
  db: [{ id: x, type: text, label: X }]
  dz: [{ id: x, type: text, label: X }]
  dc: [{ id: x, type: text, label: X }]
ai:
  dc: "Propón C."
  db: "Propón B."
`;
  const small = parseFramework(text);
  const done = (x: string) => ({ status: "done" as const, data: { x } });
  const base = new Map<string, { status: "done" | "in_progress"; data: Record<string, unknown> }>([
    ["project-profile", done("perfil")],
    ["da", done("contenido-a")],
    ["db", done("contenido-b")],
  ]);

  it("includes a used deliverable that is done, with its content", () => {
    const { user } = buildAiRequest(small, "dc", new Map(base).set("dz", done("contenido-z")));
    expect(user).toContain("## Paso Z");
    expect(user).toContain("contenido-z");
  });

  it("does not bring the dependencies of what it uses", () => {
    const { user } = buildAiRequest(small, "dc", new Map(base).set("dz", done("contenido-z")));
    expect(user).not.toContain("contenido-a");
    expect(user).not.toContain("contenido-b");
  });

  it("leaves out a used deliverable that is missing or only in progress", () => {
    expect(buildAiRequest(small, "dc", base).user).not.toContain("## Paso Z");
    const draft = new Map(base).set("dz", { status: "in_progress" as const, data: { x: "borrador-z" } });
    expect(buildAiRequest(small, "dc", draft).user).not.toContain("borrador-z");
  });

  it("a step without uses gets the same context as before", () => {
    const { user } = buildAiRequest(small, "db", new Map(base).set("dz", done("contenido-z")));
    expect(user).toContain("contenido-a");
    expect(user).not.toContain("contenido-z");
  });
});

describe("steps without uses keep their context (SDD plan, CA-3)", () => {
  // Every deliverable done: each step without uses must see exactly the transitive closure of its requires, as before.
  const all = new Map(
    [real.profile.id, ...allSteps(real).map((s) => s.deliverable)].map((id) => [id, { status: "done" as const, data: {} }]),
  );
  const closure = (id: string): Set<string> => {
    const found = new Set<string>();
    const visit = (d: string) => {
      for (const r of allSteps(real).find((s) => s.deliverable === d)?.requires ?? []) {
        if (!found.has(r)) {
          found.add(r);
          visit(r);
        }
      }
    };
    visit(id);
    return found;
  };
  const sections = (user: string) => [...user.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  const titleOfDeliverable = (id: string) =>
    id === real.profile.id ? "Perfil del proyecto" : allSteps(real).find((s) => s.deliverable === id)!.title;

  it.each(allSteps(real).filter((s) => aiInstructionFor(real, s.deliverable) && s.uses.length === 0).map((s) => s.deliverable))(
    "%s sees exactly the closure of its requires",
    (id) => {
      const expected = [...closure(id)].map(titleOfDeliverable).sort();
      const { user } = buildAiRequest(real, id, all);
      expect(sections(user).filter((t) => t !== `Paso: ${titleOfDeliverable(id)}`).sort()).toEqual(expected);
    },
  );
});
