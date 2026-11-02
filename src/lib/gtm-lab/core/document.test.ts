// From gtm-lab@44f385b packages/core/src/document.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allSteps, buildStrategyDoc, parseFramework, renderMarkdown, type Experiment } from "./index";
import { loadFrameworkFile } from "./node";

const framework = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));
const done = (data: Record<string, unknown>) => ({ status: "done" as const, data });
const project = { name: "Proyecto demo" };
const AT = "2026-10-31T12:00:00Z";

const fullScores = { pain: 5, budget: 4, access: 3, fit: 4 };
const complete = new Map<string, { status: "done" | "in_progress"; data: Record<string, unknown> }>([
  ["project-profile", done({ product: "Citas para talleres", problem: "Pierden llamadas", candidates: "Talleres", today: "Papel", edge: "WhatsApp", proof: "sin dato", goal: "20 talleres" })],
  ["end-goal", done({ goal: "20 talleres de pago", horizon: "12 meses" })],
  ["north-metric", done({ metric: "Citas confirmadas", definition: "Citas por semana" })],
  ["segment-list", done({ segments: [{ name: "Talleres", who: "Pequeños", problem: "Llamadas" }, { name: "Motos", who: "Moteros", problem: "Picos" }] })],
  ["segment-scores", done({ rows: [{ item: "Talleres", scores: { pain: 2, budget: 2, access: 2, fit: 2 } }, { item: "Motos", scores: fullScores }] })],
  ["competitor-map", done({ alternatives: [{ name: "Papel", kind: "No hacer nada" }] })],
  ["entry-segment", done({ segment: "Motos", why: "Más dolor" })],
  ["assumption-map", done({ rows: [{ item: "Pagan", scores: { importance: 5, evidence: 1 } }, { item: "Usan WhatsApp", scores: { importance: 2, evidence: 4 } }, { item: "Llaman", scores: { importance: 3, evidence: 3 } }] })],
  ["experiments", done({ experiments: [{ assumption: "Pagan", method: "Landing", success: "10 reservas" }] })],
  ["customer-profile", done({ role: "Dueño", company_type: "Taller", company_size: "1-3", pains: [{ pain: "Llamadas perdidas" }], trigger: "Temporada alta" })],
  ["value-proposition", done({ for_whom: "Talleres de motos", problem: "Llamadas", how: "WhatsApp", result: "Agenda llena" })],
  ["differentiators", done({ items: [{ differentiator: "Sin app nueva", proof: "Usa WhatsApp" }] })],
  ["core-message", done({ headline: "Tu agenda, sin llamadas perdidas", message: "Dos frases." })],
]);
const experiments: Experiment[] = [
  { title: "Landing", impact: 8, confidence: 6, ease: 9, status: "idea", createdAt: "2026-10-01T00:00:00Z" },
  { title: "Entrevistas", impact: 9, confidence: 9, ease: 9, status: "running", createdAt: "2026-10-02T00:00:00Z" },
  { title: "Encuesta", impact: 4, confidence: 8, ease: 10, status: "done", result: "8 de 10 usan WhatsApp", createdAt: "2026-10-03T00:00:00Z" },
];

