// From gtm-lab@44f385b packages/core/src/plan.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  allSteps,
  buildAiRequest,
  buildStrategyDoc,
  formFor,
  projectProgress,
  renderMarkdown,
  strategyDocReady,
  validateDeliverable,
} from "./index";
import { loadFrameworkFile } from "./node";

// SDD plan-90-dias: the plan phase is data in the real methodology, so these tests read the real YAML.
const real = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));
const PLAN = ["okr", "action-plan", "plan-review"];
const done = (data: Record<string, unknown>) => ({ status: "done" as const, data });

const base = new Map<string, { status: "done" | "in_progress"; data: Record<string, unknown> }>([
  ["project-profile", done({ product: "Citas", problem: "Llamadas", candidates: "Talleres", today: "Papel", edge: "WhatsApp", proof: "sin dato", goal: "20 talleres" })],
  ["end-goal", done({ goal: "20 talleres", horizon: "12 meses" })],
  ["north-metric", done({ metric: "Citas", definition: "Por semana" })],
  ["segment-list", done({ segments: [{ name: "Talleres", who: "Pequeños", problem: "Llamadas" }, { name: "Motos", who: "Moteros", problem: "Picos" }] })],
  ["segment-scores", done({ rows: [{ item: "Talleres", scores: { pain: 2, budget: 2, access: 2, fit: 2 } }, { item: "Motos", scores: { pain: 5, budget: 4, access: 3, fit: 4 } }] })],
  ["competitor-map", done({ alternatives: [{ name: "Papel", kind: "No hacer nada" }] })],
  ["entry-segment", done({ segment: "Motos", why: "Más dolor" })],
  ["assumption-map", done({ rows: [{ item: "A", scores: { importance: 5, evidence: 1 } }, { item: "B", scores: { importance: 2, evidence: 4 } }, { item: "C", scores: { importance: 3, evidence: 3 } }] })],
  ["experiments", done({ experiments: [{ assumption: "Pagan", method: "Landing", success: "10 reservas" }] })],
  ["customer-profile", done({ role: "Dueño", company_type: "Taller", company_size: "1-3", pains: [{ pain: "Llamadas" }], trigger: "Temporada" })],
  ["value-proposition", done({ for_whom: "Talleres", problem: "Llamadas", how: "WhatsApp", result: "Agenda llena" })],
  ["differentiators", done({ items: [{ differentiator: "Sin app", proof: "WhatsApp" }] })],
  ["core-message", done({ headline: "Titular", message: "Dos frases." })],
]);
const okr = { objective: "Cerrar los primeros talleres de pago", key_results: [{ result: "Talleres de pago", measure: "Cobros en Stripe", target: "[propuesta: 5 talleres]" }, { result: "Demos hechas", measure: "Agenda", target: "sin dato" }] };
const action = { action: "Visitar a diez talleres", when: "Semanas 1 a 4", owner: "tú" };

describe("plan phase in the framework (CA-1)", () => {
  it("is the last phase, after Propuesta y mensaje, with its three steps", () => {
    expect(real.phases.map((p) => p.id)).toEqual(["direction", "market", "customer", "pricing", "channels", "message", "plan"]);
    const plan = real.phases.find((p) => p.id === "plan");
    expect(plan?.title).toBe("Plan");
    expect(plan?.steps.map((s) => [s.id, s.deliverable, s.requires, s.uses])).toEqual([
      ["okr", "okr", ["north-metric"], []],
      ["action-plan", "action-plan", ["okr"], ["channel-choice", "experiments"]],
      ["plan-review", "plan-review", ["action-plan"], []],
    ]);
  });

  it("is optional, so the strategy document does not require it", () => {
    for (const step of allSteps(real).filter((s) => PLAN.includes(s.deliverable))) expect(step.optional, step.id).toBe(true);
  });
});

describe("uses does not block (CA-4)", () => {
  const status = (doneIds: string[], id: string) => projectProgress(real, new Set(doneIds)).steps.find((s) => s.id === id);

  it("action-plan is available once okr is done, without channel-choice or experiments", () => {
    expect(status(["okr"], "action-plan")?.status).toBe("available");
    expect(status([], "action-plan")).toMatchObject({ status: "blocked", missing: ["okr"] });
  });

  it("okr needs north-metric and each next step waits for the previous one", () => {
    expect(status([], "okr")).toMatchObject({ status: "blocked", missing: ["north-metric"] });
    expect(status(["north-metric"], "okr")?.status).toBe("available");
    expect(status(["action-plan"], "plan-review")?.status).toBe("available");
  });
});

