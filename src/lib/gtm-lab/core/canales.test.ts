// From gtm-lab@44f385b packages/core/src/canales.test.ts
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
  toolFor,
  toolRows,
  validateDeliverable,
} from "./index";
import { loadFrameworkFile } from "./node";

// SDD canales: the channels phase is data in the real methodology, so these tests read the real YAML.
const real = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));
const CHANNELS = ["growth-engine", "channel-list", "channel-scores", "channel-choice"];
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
const engine = { engine: "Contactas tú a cada cliente", why: "Pocos clientes y de alto valor" };
const channelList = {
  channels: [
    { name: "Visitas a talleres", how: "Voy en persona" },
    { name: "Grupos de WhatsApp de gremio", how: "Participo en ellos" },
    { name: "Anuncios locales", how: "Pago por clic en la ciudad" },
  ],
};
const scoreRow = (item: string, n: number) => ({ item, scores: { closeness: n, cost: n, speed: n, repeat: n } });
const channelScores = { rows: [scoreRow("Visitas a talleres", 5), scoreRow("Grupos de WhatsApp de gremio", 3), scoreRow("Anuncios locales", 2)] };

describe("channels phase in the framework (CA-1)", () => {
  it("sits between Precio and Propuesta y mensaje with its four steps in order", () => {
    expect(real.phases.map((p) => p.id)).toEqual(["direction", "market", "customer", "pricing", "channels", "message", "plan"]);
    const channels = real.phases.find((p) => p.id === "channels");
    expect(channels?.title).toBe("Canales");
    expect(channels?.steps.map((s) => [s.id, s.deliverable, s.requires, s.tool])).toEqual([
      ["growth-engine", "growth-engine", ["customer-profile"], undefined],
      ["channel-list", "channel-list", ["growth-engine"], undefined],
      ["channel-scores", "channel-scores", ["channel-list"], "channel-score"],
      ["channel-choice", "channel-choice", ["channel-scores"], undefined],
    ]);
  });

  it("is optional, so the strategy document does not require it", () => {
    for (const step of allSteps(real).filter((s) => CHANNELS.includes(s.deliverable))) expect(step.optional, step.id).toBe(true);
  });
});

describe("channels forms (CA-2)", () => {
  const choice = { channel: "Visitas a talleres", why: "Es el más cercano", first_test: "Visitar a diez talleres" };

  it("accepts a complete answer for each (positive control)", () => {
    expect(validateDeliverable(real, "growth-engine", engine, "done")).toEqual([]);
    expect(validateDeliverable(real, "channel-list", channelList, "done")).toEqual([]);
    expect(validateDeliverable(real, "channel-choice", { choices: [choice, choice] }, "done")).toEqual([]);
  });

  it("growth-engine only admits its three options and requires the mandatory fields", () => {
    expect(formFor(real, "growth-engine")?.find((f) => f.id === "engine")).toMatchObject({
      type: "select",
      options: ["El propio producto atrae clientes", "Atraes con contenido y publicidad", "Contactas tú a cada cliente"],
    });
    expect(validateDeliverable(real, "growth-engine", { ...engine, engine: "Al azar" }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "growth-engine", { engine: engine.engine }, "done")).not.toEqual([]);
  });

  it("channel-list requires the name and how of each channel", () => {
    const [first, second, third] = channelList.channels;
    expect(validateDeliverable(real, "channel-list", { channels: [first, second, { name: "Alianzas" }] }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "channel-list", { channels: [first, second, { ...third, name: "" }] }, "done")).not.toEqual([]);
  });

  it("channel-list admits 3 to 8 channels in done mode", () => {
    const channel = channelList.channels[0];
    expect(validateDeliverable(real, "channel-list", { channels: channelList.channels.slice(0, 2) }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "channel-list", { channels: Array(8).fill(channel) }, "done")).toEqual([]);
    expect(validateDeliverable(real, "channel-list", { channels: Array(9).fill(channel) }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "channel-list", { channels: channelList.channels.slice(0, 2) }, "draft")).toEqual([]);
  });

  it("channel-choice admits 2 to 3 and requires the first test", () => {
    expect(validateDeliverable(real, "channel-choice", { choices: [choice] }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "channel-choice", { choices: Array(4).fill(choice) }, "done")).not.toEqual([]);
    expect(validateDeliverable(real, "channel-choice", { choices: Array(3).fill(choice) }, "done")).toEqual([]);
    expect(validateDeliverable(real, "channel-choice", { choices: [choice, { ...choice, first_test: "" }] }, "done")).not.toEqual([]);
  });
});

