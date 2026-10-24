// Single tool registry shared by the in-app agent, Telegram and proactive suggestions.
// Read tools run immediately; write tools only run after the user confirms.
// Every handler filters/sets org_id explicitly (safe with privileged clients too).
import { ACCOUNT_TOOLS } from "./tools/accounts";
import { PIPELINE_TOOLS } from "./tools/pipeline";
import { MEETING_TOOLS } from "./tools/meetings";
import { INBOX_TOOLS } from "./tools/inbox";
import { CLAY_TOOLS } from "./tools/clay";
import { APOLLO_TOOLS } from "./tools/apollo";
import { WEB_TOOLS } from "./tools/web";
import { DRIVE_TOOLS } from "./tools/drive";
import { LINKEDIN_TOOLS } from "./tools/linkedin";
import { PRODUCT_TOOLS } from "./tools/product";
import { PARALLEL_TOOLS } from "./tools/parallel";
import { NEED_TOOLS } from "./tools/needs";
import { type AgentTool, type ToolCtx } from "./tool-kit";
import { CORE_READ_TOOLS } from "./tools/core-read";
import { CORE_WRITE_TOOLS } from "./tools/core-write";
import { STRATEGY_TOOLS } from "./tools/strategy";
import { CYCLE_TOOLS } from "./tools/cycle";

export type { AgentTool, ToolCtx } from "./tool-kit";

const CORE_TOOLS: AgentTool[] = [...CORE_READ_TOOLS, ...CORE_WRITE_TOOLS, ...STRATEGY_TOOLS, ...CYCLE_TOOLS];

export const TOOLS: AgentTool[] = [...CORE_TOOLS, ...ACCOUNT_TOOLS, ...PIPELINE_TOOLS, ...MEETING_TOOLS, ...INBOX_TOOLS, ...CLAY_TOOLS, ...APOLLO_TOOLS, ...WEB_TOOLS, ...DRIVE_TOOLS, ...LINKEDIN_TOOLS, ...PRODUCT_TOOLS, ...PARALLEL_TOOLS, ...NEED_TOOLS];

export function getTool(name: string) {
  return TOOLS.find((t) => t.name === name);
}

export function canUseTool(tool: AgentTool, roles: string[]) {
  return !tool.roles || roles.some((r) => (tool.roles as string[]).includes(r));
}

export function toolsFor(roles: string[]) {
  return TOOLS.filter((t) => canUseTool(t, roles));
}

/** Validates args and runs a tool after checking role permissions. */
export async function executeTool(ctx: ToolCtx, name: string, rawArgs: unknown) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Acción desconocida: ${name}`);
  if (!canUseTool(tool, ctx.roles)) throw new Error("Tu rol no permite esta acción");
  const args = tool.input.parse(rawArgs ?? {});
  return tool.run(ctx, args);
}

export function summarizeAction(name: string, args: unknown) {
  const tool = getTool(name);
  if (!tool) return name;
  try { return tool.summarize ? tool.summarize(tool.input.parse(args)) : tool.description; } catch { return tool.description; }
}