describe("document structure in the framework (CA-1)", () => {
  it("covers the profile and the 23 step deliverables, in the agreed section order", () => {
    const ids = framework.document.sections.flatMap((s) => s.deliverables);
    expect(ids.sort()).toEqual(["project-profile", ...allSteps(framework).map((s) => s.deliverable)].sort());
    expect(framework.document.sections.map((s) => s.title)).toEqual([
      "Contexto del proyecto",
      "Rumbo",
      "Mercado",
      "Cliente",
      "Precio",
      "Canales",
      "Propuesta y mensaje",
      "Plan de 90 días",
    ]);
  });

  const base = `
version: 1
name: t
profile: { id: project-profile, questions: [{ id: q, label: Q }] }
phases:
  - id: p
    title: P
    steps:
      - { id: a, title: A, deliverable: da, requires: [project-profile] }
output: { id: doc, title: Doc, requires: [da] }
document:
  sections:
    - { id: s1, title: Uno, deliverables: [project-profile] }
    - { id: s2, title: Dos, deliverables: [da] }
`;
  it("accepts the positive control", () => {
    expect(() => parseFramework(base)).not.toThrow();
  });
  it.each([
    ["an unknown deliverable", base.replace("deliverables: [da]", "deliverables: [zz]"), /"zz"/],
    ["a deliverable in two sections", base.replace("deliverables: [da]", "deliverables: [project-profile]"), /"project-profile".*dos secciones/],
    ["an empty section", base.replace("deliverables: [da]", "deliverables: []"), /"s2".*sin entregables/],
  ])("rejects %s, naming the id", (_case, text, error) => {
    expect(() => parseFramework(text)).toThrow(error);
  });
});

describe("buildStrategyDoc, complete project (CA-2)", () => {
  const doc = buildStrategyDoc(framework, complete, experiments, project, AT);
  const md = renderMarkdown(doc);

  it("is complete, with every section in order and nothing pending", () => {
    expect(doc.complete).toBe(true);
    expect(doc.pending).toEqual([]);
    expect(doc.sections.map((s) => s.title)).toEqual(["Contexto del proyecto", "Rumbo", "Mercado", "Cliente", "Precio", "Canales", "Propuesta y mensaje", "Plan de 90 días"]);
  });

  it("shows each answer with its field label, lists numbered and rankings ordered", () => {
    expect(md).toContain("**Qué quieres conseguir**\n\n20 talleres de pago");
    expect(md).toContain("**¿Qué hace tu producto, en una frase?**\n\nCitas para talleres");
    expect(md).toMatch(/\*\*Segmentos\*\*\n\n1\. Nombre: Talleres · Quiénes son: Pequeños · Qué problema tienen: Llamadas\n2\. Nombre: Motos/);
    expect(md).toContain("1. Motos — Total: 16 de 20\n2. Talleres — Total: 8 de 20");
    expect(md).toContain("1. Pagan — Riesgo: 25 de 25\n2. Llaman — Riesgo: 9 de 25\n3. Usan WhatsApp — Riesgo: 4 de 25");
  });

  it("includes the backlog: open by ICE, closed with their result", () => {
    expect(md).toContain("## 9. Experimentos");
    expect(md).toContain("1. Entrevistas — ICE: 9 de 10\n2. Landing — ICE: 7,7 de 10");
    expect(md).toContain("- Encuesta — Terminado: 8 de 10 usan WhatsApp");
  });

  it("single-subfield lists show only the value, and empty fields are left out", () => {
    expect(md).toContain("**Problemas principales**\n\n1. Llamadas perdidas\n");
    expect(md).not.toContain("**Por qué es importante para ti**");
  });

  it("only uses the data it is given (CA-8)", () => {
    expect(md).not.toMatch(/undefined|null|\[object Object\]/);
  });
});

describe("buildStrategyDoc, unfinished project (CA-3)", () => {
  const partial = new Map(complete);
  partial.set("core-message", { status: "in_progress", data: { headline: "Borrador del titular" } });
  partial.delete("value-proposition");
  partial.delete("buying-group");
  partial.set("segment-list", done({ segments: [{ name: "Talleres" }, { name: "Nuevo" }] }));
  const doc = buildStrategyDoc(framework, partial, [], project, AT);
  const md = renderMarkdown(doc);

  it("leaves out drafts and missing steps, and lists the mandatory ones as pending in route order", () => {
    expect(md).not.toContain("Borrador del titular");
    expect(doc.pending).toEqual(["Escribe tu propuesta de valor", "Redacta tu mensaje base"]);
    expect(doc.complete).toBe(false);
  });

  it("a stale calculator shows a notice instead of its ranking", () => {
    expect(md).toContain("Puntuaciones desactualizadas: vuelve a puntuar.");
    expect(md).not.toContain("Motos — Total");
  });

  it("a calculator marked done without scores says so", () => {
    const legacy = new Map(complete).set("segment-scores", done({}));
    expect(renderMarkdown(buildStrategyDoc(framework, legacy, [], project, AT))).toContain("_Hecho, sin puntuaciones._");
  });

  it("a profile only in progress keeps the document incomplete", () => {
    const draftProfile = new Map(complete).set("project-profile", { status: "in_progress", data: {} });
    const doc = buildStrategyDoc(framework, draftProfile, [], project, AT);
    expect(doc.complete).toBe(false);
    expect(doc.pending[0]).toBe("Perfil del proyecto");
  });

  it("an empty backlog says so", () => {
    expect(md).toContain("Todavía no hay experimentos en el backlog.");
  });
});

