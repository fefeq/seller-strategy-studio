// From gtm-lab@44f385b packages/core/src/progress.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseFramework, projectProgress, strategyDocReady } from "./index";
import { loadFrameworkFile } from "./node";

const framework = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));

function statusOf(done: string[], id: string) {
  const progress = projectProgress(framework, new Set(done));
  const step = progress.steps.find((s) => s.id === id);
  if (!step) throw new Error(`step ${id} not found`);
  return step;
}

describe("projectProgress (CA-3)", () => {
  it("with an empty project only the profile is available", () => {
    const progress = projectProgress(framework, new Set());
    expect(progress.profile).toBe("available");
    expect(progress.steps.every((s) => s.status === "blocked")).toBe(true);
  });

  it("with the profile done, end-goal and segments open", () => {
    const progress = projectProgress(framework, new Set(["project-profile"]));
    const available = progress.steps.filter((s) => s.status === "available").map((s) => s.id);
    expect(available.sort()).toEqual(["end-goal", "segments"]);
  });

  it("entry-segment stays blocked until segment-scores and competitor-map are done", () => {
    const base = ["project-profile", "segment-list"];
    expect(statusOf([...base, "segment-scores"], "entry-segment")).toMatchObject({
      status: "blocked",
      missing: ["competitor-map"],
    });
    expect(statusOf([...base, "competitor-map"], "entry-segment")).toMatchObject({
      status: "blocked",
      missing: ["segment-scores"],
    });
    expect(statusOf([...base, "segment-scores", "competitor-map"], "entry-segment").status).toBe(
      "available",
    );
  });

  it("a step whose deliverable is done is marked done", () => {
    expect(statusOf(["project-profile", "end-goal"], "end-goal").status).toBe("done");
  });
});

describe("strategyDocReady (CA-4)", () => {
  const small = parseFramework(`
version: 1
name: t
profile: { id: project-profile, questions: [{ id: q, label: Q }] }
phases:
  - id: p
    title: P
    steps:
      - { id: a, title: A, deliverable: da, requires: [project-profile] }
      - { id: b, title: B, deliverable: db, requires: [da], optional: true }
output: { id: doc, title: Doc, requires: [da] }
`);

  it("an optional step does not block the document", () => {
    expect(strategyDocReady(small, new Set(["project-profile", "da"]))).toBe(true);
  });

  it("a mandatory step blocks the document", () => {
    expect(strategyDocReady(small, new Set(["project-profile"]))).toBe(false);
  });

  it("the real methodology is ready only when all mandatory steps are done", () => {
    const mandatory = framework.phases
      .flatMap((p) => p.steps)
      .filter((s) => !s.optional)
      .map((s) => s.deliverable);
    expect(strategyDocReady(framework, new Set(["project-profile", ...mandatory]))).toBe(true);
    expect(
      strategyDocReady(framework, new Set(["project-profile", ...mandatory.slice(1)])),
    ).toBe(false);
  });
});

describe("in-progress deliverables (CA-4)", () => {
  it("a draft does not count as done and shows as in progress", () => {
    const progress = projectProgress(framework, new Set(["project-profile"]), new Set(["end-goal"]));
    expect(progress.steps.find((s) => s.id === "end-goal")?.status).toBe("in_progress");
    expect(progress.steps.find((s) => s.id === "north-metric")?.status).toBe("blocked");
  });

  it("the profile can be in progress too", () => {
    expect(projectProgress(framework, new Set(), new Set(["project-profile"])).profile).toBe("in_progress");
  });
});

describe("a draft never bypasses its prerequisites (review finding 1)", () => {
  it("a step with a draft whose prerequisite was reopened is blocked again", () => {
    const progress = projectProgress(framework, new Set(["project-profile"]), new Set(["end-goal", "north-metric"]));
    expect(progress.steps.find((s) => s.id === "north-metric")).toMatchObject({ status: "blocked", missing: ["end-goal"] });
    expect(progress.steps.find((s) => s.id === "end-goal")?.status).toBe("in_progress"); // control
  });
});