describe("plan forms (CA-5)", () => {
  const review = { cadence: "Cada semana", reviewer: "tú", change_rule: "Si no hay ninguna demo en tres semanas" };

  it("accepts a complete answer for each (positive control)", () => {
    expect(validateDeliverable(real, "okr", okr, "done")).toEqual([]);
    expect(validateDeliverable(real, "action-plan", { actions: Array(3).fill(action) }, "done")).toEqual([]);
    expect(validateDeliverable(real, "plan-review", review, "done")).toEqual([]);
  });

  it("selects only admit their options", () => {
    expect(formFor(real, "plan-review")?.find((f) => f.id === "cadence")).toMatchObject({ type: "select", options: ["Cada semana", "Cada dos semanas", "Cada mes"] });
    expect(validateDeliverable(real, "plan-review", { ...review, cadence: "A veces" }, "done")).not.toEqual([]);
    const list = formFor(real, "action-plan")?.find((f) => f.id === "actions");
    const when = list && "fields" in list ? list.fields.find((f) => f.id === "when") : undefined;
    expect(when).toMatchObject({ type: "select", options: ["Semanas 1 a 4", "Semanas 5 a 8", "Semanas 9 a 13"] });
    expect(validateDeliverable(real, "action-plan", { actions: Array(3).fill({ ...action, when: "Pronto" }) }, "done")).not.toEqual([]);
  });

  it("okr admits 2 to 4 key results and requires the objective", () => {
    const [first] = okr.key_results;
    expect(validateDeliverable(real, "okr", { ...okr, key_results: [first] }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "okr", { ...okr, key_results: Array(5).fill(first) }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "okr", { ...okr, key_results: Array(4).fill(first) }, "done")).toEqual([]);
    expect(validateDeliverable(real, "okr", { key_results: okr.key_results }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "okr", { ...okr, key_results: [first, { ...first, target: "" }] }, "done")).not.toEqual([]);
  });

  it("action-plan admits 3 to 10 actions and requires owner", () => {
    expect(validateDeliverable(real, "action-plan", { actions: Array(2).fill(action) }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "action-plan", { actions: Array(10).fill(action) }, "done")).toEqual([]);
    expect(validateDeliverable(real, "action-plan", { actions: Array(11).fill(action) }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "action-plan", { actions: Array(3).fill({ ...action, owner: "" }) }, "done")).not.toEqual([]);
  });
});

describe("plan in the strategy document (CA-6)", () => {
  it("is ready without any plan step", () => {
    expect(strategyDocReady(real, new Set(base.keys()))).toBe(true);
  });

  it("has a Plan de 90 días section last, with only the finished deliverables", () => {
    const saved = new Map(base).set("okr", done(okr));
    const doc = buildStrategyDoc(real, saved, [], { name: "Demo" }, "2026-11-01T00:00:00Z");
    expect(doc.sections.at(-1)?.title).toBe("Plan de 90 días");
    expect(doc.complete).toBe(true);
    expect(doc.pending).toEqual([]);
    const md = renderMarkdown(doc);
    expect(md).toContain("Cerrar los primeros talleres de pago");
    expect(md).not.toContain("Reparte tus acciones");
  });
});

describe("AI context and instructions for the plan (CA-3 and CA-7)", () => {
  const saved = new Map(base)
    .set("okr", done(okr))
    .set("channel-choice", done({ choices: [{ channel: "Visitas a talleres", why: "Cercano", first_test: "Diez visitas" }, { channel: "Anuncios locales", why: "Barato", first_test: "Una campaña" }] }))
    .set("channel-scores", done({ rows: [{ item: "Visitas a talleres", scores: { closeness: 5, cost: 5, speed: 5, repeat: 5 } }] }));
  const text = (id: string, from = saved) => buildAiRequest(real, id, from).user;

  it("action-plan reads the chosen channels and the validation plan when they are done", () => {
    const user = text("action-plan");
    expect(user).toContain("## Elige tus canales");
    expect(user).toContain("Diez visitas");
    expect(user).toContain("## Planifica cómo validarlos");
  });

  it("action-plan does not read the chain behind the channels, nor unrelated steps", () => {
    const withGroup = new Map(saved).set("buying-group", done({ people: [{ role: "Contable externo", part: "Influye" }] }));
    const user = text("action-plan", withGroup);
    expect(user).not.toContain("## Puntúa los canales");
    expect(user).not.toContain("Contable externo");
  });

  it("action-plan works without channels", () => {
    const without = new Map(base).set("okr", done(okr));
    expect(text("action-plan", without)).not.toContain("## Elige tus canales");
  });

  it("each step has its own rules", () => {
    expect(text("okr")).toMatch(/de 2 a 4 resultados clave medibles/);
    expect(text("okr")).toMatch(/Cada meta numérica va como \[propuesta: …\]/);
    expect(text("action-plan")).toMatch(/entre 4 y 8 acciones/);
    expect(text("action-plan")).toMatch(/El responsable es «tú» salvo que el contexto nombre a otras personas/);
    expect(text("plan-review")).toMatch(/qué señal te haría cambiarlo/);
    expect(text("plan-review")).toMatch(/Una frase por campo; las cifras van como \[propuesta: …\]/);
  });
});
