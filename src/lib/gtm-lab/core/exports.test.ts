import { describe, expect, it } from "vitest";
import indexSource from "./index.ts?raw";
import * as core from "./index";

// NK-0048 CA-1: the public surface of the copied core equals packages/core/src/index.ts@44f385b.
// Reference list taken from that file when copying; values and types, sorted.
const REFERENCE_VALUES = [
  "EXPERIMENT_STATUSES",
  "FrameworkError",
  "MAX_DATA_BYTES",
  "MAX_LENGTH",
  "SAVED_TASK_STATUSES",
  "SCALE",
  "TASK_DURATIONS",
  "TASK_KINDS",
  "TASK_STAGES",
  "TOOLS",
  "TasksError",
  "aiInstructionFor",
  "allSteps",
  "buildAiRequest",
  "buildStrategyDoc",
  "formFor",
  "formJsonSchema",
  "formatIce",
  "formatToolTotal",
  "iceScore",
  "isKnownDeliverable",
  "orderBacklog",
  "parseFramework",
  "parseTasks",
  "planToBacklog",
  "projectProgress",
  "pruneDeliverable",
  "rankBacklog",
  "renderMarkdown",
  "scoreTool",
  "strategyDocReady",
  "summarizeTasks",
  "taskStatus",
  "tasksProblem",
  "toolFor",
  "toolIsStale",
  "toolRows",
  "validateDeliverable",
  "validateExperiment",
  "validateToolData",
];

const REFERENCE_TYPES = [
  "AiRequest",
  "BacklogEntry",
  "BacklogItem",
  "Criterion",
  "DeliverableData",
  "DocBlock",
  "DocPart",
  "DocumentSpec",
  "Experiment",
  "ExperimentStatus",
  "Field",
  "FieldError",
  "FormSpec",
  "Formula",
  "Framework",
  "IceInput",
  "ListField",
  "ListItem",
  "ProjectProgress",
  "RankedRow",
  "SavedDeliverableLike",
  "SavedTaskStatus",
  "ScalarField",
  "Step",
  "StepProgress",
  "StepStatus",
  "StrategyDoc",
  "Task",
  "TaskCatalog",
  "TaskCounts",
  "TaskDuration",
  "TaskKind",
  "TaskStage",
  "TaskStatus",
  "TasksSummary",
  "ToolRow",
  "ToolSpec",
];

const CORE_FILES = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true });

function exportedNames(source: string): { values: string[]; types: string[] } {
  const values: string[] = [];
  const types: string[] = [];
  for (const block of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of block[1].split(",")) {
      const name = raw.trim();
      if (!name) continue;
      if (name.startsWith("type ")) types.push(name.slice(5).trim());
      else values.push(name);
    }
  }
  return { values: values.sort(), types: types.sort() };
}

describe("gtm-lab core exports (NK-0048 CA-1)", () => {
  it("index.ts exports exactly the reference values and types", () => {
    const { values, types } = exportedNames(indexSource);
    expect(values).toEqual(REFERENCE_VALUES);
    expect(types).toEqual(REFERENCE_TYPES);
  });

  it("every reference value is really exported at runtime", () => {
    expect(Object.keys(core).sort()).toEqual(REFERENCE_VALUES);
  });

  it("every copied file starts with its provenance header", () => {
    const files = Object.entries(CORE_FILES).filter(
      ([path]) => !["./exports.test.ts", "./test-count.test.ts"].includes(path),
    );
    expect(files.length).toBeGreaterThan(20);
    for (const [path, text] of files) {
      const name = path.slice(2);
      expect(String(text).split("\n")[0], name).toBe(
        `// From gtm-lab@44f385b packages/core/src/${name}`,
      );
    }
  });

  it("the node entry point is core/node.ts", () => {
    expect(Object.keys(CORE_FILES)).toContain("./node.ts");
  });
});
