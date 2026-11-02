// From gtm-lab@44f385b packages/core/src/node.ts
import { readFileSync } from "node:fs";
import { parseFramework, type Framework } from "./framework";
import { parseTasks, type TaskCatalog } from "./tasks";

/** Node-only entry point: reads and validates a framework file from disk. */
export function loadFrameworkFile(path: string | URL): Framework {
  return parseFramework(readFileSync(path, "utf8"));
}

/** Reads and validates the task catalogue; links to the framework are checked separately with `tasksProblem`. */
export function loadTasksFile(path: string | URL): TaskCatalog {
  return parseTasks(readFileSync(path, "utf8"));
}
