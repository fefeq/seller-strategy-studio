import type { ToolCtx } from "@/lib/agent/tool-kit";
import { meetingBriefCore, accountContext } from "@/lib/ai-core";
import { ask } from "@/lib/ai-gateway";
import { loadAgentRules, rulesBlock } from "@/lib/knowledge-rules";

/** Same paid core for a newly reserved automatic action and a manually confirmed action. */
export async function executeAutopilotAi(c: ToolCtx, tool: string, args: { meeting_id?: string; account_id?: string; week?: string }) {
  const logicalKey = tool === "autopilot_prepare_meeting" && args.meeting_id ? `meeting:${args.meeting_id}` : tool === "autopilot_review_account" && args.account_id && args.week ? `cooling:${args.account_id}:${args.week}` : null;
  if (!logicalKey) throw new Error("La propuesta del piloto no es válida.");
  const member = await c.db.from("org_members").select("user_id").eq("org_id", c.orgId).eq("user_id", c.userId).maybeSingle();
  if (member.error || !member.data) throw new Error("No perteneces a esta empresa.");
  const table = tool === "autopilot_prepare_meeting" ? "meetings" : "accounts";
  const record = await c.db.from(table).select("id").eq("org_id", c.orgId).eq("id", args.meeting_id ?? args.account_id ?? "").maybeSingle();
  if (record.error || !record.data) throw new Error("El registro no existe en esta empresa.");
  // Permanent logical reservation, also across distinct confirmed action IDs. Never replay uncertain spend.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const lease = await supabaseAdmin.from("job_locks").insert({ name: `autopilot-ai:${c.orgId}:${logicalKey}`, last_run_at: new Date().toISOString() });
  if (lease.error?.code === "23505") return { mensaje: "Esta operación ya se reservó. No se ha repetido la IA. Revisa la actividad." };
  if (lease.error) throw new Error("No pude reservar la operación. No se ha llamado a la IA.");
  const scope = { orgId: c.orgId, userId: c.userId };
  const onCost = async (cost: number | null, provider: string) => {
    const { error } = await c.db.from("integration_usage").insert({
      org_id: c.orgId, user_id: c.userId, service: provider, tool, trigger: "automatic",
      currency: "USD", cost, cost_kind: cost === null ? "unknown" : "measured", volume: 1,
    });
    if (error) throw new Error("No se pudo registrar el coste de IA. Revisa la actividad antes de volver a intentarlo.");
  };
  if (tool === "autopilot_prepare_meeting" && args.meeting_id) {
    const { data: m, error } = await c.db.from("meetings").select("id,ai_brief,auto_prepped_at").eq("org_id", c.orgId).eq("id", args.meeting_id).maybeSingle();
    if (error) throw error;
    if (!m) throw new Error("Reunión no encontrada");
    if (m.ai_brief || m.auto_prepped_at) return { mensaje: "La reunión ya estaba preparada. No se ha repetido la IA." };
    const r = await meetingBriefCore(c.db, m.id, scope, { onCost, withPerson: true });
    const saved = await c.db.from("meetings").update({ auto_prepped_at: new Date().toISOString() }).eq("org_id", c.orgId).eq("id", m.id);
    if (saved.error) throw saved.error;
    await c.db.from("suggestions").update({ status: "resolved" }).eq("org_id", c.orgId).eq("dedupe_key", `meeting_no_prep:${m.id}`).in("status", ["pending", "snoozed"]);
    return { mensaje: r.brief };
  }
  if (tool === "autopilot_review_account" && args.account_id && args.week) {
    const key = `account_cooling:${args.account_id}:${args.week}`;
    const done = await c.db.from("suggestions").select("id").eq("org_id", c.orgId).eq("dedupe_key", key).maybeSingle();
    if (done.error) throw done.error;
    if (done.data) return { mensaje: "La cuenta ya se repasó esta semana. No se ha repetido la IA." };
    const rules = await loadAgentRules(c);
    if (!rules.ok) throw new Error("No pude leer las reglas del equipo. Reintenta cuando estén disponibles.");
    const context = await accountContext(c.db, args.account_id, scope);
    const review = await ask(`Eres un director comercial B2B. Repasa la cuenta que se enfría. Español neutro, tú, sin exclamaciones ni emoji. Usa solo el contexto. Tres líneas: Dónde estábamos, Riesgo y Siguiente paso. Nunca envíes mensajes.\n${rulesBlock(rules.rules, { withPerson: true })}`, context.slice(0, 18000), { effort: "low", onCost });
    if (!review.trim()) throw new Error("La IA no devolvió un repaso válido. Revisa la actividad.");
    const { error } = await c.db.from("suggestions").upsert({ org_id: c.orgId, user_id: c.userId, detector: "account_cooling", dedupe_key: key, priority: 2, title: "Repaso de cuenta preparado", body: review.slice(0, 2000), link: `/accounts/${args.account_id}` }, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
    if (error) throw error;
    return { mensaje: review };
  }
  throw new Error("La propuesta del piloto no es válida.");
}