// From gtm-lab@44f385b packages/core/src/tools.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseFramework, scoreTool, toolFor, toolRows, validateDeliverable, validateToolData } from "./index";
import { loadFrameworkFile } from "./node";

const real = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));
const segmentTool = toolFor(real, "segment-scores")!;
const assumptionTool = toolFor(real, "assumption-map")!;

const full = (pain: number, budget: number, access: number, fit: number) => ({ pain, budget, access, fit });
const done = (data: Record<string, unknown>) => ({ status: "done" as const, data });

describe("tools in the framework (CA-1)", () => {
  it("the real methodology has both tools with their criteria", () => {
    expect(segmentTool.spec.formula).toBe("sum");
    expect(segmentTool.spec.criteria.map((c) => c.id)).toEqual(["pain", "budget", "access", "fit"]);
    expect(assumptionTool.spec.formula).toBe("risk");
    expect(assumptionTool.spec.rows).toMatchObject({ min: 3, max: 15 });
    expect(toolFor(real, "end-goal")).toBeUndefined();
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
      - { id: b, title: B, deliverable: db, requires: [da], tool: segment-score }
output: { id: doc, title: Doc, requires: [db] }
forms:
  da:
    - id: items
      type: list
      label: Items
      fields: [{ id: name, type: text, label: Nombre }]
tools:
  segment-score:
    formula: sum
    rows: { from: da, list: items, item: name, label: Item }
    criteria:
      - { id: x, label: X }
      - { id: y, label: Y }
`;

  it("accepts the positive control", () => {
    expect(() => parseFramework(base)).not.toThrow();
  });

  it.each([
    ["an unknown formula", base.replace("formula: sum", "formula: avg"), /"segment-score".*fórmula/],
    ["duplicated criteria", base.replace("{ id: y, label: Y }", "{ id: x, label: Y }"), /"x".*duplicad/],
    ["a tool no step uses", base.replace("tool: segment-score", "tool: ice"), /"segment-score".*ningún paso/],
    ["a source that is not a prerequisite", base.replace("requires: [da], tool", "requires: [project-profile], tool"), /"da".*no es un requisito/],
    ["a source that is not a list field", base.replace("list: items", "list: nope"), /"nope".*lista/],
    ["an item that is not a subfield", base.replace("item: name", "item: nope"), /"nope".*subcampo/],
    ["risk without importance and evidence", base.replace("formula: sum", "formula: risk"), /importance.*evidence/],
    ["free rows with min > max", base.replace("rows: { from: da, list: items, item: name, label: Item }", "rows: { free: true, label: Item, min: 5, max: 2 }"), /min.*max/],
    ["a step tool without spec", base.replace(/tools:[\s\S]*$/, ""), /"segment-score".*sin definición/],
  ])("rejects %s, naming the id", (_case, text, error) => {
    expect(() => parseFramework(text)).toThrow(error);
  });
});

describe("sum formula (CA-2)", () => {
  it("adds the criteria, ranks high to low, keeps list order on ties and puts unscored rows last", () => {
    const ranked = scoreTool(segmentTool.spec, [
      { item: "A", scores: full(3, 3, 3, 3) },
      { item: "B", scores: { pain: 5 } },
      { item: "C", scores: full(5, 5, 4, 4) },
      { item: "D", scores: full(4, 3, 3, 2) },
    ]);
    expect(ranked.map((r) => [r.item, r.total])).toEqual([
      ["C", 18],
      ["A", 12],
      ["D", 12],
      ["B", null],
    ]);
    expect(ranked.map((r) => r.index)).toEqual([2, 0, 3, 1]);
  });
});

describe("risk formula (CA-3)", () => {
  it("is importance × (6 − evidence), ranks high to low, ties by importance then order", () => {
    const ranked = scoreTool(assumptionTool.spec, [
      { item: "low", scores: { importance: 1, evidence: 5 } },
      { item: "tie-less-important", scores: { importance: 2, evidence: 1 } },
      { item: "top", scores: { importance: 5, evidence: 1 } },
      { item: "tie-more-important", scores: { importance: 5, evidence: 4 } },
    ]);
    expect(ranked.map((r) => [r.item, r.total])).toEqual([
      ["top", 25],
      ["tie-more-important", 10],
      ["tie-less-important", 10],
      ["low", 1],
    ]);
  });
});

describe("validateToolData (CA-4)", () => {
  it("draft accepts partial scores and rejects out-of-range, decimals, unknown criteria and fields", () => {
    expect(validateToolData(real, "segment-scores", { rows: [{ item: "A", scores: { pain: 2 } }] }, "draft")).toEqual([]);
    const bad = (rows: unknown, extra: Record<string, unknown> = {}) =>
      validateToolData(real, "segment-scores", { rows, ...extra }, "draft").length;
    expect(bad([{ item: "A", scores: { pain: 6 } }])).toBeGreaterThan(0);
    expect(bad([{ item: "A", scores: { pain: 2.5 } }])).toBeGreaterThan(0);
    expect(bad([{ item: "A", scores: { magic: 2 } }])).toBeGreaterThan(0);
    expect(bad([{ item: "A", scores: {}, other: 1 }])).toBeGreaterThan(0);
    expect(bad([], { extra: 1 })).toBeGreaterThan(0);
    expect(bad([{ item: "A", scores: null }])).toBeGreaterThan(0);
    expect(bad([{ item: "A", scores: {}, note: 3 }])).toBeGreaterThan(0);
    expect(bad([{ item: "A", scores: {}, note: "x".repeat(4001) }])).toBeGreaterThan(0);
    expect(bad([{ item: "A", scores: {}, note: "Una nota" }])).toBe(0);
  });

  it("done requires every row fully scored, naming row and criterion", () => {
    const errors = validateToolData(
      real,
      "segment-scores",
      { rows: [{ item: "Talleres", scores: full(1, 2, 3, 4) }, { item: "Motos", scores: { pain: 3 } }] },
      "done",
    );
    expect(errors.map((e) => e.label)).toEqual(["Motos › Capacidad de pago", "Motos › Acceso", "Motos › Encaje"]);
  });

  it("assumptions need 3 to 15 rows with text when done", () => {
    const row = (item: string) => ({ item, scores: { importance: 3, evidence: 2 } });
    expect(validateToolData(real, "assumption-map", { rows: [row("a"), row("b")] }, "done").length).toBeGreaterThan(0);
    expect(validateToolData(real, "assumption-map", { rows: [row("a"), row("b"), row(" ")] }, "done").length).toBeGreaterThan(0);
    expect(validateToolData(real, "assumption-map", { rows: [row("a"), row("b"), row("c")] }, "done")).toEqual([]);
    const sixteen = Array.from({ length: 16 }, (_, i) => row(`s${i}`));
    expect(validateToolData(real, "assumption-map", { rows: sixteen }, "draft").length).toBeGreaterThan(0);
  });

  it("validateDeliverable delegates to the tool, so the app and the function apply the same rules", () => {
    expect(validateDeliverable(real, "segment-scores", { rows: [{ item: "A", scores: { pain: 9 } }] }, "draft")).not.toEqual([]);
    expect(validateDeliverable(real, "segment-scores", { rows: [{ item: "A", scores: full(1, 1, 1, 1) }] }, "done")).toEqual([]);
  });
});

describe("toolRows (CA-5)", () => {
  const segments = (...names: string[]) =>
    new Map([["segment-list", done({ segments: names.map((name) => ({ name, who: "w", problem: "p" })) })]]);

  it("rows follow the segment list: new ones unscored, removed or renamed ones dropped, and it says so", () => {
    const saved = { rows: [{ item: "Talleres", scores: full(1, 1, 1, 1) }, { item: "Viejo", scores: full(2, 2, 2, 2) }] };
    const result = toolRows(real, "segment-scores", segments("Talleres", "Motos"), saved);
    expect(result.rows).toEqual([
      { item: "Talleres", scores: full(1, 1, 1, 1) },
      { item: "Motos", scores: {} },
    ]);
    expect(result.changed).toBe(true);
  });

  it("adding a segment alone is a change", () => {
    const saved = { rows: [{ item: "Talleres", scores: { pain: 2 } }] };
    expect(toolRows(real, "segment-scores", segments("Talleres", "Motos"), saved).changed).toBe(true);
  });

  it("duplicated names keep their scores by occurrence and are reported", () => {
    const saved = { rows: [{ item: "Talleres", scores: { pain: 1 } }, { item: "Talleres", scores: { pain: 2 } }] };
    const result = toolRows(real, "segment-scores", segments("Talleres", "Talleres"), saved);
    expect(result.rows.map((r) => r.scores.pain)).toEqual([1, 2]);
    expect(result.duplicates).toEqual(["Talleres"]);
    expect(toolRows(real, "segment-scores", segments("A", "B"), {}).duplicates).toEqual([]);
  });

  it("an unchanged list keeps the rows and reports no change (control)", () => {
    const saved = { rows: [{ item: "Talleres", scores: { pain: 2 } }] };
    const result = toolRows(real, "segment-scores", segments("Talleres"), saved);
    expect(result).toEqual({ rows: saved.rows, changed: false, duplicates: [] });
  });

  it("a first visit with no saved rows is not reported as a change", () => {
    expect(toolRows(real, "segment-scores", segments("A", "B"), {}).changed).toBe(false);
  });

  it("free rows (assumptions) are the saved ones", () => {
    const saved = { rows: [{ item: "Pagan por esto", scores: {} }] };
    expect(toolRows(real, "assumption-map", new Map(), saved)).toEqual({ rows: saved.rows, changed: false, duplicates: [] });
  });
});
