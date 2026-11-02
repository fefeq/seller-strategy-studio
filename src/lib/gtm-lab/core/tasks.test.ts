// From gtm-lab@44f385b packages/core/src/tasks.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseFramework,
  parseTasks,
  summarizeTasks,
  TASK_DURATIONS,
  TASK_KINDS,
  TASK_STAGES,
  taskStatus,
  tasksProblem,
  type TaskStatus,
} from "./index";
import { loadFrameworkFile, loadTasksFile } from "./node";

const FRAMEWORK_PATH = new URL("../methodology/framework.yaml", import.meta.url);
const TASKS_PATH = new URL("../methodology/tasks.yaml", import.meta.url);

const framework = parseFramework(`
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
      - { id: b, title: Paso B, deliverable: db, requires: [da] }
output:
  id: doc
  title: Documento
  requires: [db]
`);

// Minimal valid catalogue used as the positive control for each rejection case.
const valid = `
categories:
  - { id: c1, title: Categoría uno }
  - { id: c2, title: Categoría dos }
tasks:
  - { id: t1, title: Tarea uno, summary: Qué se hace y qué queda., stage: before, category: c1, kind: decision, duration: hours, step: a }
  - { id: t2, title: Tarea dos, summary: Otra cosa distinta., stage: launch, category: c2, kind: habit, needs: [da] }
  - { id: t3, title: Tarea tres, summary: Una tercera., stage: after, category: c2, kind: quick, postin: true }
`;

const withTask = (extra: string) => valid.replace("tasks:\n", `tasks:\n${extra}\n`);

