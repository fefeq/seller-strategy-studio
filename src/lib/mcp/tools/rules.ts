// The team's rules for external assistants (SDD-20261109-rules-in-ai-readers, U-5). The SDK only serves tools, so the rules
// are a read-only tool of the server (not of the agent registry: the in-app agent already gets them every turn), and the
// server's instructions ask assistants to call it before drafting. Same reader and block as the agent (NK-0087).
import { defineTool } from "@lovable.dev/mcp-js";
import type { Db } from "@/lib/org-data";
import { loadAgentRules, RULES_READ_FAILED, rulesBlock } from "@/lib/knowledge-rules";
import { mcpCtx, text } from "../context";

export const RULES_MCP_INSTRUCTION =
  "Antes de redactar textos para la empresa o proponer acciones, llama a get_team_rules y cumple sus reglas_obligatorias.";

/** What get_team_rules answers: the rules block, «none» for the company, or the failed-read notice (never throws). */
export async function teamRulesText(c: { db: Db; orgId: string; orgName: string }) {
  const r = await loadAgentRules({ db: c.db, orgId: c.orgId });
  if (!r.ok) return RULES_READ_FAILED;
  return r.rules.length
    ? rulesBlock(r.rules, { withPerson: true })
    : `No hay reglas obligatorias de equipo en ${c.orgName}.`;
}

export const teamRules = defineTool({
  name: "get_team_rules",
  title: "Reglas del equipo",
  description:
    "Reglas obligatorias que el equipo escribió en Conocimiento para la empresa activa. Léelas antes de redactar textos o proponer acciones y cúmplelas.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => text(await teamRulesText(await mcpCtx(ctx))),
});