describe("channel-score tool (CA-3)", () => {
  const saved = new Map(base).set("growth-engine", done(engine)).set("channel-list", done(channelList));

  it("is a sum calculator with four criteria, whose rows come from the channel list", () => {
    const tool = toolFor(real, "channel-scores");
    expect(tool?.id).toBe("channel-score");
    expect(tool?.spec.formula).toBe("sum");
    expect(tool?.spec.criteria.map((c) => c.id)).toEqual(["closeness", "cost", "speed", "repeat"]);
  });

  it("a new channel appears unscored and a deleted one disappears", () => {
    const first = toolRows(real, "channel-scores", saved, channelScores);
    expect(first.rows.map((r) => r.item)).toEqual(["Visitas a talleres", "Grupos de WhatsApp de gremio", "Anuncios locales"]);
    const edited = new Map(saved).set("channel-list", done({ channels: [...channelList.channels.slice(0, 2), { name: "Alianzas", how: "Con gestorías" }] }));
    const next = toolRows(real, "channel-scores", edited, channelScores);
    expect(next.rows.map((r) => r.item)).toEqual(["Visitas a talleres", "Grupos de WhatsApp de gremio", "Alianzas"]);
    expect(next.changed).toBe(true);
    expect(next.rows[2]?.scores).toEqual({});
  });

  it("a stale ranking does not reach the AI context of channel-choice", () => {
    const stale = new Map(saved).set("channel-scores", done({ rows: [scoreRow("Visitas a talleres", 5), scoreRow("Borrado", 1)] }));
    const { user } = buildAiRequest(real, "channel-choice", stale);
    expect(user).toContain("puntuaciones desactualizadas");
    expect(user).not.toContain("Total: 20 de 20");
  });

  it("the ranking reaches the AI context of channel-choice", () => {
    const withScores = new Map(saved).set("channel-scores", done(channelScores));
    const { user } = buildAiRequest(real, "channel-choice", withScores);
    expect(user).toContain("1. Visitas a talleres — Total: 20 de 20");
  });
});

describe("channels progress (CA-4)", () => {
  const status = (doneIds: string[], id: string, inProgress: string[] = []) =>
    projectProgress(real, new Set(doneIds), new Set(inProgress)).steps.find((s) => s.id === id);

  it("growth-engine needs customer-profile and each next step waits for the previous one", () => {
    expect(status(["project-profile"], "growth-engine")).toMatchObject({ status: "blocked", missing: ["customer-profile"] });
    expect(status(["project-profile", "customer-profile"], "growth-engine")?.status).toBe("available");
    expect(status([], "channel-list")?.status).toBe("blocked");
    expect(status(["growth-engine"], "channel-list")?.status).toBe("available");
    expect(status(["channel-list"], "channel-scores")?.status).toBe("available");
    expect(status(["channel-scores"], "channel-choice")?.status).toBe("available");
  });

  it("shows done and in progress once saved", () => {
    expect(status(["growth-engine"], "growth-engine")?.status).toBe("done");
    expect(status(["growth-engine"], "channel-list", ["channel-list"])?.status).toBe("in_progress");
  });
});

describe("channels in the strategy document (CA-5)", () => {
  it("is ready without any channels step", () => {
    expect(strategyDocReady(real, new Set(base.keys()))).toBe(true);
  });

  it("has a Canales section after Precio, with only the finished deliverables", () => {
    const saved = new Map(base).set("growth-engine", done(engine));
    const doc = buildStrategyDoc(real, saved, [], { name: "Demo" }, "2026-11-01T00:00:00Z");
    expect(doc.sections.map((s) => s.title)).toEqual(["Contexto del proyecto", "Rumbo", "Mercado", "Cliente", "Precio", "Canales", "Propuesta y mensaje", "Plan de 90 días"]);
    expect(doc.complete).toBe(true);
    expect(doc.pending).toEqual([]);
    const md = renderMarkdown(doc);
    expect(md).toContain("Contactas tú a cada cliente");
    expect(md).not.toContain("Lista tus canales candidatos");
  });
});

describe("AI context for channels (CA-6)", () => {
  const saved = new Map(base).set("growth-engine", done(engine)).set("channel-list", done(channelList));

  it("channel-list sees growth-engine and the customer, not later steps or unrelated ones", () => {
    const withGroup = new Map(saved)
      .set("buying-group", done({ people: [{ role: "Contable externo", part: "Influye" }] }))
      .set("channel-choice", done({ choices: [{ channel: "Visitas a talleres", why: "Cercano", first_test: "Diez visitas" }, { channel: "Anuncios locales", why: "Barato", first_test: "Una campaña" }] }));
    const { user } = buildAiRequest(real, "channel-list", withGroup);
    expect(user).toContain("## Elige tu motor de crecimiento");
    expect(user).toContain("Contactas tú a cada cliente");
    expect(user).toContain("Dueño");
    expect(user).not.toContain("Contable externo");
    expect(user).not.toContain("## Elige tus canales");
  });
});

describe("channels instructions (CA-7)", () => {
  const text = (id: string) => buildAiRequest(real, id, new Map(base).set("growth-engine", done(engine)).set("channel-list", done(channelList)).set("channel-scores", done(channelScores))).user;

  it("each AI step has its own rules", () => {
    expect(text("growth-engine")).toMatch(/Una sola opción/);
    expect(text("growth-engine")).toMatch(/Apóyate en el cliente inicial\./);
    expect(text("growth-engine")).not.toMatch(/en el precio/);
    expect(text("channel-list")).toMatch(/entre 3 y 6 canales/);
    expect(text("channel-list")).toMatch(/Sin cifras de alcance ni de coste/);
    expect(text("channel-choice")).toMatch(/2 o 3 canales/);
    expect(text("channel-choice")).toMatch(/primera prueba barata y concreta/);
    expect(text("channel-choice")).toMatch(/empezando por los mejor puntuados salvo que haya una razón clara/);
    expect(text("channel-choice")).toMatch(/Sin cifras de coste ni de resultados/);
  });

  it("the calculator has no AI help", () => {
    expect(() => buildAiRequest(real, "channel-scores", base)).toThrow(/no tiene ayuda de IA/);
  });
});