describe("parseTasks (CA-1)", () => {
  it("accepts the positive control and applies defaults", () => {
    const catalog = parseTasks(valid);
    expect(catalog.categories).toHaveLength(2);
    expect(catalog.tasks.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(catalog.tasks[0]).toMatchObject({ step: "a", needs: [], postin: false });
    expect(catalog.tasks[1]).toMatchObject({ needs: ["da"], postin: false });
    expect(catalog.tasks[1]?.duration).toBeUndefined();
    expect(catalog.tasks[2]?.postin).toBe(true);
  });

  it("exposes the allowed values", () => {
    expect(TASK_STAGES).toEqual(["before", "launch", "after"]);
    expect(TASK_KINDS).toEqual(["decision", "workshop", "framework", "guide", "habit", "campaign", "analysis", "quick"]);
    expect(TASK_DURATIONS).toEqual(["hour", "hours", "day", "days", "weeks", "month", "ongoing"]);
  });

  it("rejects a repeated task id, naming it", () => {
    expect(() => parseTasks(withTask("  - { id: t1, title: Otra, summary: Algo., stage: before, category: c1, kind: quick }"))).toThrow(/t1/);
  });

  it("rejects a repeated category id, naming it", () => {
    expect(() => parseTasks(valid.replace("id: c2,", "id: c1,"))).toThrow(/c1/);
  });

  it.each([
    ["stage", "stage: before", "stage: someday"],
    ["category", "category: c1", "category: nope"],
    ["kind", "kind: decision", "kind: ritual"],
    ["duration", "duration: hours", "duration: forever"],
  ])("rejects an unknown %s, naming the task", (_, from, to) => {
    expect(() => parseTasks(valid.replace(from, to))).toThrow(/t1/);
  });

  it("rejects a task without title or summary, naming it", () => {
    expect(() => parseTasks(valid.replace("title: Tarea uno,", 'title: "  ",'))).toThrow(/t1/);
    expect(() => parseTasks(valid.replace("summary: Qué se hace y qué queda.,", 'summary: "",'))).toThrow(/t1/);
  });

  it("rejects a repeated title, naming the task", () => {
    expect(() => parseTasks(valid.replace("title: Tarea dos", "title: Tarea uno"))).toThrow(/t2/);
  });

  it("rejects invalid YAML with the line", () => {
    expect(() => parseTasks("tasks: [")).toThrow(/YAML inválido/);
  });
});

describe("tasksProblem (CA-2)", () => {
  it("accepts a catalogue whose links exist", () => {
    expect(tasksProblem(parseTasks(valid), framework)).toBeNull();
    // The project profile is a deliverable too.
    const withProfile = withTask("  - { id: t0, title: Cero, summary: Cero., stage: before, category: c1, kind: quick, needs: [project-profile] }");
    expect(tasksProblem(parseTasks(withProfile), framework)).toBeNull();
  });

  it("rejects a step that does not exist, naming it", () => {
    const problem = tasksProblem(parseTasks(valid.replace("step: a", "step: zz")), framework);
    expect(problem).toMatch(/t1/);
    expect(problem).toMatch(/zz/);
  });

  it("rejects a needed deliverable that does not exist, naming it", () => {
    const problem = tasksProblem(parseTasks(valid.replace("needs: [da]", "needs: [nada]")), framework);
    expect(problem).toMatch(/t2/);
    expect(problem).toMatch(/nada/);
  });
});

describe("taskStatus (CA-3)", () => {
  const [t1, t2] = parseTasks(valid).tasks;
  const none = new Map<string, "in_progress" | "done" | "dropped">();

  it("derives the status of a task with a step from its deliverable, ignoring saved rows", () => {
    expect(taskStatus(t1!, framework, new Set(["da"]), none)).toBe("done");
    expect(taskStatus(t1!, framework, new Set(), none)).toBe("pending");
    expect(taskStatus(t1!, framework, new Set(), new Map([["t1", "done"]]))).toBe("pending");
    expect(taskStatus(t1!, framework, new Set(["da"]), new Map([["t1", "dropped"]]))).toBe("done");
  });

  it("takes the saved status of a task without a step, or pending", () => {
    expect(taskStatus(t2!, framework, new Set(), none)).toBe("pending");
    expect(taskStatus(t2!, framework, new Set(), new Map([["t2", "in_progress"]]))).toBe("in_progress");
    expect(taskStatus(t2!, framework, new Set(), new Map([["t2", "dropped"]]))).toBe("dropped");
    // Finishing the deliverable it only needs does not complete it.
    expect(taskStatus(t2!, framework, new Set(["da"]), none)).toBe("pending");
  });

  it("does not fail or show anything for a saved row of a task that left the catalogue", () => {
    const catalog = parseTasks(valid);
    const saved = new Map<string, "in_progress" | "done" | "dropped">([["gone", "done"]]);
    const statuses = new Map(catalog.tasks.map((t) => [t.id, taskStatus(t, framework, new Set(), saved)]));
    expect(statuses.has("gone")).toBe(false);
    // Even if a stray id reaches the map, the summary only counts catalogue tasks.
    statuses.set("gone", "done");
    expect(summarizeTasks(catalog, statuses).total).toBe(3);
    expect(summarizeTasks(catalog, statuses).done).toBe(0);
  });
});

describe("summarizeTasks (CA-4)", () => {
  const catalog = parseTasks(
    valid + "  - { id: t4, title: Cuatro, summary: Cuarta., stage: after, category: c2, kind: quick }\n",
  );
  const statuses = new Map<string, TaskStatus>([
    ["t1", "done"],
    ["t2", "in_progress"],
    ["t3", "dropped"],
    ["t4", "pending"],
  ]);

  it("counts by stage and category, leaving dropped tasks out of the total", () => {
    const summary = summarizeTasks(catalog, statuses);
    expect(summary.byStage.before).toEqual({ done: 1, inProgress: 0, pending: 0, dropped: 0, total: 1 });
    expect(summary.byStage.launch).toEqual({ done: 0, inProgress: 1, pending: 0, dropped: 0, total: 1 });
    expect(summary.byStage.after).toEqual({ done: 0, inProgress: 0, pending: 1, dropped: 1, total: 1 });
    expect(summary.byCategory.c1?.done).toBe(1);
    expect(summary.byCategory.c2).toEqual({ done: 0, inProgress: 1, pending: 1, dropped: 1, total: 2 });
    expect(summary.total).toBe(3);
    expect(summary.done).toBe(1);
  });

  it("treats a task without a status as pending", () => {
    const summary = summarizeTasks(catalog, new Map());
    expect(summary.pending).toBe(4);
    expect(summary.total).toBe(4);
  });
});

describe("the real catalogue (CA-5)", () => {
  const real = loadTasksFile(TASKS_PATH);
  const realFramework = loadFrameworkFile(FRAMEWORK_PATH);

  it("loads and validates against the real framework", () => {
    expect(tasksProblem(real, realFramework)).toBeNull();
  });

  it("has twelve categories and at least one task in each, and in each stage", () => {
    expect(real.categories).toHaveLength(12);
    for (const category of real.categories) {
      expect(real.tasks.filter((t) => t.category === category.id).length, category.id).toBeGreaterThan(0);
    }
    for (const stage of TASK_STAGES) {
      expect(real.tasks.filter((t) => t.stage === stage).length, stage).toBeGreaterThan(0);
    }
  });

  it("has no empty or repeated title or summary", () => {
    const titles = real.tasks.map((t) => t.title.trim());
    const summaries = real.tasks.map((t) => t.summary.trim());
    expect(titles.every(Boolean)).toBe(true);
    expect(summaries.every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(summaries).size).toBe(summaries.length);
  });

  it("links only tasks that are done through a strategy step, and flags the Postin ones", () => {
    expect(real.tasks.some((t) => t.step)).toBe(true);
    expect(real.tasks.some((t) => t.postin)).toBe(true);
    expect(real.tasks.filter((t) => t.postin).every((t) => t.category === "channels" || t.category === "marketing")).toBe(true);
  });
});
