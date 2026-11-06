// From gtm-lab@44f385b packages/core/src/framework.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseFramework } from "./index";
import { loadFrameworkFile } from "./node";

const FRAMEWORK_PATH = new URL("../methodology/framework.yaml", import.meta.url);

// Minimal valid framework used as the positive control for each rejection case.
const valid = `
version: 1
name: test
profile:
  id: project-profile
  questions:
    - { id: product, label: "Producto" }
phases:
  - id: p1
    title: Fase 1
    steps:
      - { id: a, title: Paso A, deliverable: da, requires: [project-profile] }
      - { id: b, title: Paso B, deliverable: db, requires: [da], tool: ice }
output:
  id: doc
  title: Documento
  requires: [db]
`;

describe("loadFrameworkFile (CA-1)", () => {
  it("loads and validates the real methodology", () => {
    const framework = loadFrameworkFile(FRAMEWORK_PATH);
    expect(framework.phases).toHaveLength(7);
    expect(framework.phases.flatMap((p) => p.steps)).toHaveLength(23);
  });
});

describe("parseFramework validation (CA-2)", () => {
  it("accepts the positive control", () => {
    expect(() => parseFramework(valid)).not.toThrow();
  });

  it("rejects duplicated ids, naming the id", () => {
    const text = valid.replace("{ id: b,", "{ id: a,");
    expect(() => parseFramework(text)).toThrow(/duplicado.*"a"/);
  });

  it("rejects a requires that points to a missing deliverable", () => {
    const text = valid.replace("requires: [da]", "requires: [nope]");
    expect(() => parseFramework(text)).toThrow(/"nope"/);
  });

  it("rejects a circular dependency", () => {
    const text = valid.replace("requires: [project-profile] }", "requires: [db] }");
    expect(() => parseFramework(text)).toThrow(/circular.*"da"|circular.*"db"/);
  });

  it("rejects a step that requires its own deliverable", () => {
    const text = valid.replace("requires: [da], tool", "requires: [db], tool");
    expect(() => parseFramework(text)).toThrow(/circular.*"db"/);
  });

  it("rejects duplicated profile question ids", () => {
    const text = valid.replace(
      '- { id: product, label: "Producto" }',
      '- { id: product, label: "Producto" }\n    - { id: product, label: "Otra" }',
    );
    expect(() => parseFramework(text)).toThrow(/pregunta duplicada.*"product"/i);
  });

  it("rejects a repeated requires entry", () => {
    const text = valid.replace("requires: [da], tool", "requires: [da, da], tool");
    expect(() => parseFramework(text)).toThrow(/"b".*"da".*repetid/);
  });

  it("rejects an output that requires an optional step's deliverable", () => {
    const text = valid.replace("tool: ice }", "tool: ice, optional: true }");
    expect(() => parseFramework(text)).toThrow(/opcional.*"db"/);
  });

  it("rejects an unknown tool, naming it", () => {
    const text = valid.replace("tool: ice", "tool: magic");
    expect(() => parseFramework(text)).toThrow(/"magic"/);
  });

  it("rejects a step without deliverable", () => {
    const text = valid.replace(", deliverable: da", "");
    expect(() => parseFramework(text)).toThrow(/deliverable/);
  });

  it("reports malformed YAML with its line, not a stack trace", () => {
    expect(() => parseFramework("phases:\n  - id: [unclosed\n")).toThrow(/línea \d+/);
  });
});

describe("uses (SDD plan, CA-2)", () => {
  // Step c reads da without depending on it.
  const withUses = (uses: string, requires = "[db]") =>
    valid.replace(
      "output:",
      `      - { id: c, title: Paso C, deliverable: dc, requires: ${requires}, uses: ${uses} }\noutput:`,
    );

  it("accepts a valid uses (positive control)", () => {
    const framework = parseFramework(withUses("[da]"));
    expect(framework.phases[0]?.steps.find((s) => s.id === "c")?.uses).toEqual(["da"]);
  });

  it("a step without uses has an empty list", () => {
    expect(parseFramework(valid).phases[0]?.steps[0]?.uses).toEqual([]);
  });

  it.each([
    ["an unknown deliverable", withUses("[nope]"), /"c".*"nope"/],
    ["its own deliverable", withUses("[dc]"), /"c".*"dc"/],
    ["a deliverable already in requires", withUses("[db]"), /"c".*"db".*requires/],
    ["a repeated entry", withUses("[da, da]"), /"c".*"da".*repetid/],
  ])("rejects %s, naming the id", (_case, text, error) => {
    expect(() => parseFramework(text)).toThrow(error);
  });

  it("uses does not create a dependency cycle (a step may read a deliverable that depends on it later)", () => {
    expect(() => parseFramework(withUses("[db]", "[da]"))).not.toThrow();
  });
});