describe("renderMarkdown (CA-4)", () => {
  it("is deterministic and dated", () => {
    const a = renderMarkdown(buildStrategyDoc(framework, complete, experiments, project, AT));
    const b = renderMarkdown(buildStrategyDoc(framework, new Map([...complete].reverse()), [...experiments].reverse(), project, AT));
    expect(a).toBe(b);
    expect(a).toContain("# Documento de estrategia GTM: Proyecto demo");
    expect(a).toContain("_Generado el 31/10/2026._");
    expect(a).not.toContain("Borrador: faltan pasos");
  });

  it("an incomplete document starts with the draft mark", () => {
    const md = renderMarkdown(buildStrategyDoc(framework, new Map(), [], project, AT));
    expect(md.split("\n").slice(0, 6).join("\n")).toContain("> Borrador: faltan pasos por completar.");
    expect(md).toContain("## 10. Pendiente");
  });

  it.each([
    ["a code fence with tildes", "~~~\nno es código", "\\~\\~\\~"],
    ["a code fence with backticks", "```", "\\`\\`\\`"],
    ["a horizontal rule", "---", "\\---"],
    ["a list with parenthesis", "1) uno", "1\\) uno"],
    ["a plus list", "+ más", "\\+ más"],
    ["strikethrough", "~~x~~", "\\~\\~x\\~\\~"],
    ["a table pipe", "a | b", "a \\| b"],
    ["html", "<b>x</b>", "\\<b\\>x\\</b\\>"],
    ["a backslash", "C:\\ruta", "C:\\\\ruta"],
  ])("neutralises %s in a field", (_case, input, expected) => {
    const tricky = new Map(complete).set("end-goal", done({ goal: input, horizon: "12 meses" }));
    expect(renderMarkdown(buildStrategyDoc(framework, tricky, [], project, AT))).toContain(expected);
  });

  it("escapes the project name, list items and backlog entries, and keeps list items on one line", () => {
    const tricky = new Map(complete).set("customer-profile", done({ role: "R", company_type: "T", company_size: "S", pains: [{ pain: "# uno\n\ndos" }], trigger: "x" }));
    const md = renderMarkdown(
      buildStrategyDoc(framework, tricky, [{ title: "*Exp*", impact: 5, confidence: 5, ease: 5, status: "done", result: "[r](x)" }], { name: "Mi *proyecto*" }, AT),
    );
    expect(md).toContain("# Documento de estrategia GTM: Mi \\*proyecto\\*");
    expect(md).toContain("1. \\# uno dos");
    expect(md).toContain("- \\*Exp\\* — Terminado: \\[r\\](x)");
  });

  it("escapes Markdown written by the founder", () => {
    const tricky = new Map(complete).set("end-goal", done({ goal: "# Título *falso* [link](x)\n- no es lista", horizon: "12 meses" }));
    const md = renderMarkdown(buildStrategyDoc(framework, tricky, [], project, AT));
    expect(md).toContain("\\# Título \\*falso\\* \\[link\\](x)\n\n\\- no es lista");
  });
});
