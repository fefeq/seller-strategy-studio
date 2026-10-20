// Exposes the agent's single tool registry over MCP. Reads run now; writes become
// pending actions the user confirms in the app (Sugerencias), exactly like the in-app agent.
import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import type { z } from "zod";
import { TOOLS, canUseTool, executeTool, summarizeAction } from "@/lib/agent/tools";
import { mcpCtx, json, text } from "../context";

const APP_URL = "https://nokko.ai/inbox";

export const agentMcpTools = TOOLS.map((t) =>
  defineTool({
    name: t.name,
    title: t.name.replace(/_/g, " "),
    description: t.kind === "write" ? `${t.description} (Queda pendiente: el usuario la confirma en NOKKO.)` : t.description,
    inputSchema: ((t.input as z.ZodObject<z.ZodRawShape>).shape ?? {}) as z.ZodRawShape,
    annotations: t.kind === "read"
      ? { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
      : { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async (args, ctx) => {
      const c = await mcpCtx(ctx);
      if (!canUseTool(t, c.roles)) throw new ToolError("Tu rol en esta empresa no permite esta acción");
      if (t.kind === "read") {
        try { return json(await executeTool(c, t.name, args)); } catch (e) { throw new ToolError((e as Error).message); }
      }
      const parsed = t.input.safeParse(args ?? {});
      if (!parsed.success) throw new ToolError(`Datos no válidos: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
      const summary = summarizeAction(t.name, parsed.data);
      const { error } = await c.db.from("agent_pending_actions").insert({ org_id: c.orgId, user_id: c.userId, tool: t.name, args: parsed.data as never, summary, source: "mcp" });
      if (error) throw new ToolError(error.message);
      return text(`Acción preparada en ${c.orgName}: «${summary}». El usuario debe confirmarla en NOKKO → Sugerencias (${APP_URL}).`);
    },
  }),
);
