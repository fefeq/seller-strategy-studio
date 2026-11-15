import { z } from "zod";
import { def, isLeader, type AgentTool, type ToolCtx } from "../tool-kit";
import { canChangeThreshold } from "@/lib/autopilot-threshold";

export async function pendingAutopilotState(c: ToolCtx) {
  const [settings, actions] = await Promise.all([
    c.db.from("lead_settings").select("autopilot_action_threshold").eq("org_id", c.orgId).maybeSingle(),
    c.db.from("agent_pending_actions").select("id,summary,status,result,source").eq("org_id", c.orgId).eq("user_id", c.userId).eq("status", "pending").order("created_at", { ascending: false }).limit(100),
  ]);
  if (settings.error) throw settings.error;
  if (actions.error) throw actions.error;
  return { threshold: Number(settings.data?.autopilot_action_threshold ?? 0), currency: c.currency, canChange: isLeader(c.roles), pending: actions.data ?? [] };
}
export const AUTOPILOT_TOOLS: AgentTool[] = [
  def({ name: "list_my_pending_actions", kind: "read", description: "Lee tus acciones pendientes del agente y piloto y el umbral actual por acción en la moneda de empresa. Sin gasto.", input: z.object({}), run: pendingAutopilotState }),
  def({ name: "set_autopilot_threshold", kind: "write", roles: ["owner", "sales_leader"], description: "Propone cambiar el umbral por acción de IA del piloto. Solo tras confirmación. Cero pide siempre confirmación, sin dato también.", input: z.object({ threshold: z.number().finite().nonnegative(), currency: z.string() }), summarize: a => `Cambiar umbral del piloto a ${a.threshold} ${a.currency} por acción`, run: async (c, a) => {
    if (!canChangeThreshold(c.roles)) throw new Error("Solo Owner y Sales Leader pueden cambiar el umbral.");
    if (a.currency !== c.currency) throw new Error("La moneda de la empresa ha cambiado. Propón el umbral de nuevo.");
    const { error } = await c.db.from("lead_settings").upsert({ org_id: c.orgId, autopilot_action_threshold: a.threshold, updated_by: c.userId, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
    if (error) throw error;
    return { mensaje: `Umbral guardado: ${a.threshold} ${c.currency} por acción.` };
  }}),
  ...["autopilot_prepare_meeting", "autopilot_review_account"].map(name => def({ name, kind: "write", description: name === "autopilot_prepare_meeting" ? "Preparar reunión del piloto con IA y registrar coste real." : "Repasar una cuenta que se enfría con IA y registrar coste real.", input: z.object({ meeting_id: z.string().uuid().optional(), account_id: z.string().uuid().optional(), week: z.string().optional(), autopilot_key: z.string().optional() }), summarize: () => "Preparar con IA la propuesta del piloto", run: async (c, a) => {
    const { executeAutopilotAi } = await import("@/lib/autopilot-ai.server");
    return executeAutopilotAi(c, name, a);
  }})),
];