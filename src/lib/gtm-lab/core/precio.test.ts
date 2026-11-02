// From gtm-lab@44f385b packages/core/src/precio.test.ts
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

// SDD precio: the pricing phase is data in the real methodology, so these tests read the real YAML.
const real = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));
const PRICING = ["value-metric", "price-approach", "packages"];
const done = (data: Record<string, unknown>) => ({ status: "done" as const, data });

const base = new Map<string, { status: "done" | "in_progress"; data: Record<string, unknown> }>([
  [
    "project-profile",
    done({
      product: "Citas",
      problem: "Llamadas",
      candidates: "Talleres",
      today: "Papel",
      edge: "WhatsApp",
      proof: "sin dato",
      goal: "20 talleres",
    }),
  ],
  ["end-goal", done({ goal: "20 talleres", horizon: "12 meses" })],
  ["north-metric", done({ metric: "Citas", definition: "Por semana" })],
  [
    "segment-list",
    done({
      segments: [
        { name: "Talleres", who: "Pequeños", problem: "Llamadas" },
        { name: "Motos", who: "Moteros", problem: "Picos" },
      ],
    }),
  ],
  [
    "segment-scores",
    done({
      rows: [
        { item: "Talleres", scores: { pain: 2, budget: 2, access: 2, fit: 2 } },
        { item: "Motos", scores: { pain: 5, budget: 4, access: 3, fit: 4 } },
      ],
    }),
  ],
  ["competitor-map", done({ alternatives: [{ name: "Papel", kind: "No hacer nada" }] })],
  ["entry-segment", done({ segment: "Motos", why: "Más dolor" })],
  [
    "assumption-map",
    done({
      rows: [
        { item: "A", scores: { importance: 5, evidence: 1 } },
        { item: "B", scores: { importance: 2, evidence: 4 } },
        { item: "C", scores: { importance: 3, evidence: 3 } },
      ],
    }),
  ],
  [
    "experiments",
    done({ experiments: [{ assumption: "Pagan", method: "Landing", success: "10 reservas" }] }),
  ],
  [
    "customer-profile",
    done({
      role: "Dueño",
      company_type: "Taller",
      company_size: "1-3",
      pains: [{ pain: "Llamadas" }],
      trigger: "Temporada",
    }),
  ],
  [
    "value-proposition",
    done({ for_whom: "Talleres", problem: "Llamadas", how: "WhatsApp", result: "Agenda llena" }),
  ],
  ["differentiators", done({ items: [{ differentiator: "Sin app", proof: "WhatsApp" }] })],
  ["core-message", done({ headline: "Titular", message: "Dos frases." })],
]);

describe("pricing phase in the framework (CA-1)", () => {
  it("sits after Cliente and before Canales, with its three steps in order", () => {
    expect(real.phases.map((p) => p.id)).toEqual([
      "direction",
      "market",
      "customer",
      "pricing",
      "channels",
      "message",
      "plan",
    ]);
    const pricing = real.phases.find((p) => p.id === "pricing");
    expect(pricing?.title).toBe("Precio");
    expect(pricing?.steps.map((s) => [s.id, s.deliverable, s.requires])).toEqual([
      ["value-metric", "value-metric", ["customer-profile", "competitor-map"]],
      ["price-approach", "price-approach", ["value-metric"]],
      ["packages", "packages", ["price-approach"]],
    ]);
  });

  it("is optional, so the strategy document does not require it (SDD §8, question 2)", () => {
    for (const step of allSteps(real).filter((s) => PRICING.includes(s.id)))
      expect(step.optional, step.id).toBe(true);
  });
});

describe("pricing forms (CA-2)", () => {
  const metric = { metric: "Citas gestionadas", why: "Crece con el uso" };
  const approach = { approach: "Según el valor que aporta al cliente", why: "Ahorra llamadas" };
  const pack = {
    name: "Básico",
    price: "[propuesta: 49 € al mes]",
    includes: "Recordatorios",
    for_whom: "Talleres pequeños",
  };

  it("accepts a complete answer for each (positive control)", () => {
    expect(validateDeliverable(real, "value-metric", metric, "done")).toEqual([]);
    expect(validateDeliverable(real, "price-approach", approach, "done")).toEqual([]);
    expect(validateDeliverable(real, "packages", { packages: [pack] }, "done")).toEqual([]);
  });

  it("price-approach only admits the three approaches", () => {
    expect(formFor(real, "price-approach")?.find((f) => f.id === "approach")).toMatchObject({
      type: "select",
      options: [
        "Según lo que cuesta producirlo",
        "Según lo que cobran las alternativas",
        "Según el valor que aporta al cliente",
      ],
    });
    expect(
      validateDeliverable(real, "price-approach", { ...approach, approach: "Al azar" }, "done"),
    ).not.toEqual([]);
  });

  it("packages admits 1 to 4 and requires its mandatory fields", () => {
    expect(validateDeliverable(real, "packages", { packages: [] }, "done")).not.toEqual([]);
    expect(
      validateDeliverable(real, "packages", { packages: Array(5).fill(pack) }, "done"),
    ).not.toEqual([]);
    expect(
      validateDeliverable(real, "packages", { packages: Array(4).fill(pack) }, "done"),
    ).toEqual([]);
    expect(
      validateDeliverable(real, "packages", { packages: [{ ...pack, price: "" }] }, "done"),
    ).not.toEqual([]);
  });

  it("value-metric rejects a missing mandatory field", () => {
    expect(validateDeliverable(real, "value-metric", { metric: "Citas" }, "done")).not.toEqual([]);
  });
});

