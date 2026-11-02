// From gtm-lab@44f385b packages/core/src/forms.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allSteps, formFor, parseFramework, pruneDeliverable, validateDeliverable } from "./index";
import { loadFrameworkFile } from "./node";

const real = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));

const base = `
version: 1
name: t
profile:
  id: project-profile
  questions:
    - { id: product, label: "Producto" }
    - { id: goal, label: "Objetivo" }
phases:
  - id: p
    title: P
    steps:
      - { id: a, title: A, deliverable: da, requires: [project-profile] }
      - { id: b, title: B, deliverable: db, requires: [da], tool: ice }
output: { id: doc, title: Doc, requires: [da] }
forms:
  da:
    - { id: name, type: text, label: "Nombre", required: true }
    - { id: why, type: long_text, label: "Por qué" }
    - { id: term, type: select, label: "Plazo", options: ["6 meses", "12 meses"], required: true }
    - id: items
      type: list
      label: "Elementos"
      min: 1
      max: 2
      fields:
        - { id: title, type: text, label: "Título", required: true }
        - { id: kind, type: select, label: "Tipo", options: ["x", "y"] }
`;
const small = parseFramework(base);

describe("forms in the framework (CA-1)", () => {
  it("the real methodology loads with a form for the profile and every non-tool step", () => {
    const withoutTool = allSteps(real).filter((s) => !s.tool);
    expect(withoutTool).toHaveLength(20);
    for (const step of withoutTool)
      expect(formFor(real, step.deliverable)?.length, step.id).toBeGreaterThan(0);
    expect(formFor(real, "project-profile")).toHaveLength(7);
    expect(formFor(real, "segment-scores")).toBeUndefined();
  });

  it("accepts the positive control", () => {
    expect(() => parseFramework(base)).not.toThrow();
  });

  it.each([
    ["an unknown field type", base.replace("type: long_text", "type: rich"), /"why".*tipo/],
    [
      "a select without options",
      base.replace(', options: ["6 meses", "12 meses"]', ""),
      /"term".*opciones/,
    ],
    ["duplicated field ids", base.replace("id: why", "id: name"), /"name".*duplicad/],
    ["a list with min > max", base.replace("min: 1", "min: 3"), /"items".*min/],
    [
      "a form for a deliverable that does not exist",
      base.replace("forms:\n  da:", "forms:\n  zz:"),
      /"zz"/,
    ],
    [
      "a form for a tool deliverable",
      base.replace("forms:\n  da:", "forms:\n  db:"),
      /"db".*herramienta/,
    ],
    [
      "a list inside a list",
      base.replace(
        '- { id: kind, type: select, label: "Tipo", options: ["x", "y"] }',
        '- { id: kind, type: list, label: "Tipo", fields: [{ id: z, type: text, label: Z }] }',
      ),
      /"kind".*lista/,
    ],
    [
      "a list without subfields",
      base.replace(
        '      fields:\n        - { id: title, type: text, label: "Título", required: true }\n        - { id: kind, type: select, label: "Tipo", options: ["x", "y"] }',
        "      fields: []",
      ),
      /"items".*subcampos/,
    ],
    [
      "an empty form",
      base.replace(/forms:\n {2}da:\n[\s\S]*$/, "forms:\n  da: []\n"),
      /"da".*campos/,
    ],
    ["a field without label", base.replace('label: "Por qué"', 'label: ""'), /"why"/],
  ])("rejects %s, naming the id", (_case, text, error) => {
    expect(() => parseFramework(text)).toThrow(error);
  });
});

describe("validateDeliverable draft (CA-2)", () => {
  it("accepts an empty or partial draft, including lists below their minimum", () => {
    expect(validateDeliverable(small, "da", {}, "draft")).toEqual([]);
    expect(validateDeliverable(small, "da", { items: [] }, "draft")).toEqual([]);
    expect(
      validateDeliverable(small, "da", { name: "Algo", items: [{ title: "" }] }, "draft"),
    ).toEqual([]);
  });

  it.each([
    ["an unknown field", { other: "x" }, "other"],
    ["a number in a text field", { name: 3 }, "name"],
    ["an option that does not exist", { term: "3 años" }, "term"],
    ["a list item with an unknown subfield", { items: [{ title: "a", extra: "b" }] }, "items"],
    ["a list that is not an array", { items: "a" }, "items"],
    ["more items than max", { items: [{}, {}, {}] }, "items"],
    ["a text longer than its limit", { name: "x".repeat(201) }, "name"],
  ])("rejects %s", (_case, data, field) => {
    const errors = validateDeliverable(small, "da", data, "draft");
    expect(errors.map((e) => e.field)).toContain(field);
  });

  it("accepts empty data for a deliverable without form (tool steps)", () => {
    expect(validateDeliverable(small, "db", {}, "done")).toEqual([]);
    expect(validateDeliverable(small, "db", { x: 1 }, "draft").length).toBe(1);
  });

  it("validates the profile from its questions", () => {
    expect(validateDeliverable(small, "project-profile", { product: "P" }, "draft")).toEqual([]);
    expect(
      validateDeliverable(small, "project-profile", { product: "P" }, "done").map((e) => e.label),
    ).toEqual(["Objetivo"]);
  });
});

describe("validateDeliverable done (CA-3)", () => {
  const complete = { name: "Algo", term: "6 meses", items: [{ title: "Uno", kind: "x" }] };

  it("accepts a complete deliverable", () => {
    expect(validateDeliverable(small, "da", complete, "done")).toEqual([]);
  });

  it("names the label of every missing required field, treating blanks as empty", () => {
    const errors = validateDeliverable(small, "da", { name: "   ", items: [] }, "done");
    expect(errors.map((e) => e.label)).toEqual(["Nombre", "Plazo", "Elementos"]);
  });

  it("requires a required list even when its key is missing", () => {
    const { items: _omit, ...withoutList } = complete;
    expect(validateDeliverable(small, "da", withoutList, "done").map((e) => e.label)).toEqual([
      "Elementos",
    ]);
  });

  it("rejects a list item with an empty required subfield, naming list and subfield", () => {
    const errors = validateDeliverable(
      small,
      "da",
      { ...complete, items: [{ title: " " }] },
      "done",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]!.label).toBe("Elementos › Título");
  });

  it("rejects an unknown deliverable", () => {
    expect(() => validateDeliverable(small, "nope", {}, "draft")).toThrow(/"nope"/);
  });
});

describe("pruneDeliverable", () => {
  it("drops fields that no longer exist in the form and reports them", () => {
    const { data, dropped } = pruneDeliverable(small, "da", {
      name: "A",
      gone: "x",
      items: [{ title: "t", old: 1 }],
    });
    expect(data).toEqual({ name: "A", items: [{ title: "t" }] });
    expect(dropped).toEqual(["gone", "items.old"]);
  });
});

describe("total size (review finding 2)", () => {
  it("rejects answers above 64 KB in both modes, even when every field is within its own limit", () => {
    const segment = { name: "n".repeat(200), who: "á".repeat(4000), problem: "é".repeat(4000) };
    const data = { segments: Array.from({ length: 10 }, () => ({ ...segment })) };
    for (const mode of ["draft", "done"] as const) {
      const errors = validateDeliverable(real, "segment-list", data, mode);
      expect(errors.map((e) => e.message).join()).toMatch(/64 KB/);
    }
  });

  it("accepts a full but small list (control)", () => {
    const data = {
      segments: [1, 2].map((i) => ({ name: `S${i}`, who: "Quiénes", problem: "Problema" })),
    };
    expect(validateDeliverable(real, "segment-list", data, "done")).toEqual([]);
  });
});
