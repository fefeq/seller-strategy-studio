// GTM Lab methodology, bundled as text with ?raw (no node:fs), so it loads in the Worker and the
// browser alike. Same loader as gtm-lab@44f385b apps/web/src/methodology.ts (NK-0048 CA-5).
import { parseFramework, parseTasks, tasksProblem, type TaskCatalog } from "./core";
import raw from "./methodology/framework.yaml?raw";
import rawTasks from "./methodology/tasks.yaml?raw";

export const framework = parseFramework(raw);

/** The task catalogue, or why it could not load: the screen shows the message instead of going blank. */
export type TaskSource = { catalog: TaskCatalog } | { error: string };

function loadTasks(): TaskSource {
  try {
    const catalog = parseTasks(rawTasks);
    const problem = tasksProblem(catalog, framework);
    return problem ? { error: problem } : { catalog };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export const taskSource = loadTasks();