describe("pricing progress (CA-3)", () => {
  const status = (doneIds: string[], id: string) =>
    projectProgress(real, new Set(doneIds)).steps.find((s) => s.id === id);

  it("value-metric needs customer-profile and competitor-map", () => {
    expect(status(["project-profile", "customer-profile"], "value-metric")).toMatchObject({
      status: "blocked",
      missing: ["competitor-map"],
    });
    expect(
      status(["project-profile", "customer-profile", "competitor-map"], "value-metric")?.status,
    ).toBe("available");
  });

  it("a pricing step shows done and in progress once it is saved", () => {
    const progress = projectProgress(
      real,
      new Set(["project-profile", "customer-profile", "competitor-map", "value-metric"]),
      new Set(["price-approach"]),
    );
    const of = (id: string) => progress.steps.find((s) => s.id === id)?.status;
    expect(of("value-metric")).toBe("done");
    expect(of("price-approach")).toBe("in_progress");
  });

  it("each next step waits for the previous one", () => {
    expect(status(["value-metric"], "price-approach")?.status).toBe("available");
    expect(status([], "price-approach")?.status).toBe("blocked");
    expect(status([], "packages")?.status).toBe("blocked");
    expect(status(["price-approach"], "packages")?.status).toBe("available");
  });
});

describe("pricing in the strategy document (CA-4)", () => {
  it("is ready without any pricing step", () => {
    expect(strategyDocReady(real, new Set(base.keys()))).toBe(true);
  });

  it("has a Precio section after Cliente, with only the finished deliverables", () => {
    const saved = new Map(base).set(
      "value-metric",
      done({ metric: "Citas gestionadas", why: "Crece con el uso" }),
    );
    const doc = buildStrategyDoc(real, saved, [], { name: "Demo" }, "2026-11-01T00:00:00Z");
    expect(doc.sections.map((s) => s.title)).toEqual([
      "Contexto del proyecto",
      "Rumbo",
      "Mercado",
      "Cliente",
      "Precio",
      "Canales",
      "Propuesta y mensaje",
      "Plan de 90 días",
    ]);
    expect(doc.complete).toBe(true);
    expect(doc.pending).toEqual([]);
    const md = renderMarkdown(doc);
    expect(md).toContain("Citas gestionadas");
    expect(md).not.toContain("Elige tu enfoque de precio");
  });
});

describe("AI context for pricing (CA-5)", () => {
  const saved = new Map(base)
    .set("value-metric", done({ metric: "Citas gestionadas", why: "Crece con el uso" }))
    .set(
      "price-approach",
      done({ approach: "Según el valor que aporta al cliente", why: "Ahorra llamadas" }),
    );

  it("price-approach sees value-metric and its own prerequisites, not later steps", () => {
    const request = buildAiRequest(real, "price-approach", saved);
    expect(request.user).toContain("## Elige tu métrica de valor");
    expect(request.user).toContain("Citas gestionadas");
    expect(request.user).not.toContain("## Define tus paquetes");
    const withGroup = new Map(saved).set(
      "buying-group",
      done({ people: [{ role: "Contable externo", part: "Influye" }] }),
    );
    expect(buildAiRequest(real, "price-approach", withGroup).user).not.toContain(
      "Contable externo",
    );
    expect(request.user).not.toContain("## Redacta tu mensaje base");
  });
});

describe("pricing instructions (CA-6)", () => {
  it("each step has its own rules", () => {
    const text = (id: string) => buildAiRequest(real, id, base).user;
    expect(text("value-metric")).toMatch(/unidad.*cobrar/s);
    expect(text("price-approach")).toContain("si no constan, escribe «sin dato»");
    expect(text("price-approach")).toMatch(/No inventes precios de competidores/);
    expect(text("packages")).toMatch(/\[propuesta: …\]/);
  });

  it("the general rules say prices are always proposals and third-party prices need context", () => {
    const { system } = buildAiRequest(real, "value-metric", base);
    expect(system).toContain("Los precios que propongas tú van entre [propuesta: …]");
    expect(system).toContain(
      "Los precios de terceros solo se citan, tal cual, si constan en el contexto",
    );
  });
});
