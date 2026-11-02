// From gtm-lab@44f385b packages/core/src/experiments.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { orderBacklog, planToBacklog, validateExperiment, type Experiment } from "./index";
import { loadFrameworkFile } from "./node";

const framework = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));

const valid: Experiment = { title: "Landing con precio", learning: "Si pagan", impact: 8, confidence: 6, ease: 9, status: "idea" };

describe("validateExperiment (CA-1)", () => {
  it("accepts a complete experiment, with a title of exactly 200 characters", () => {
    expect(validateExperiment(valid)).toEqual([]);
    expect(validateExperiment({ ...valid, title: "x".repeat(200) })).toEqual([]);
  });

  it.each([
    ["an empty title", { title: "  " }, "title"],
    ["a title over 200 characters", { title: "x".repeat(201) }, "title"],
    ["a missing score", { impact: null }, "impact"],
    ["a score of 0", { confidence: 0 }, "confidence"],
    ["a score of 11", { ease: 11 }, "ease"],
    ["a decimal score", { impact: 7.5 }, "impact"],
    ["an unknown status", { status: "paused" }, "status"],
    ["a result over 4000 characters", { result: "x".repeat(4001) }, "result"],
    ["a learning over 4000 characters", { learning: "x".repeat(4001) }, "learning"],
    ["an unknown field", { owner: "yo" }, "owner"],
  ])("rejects %s, naming the field", (_case, change, field) => {
    const errors = validateExperiment({ ...valid, ...change } as Experiment);
    expect(errors.map((e) => e.field)).toContain(field);
  });
});

describe("orderBacklog (CA-2)", () => {
  const at = (day: number) => `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`;
  const e = (title: string, scores: [number, number, number] | null, status: Experiment["status"], day: number): Experiment => ({
    title,
    impact: scores?.[0] ?? null,
    confidence: scores?.[1] ?? null,
    ease: scores?.[2] ?? null,
    status,
    createdAt: at(day),
  });

  it("orders open ones by ICE (ties: oldest first), unscored last, and keeps closed ones apart", () => {
    const { open, closed } = orderBacklog([
      e("low", [2, 2, 2], "idea", 1),
      e("tie-late", [7, 7, 7], "running", 5),
      e("unscored", null, "idea", 2),
      e("top", [10, 9, 8], "idea", 6),
      e("tie-early", [7, 7, 7], "idea", 3),
      e("finished", [10, 10, 10], "done", 4),
      e("dropped", [9, 9, 9], "dropped", 7),
    ]);
    expect(open.map((x) => [x.experiment.title, x.ice])).toEqual([
      ["top", 9],
      ["tie-early", 7],
      ["tie-late", 7],
      ["low", 2],
      ["unscored", null],
    ]);
    expect(closed.map((x) => x.experiment.title)).toEqual(["finished", "dropped"]);
  });

  it("unscored open ones go oldest first", () => {
    const { open } = orderBacklog([e("newer", null, "idea", 9), e("older", null, "idea", 1)]);
    expect(open.map((x) => x.experiment.title)).toEqual(["older", "newer"]);
  });
});

describe("planToBacklog (CA-3)", () => {
  const plan = new Map([
    [
      "experiments",
      {
        status: "done" as const,
        data: {
          experiments: [
            { assumption: "Pagarían 30 € al mes", method: "Landing con precio", success: "10 reservas" },
            { assumption: "Usan WhatsApp", method: "Encuesta", success: "70 % sí" },
          ],
        },
      },
    ],
  ]);

  it("creates one unscored idea per planned experiment, marked as coming from the plan", () => {
    expect(planToBacklog(framework, plan, [])).toEqual([
      { title: "Pagarían 30 € al mes", learning: "Cómo: Landing con precio\nLo confirma: 10 reservas", impact: null, confidence: null, ease: null, status: "idea", source: "plan" },
      { title: "Usan WhatsApp", learning: "Cómo: Encuesta\nLo confirma: 70 % sí", impact: null, confidence: null, ease: null, status: "idea", source: "plan" },
    ]);
  });

  it("does not import twice what is already in the backlog", () => {
    const existing: Experiment[] = [{ ...valid, title: "Pagarían 30 € al mes", source: "plan" }];
    expect(planToBacklog(framework, plan, existing).map((x) => x.title)).toEqual(["Usan WhatsApp"]);
  });

  it("cuts long assumptions to the 200-character title limit", () => {
    const long = new Map([["experiments", { status: "done" as const, data: { experiments: [{ assumption: "a".repeat(300), method: "m", success: "s" }] } }]]);
    expect(planToBacklog(framework, long, [])[0]!.title).toHaveLength(200);
  });

  it("a title cut at a space has no trailing space, so a second import adds nothing (review finding 1)", () => {
    const assumption = "a".repeat(199) + " b";
    const first = planToBacklog(framework, new Map([["experiments", { status: "done" as const, data: { experiments: [{ assumption, method: "m", success: "s" }] } }]]), []);
    expect(first[0]!.title).toBe("a".repeat(199));
    const again = planToBacklog(framework, new Map([["experiments", { status: "done" as const, data: { experiments: [{ assumption, method: "m", success: "s" }] } }]]), [{ ...valid, title: first[0]!.title }]);
    expect(again).toEqual([]);
  });

  it("caps «what you want to learn» at 4000 characters, so the import never breaks the database limit (finding 2)", () => {
    const long = new Map([["experiments", { status: "done" as const, data: { experiments: [{ assumption: "A", method: "m".repeat(4000), success: "s".repeat(4000) }] } }]]);
    const [row] = planToBacklog(framework, long, []);
    expect(row!.learning!.length).toBe(4000);
    expect(validateExperiment({ ...row!, impact: 1, confidence: 1, ease: 1 })).toEqual([]);
  });

  it("the same assumption twice in the plan is imported once", () => {
    const twice = new Map([["experiments", { status: "done" as const, data: { experiments: [{ assumption: "A" }, { assumption: "A" }] } }]]);
    expect(planToBacklog(framework, twice, [])).toHaveLength(1);
  });

  it("returns nothing without a saved plan", () => {
    expect(planToBacklog(framework, new Map(), [])).toEqual([]);
  });
});
