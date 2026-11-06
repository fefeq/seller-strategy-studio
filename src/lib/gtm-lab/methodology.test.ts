import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import frameworkYaml from "./methodology/framework.yaml?raw";
import tasksYaml from "./methodology/tasks.yaml?raw";
import { tasksProblem } from "./core";
import { framework, taskSource } from "./methodology";

// NK-0048 CA-4: byte for byte the files of gtm-lab@44f385b methodology/. A changed hash means
// someone edited the methodology text, which this SDD forbids.
const SHA256 = {
  framework: "12e2b315fd4182bf0a70f702d689d2b09f62a179272d7c8bd4c51dbfe942d319",
  tasks: "7abb139114c5df8550a4574063abdb8b5f7de4991da4fac953ac6557df18a5c0",
};

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

describe("gtm-lab methodology files (NK-0048 CA-4)", () => {
  it("framework.yaml is the one of gtm-lab@44f385b", () => {
    expect(sha256(frameworkYaml)).toBe(SHA256.framework);
  });

  it("tasks.yaml is the one of gtm-lab@44f385b", () => {
    expect(sha256(tasksYaml)).toBe(SHA256.tasks);
  });
});

// NK-0048 CA-5: loaded with ?raw (no node:fs), in the default jsdom environment.
describe("gtm-lab methodology module (NK-0048 CA-5)", () => {
  it("runs in jsdom, like the browser", () => {
    expect(typeof window).toBe("object");
  });

  it("exports the validated framework: 7 phases", () => {
    expect(framework.phases).toHaveLength(7);
  });

  it("exports the validated task catalogue: 98 tasks in 12 categories, linked to the framework", () => {
    expect("catalog" in taskSource).toBe(true);
    if (!("catalog" in taskSource)) return;
    expect(taskSource.catalog.tasks).toHaveLength(98);
    expect(taskSource.catalog.categories).toHaveLength(12);
    expect(tasksProblem(taskSource.catalog, framework)).toBeNull();
  });
});
