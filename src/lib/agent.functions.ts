import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ask } from "@/lib/ai-gateway";
import { executeTool, type ToolCtx } from "@/lib/agent/tools";
import { loadSnapshot, syncSuggestions, type Db } from "@/lib/org-data";
import { detect } from "@/lib/proactive";
import { SETUP_EXTRACTION_SCHEMA, type SetupProposal } from "@/lib/setup-extraction";
import { errorText } from "@/lib/errors";

export async function userCtx(supabase: Db, userId: string): Promise<ToolCtx & { orgName: string }> {
  const { data: profile } = await supabase.from("profiles").select("current_org_id").eq("id", userId).single();
  const orgId = profile?.current_org_id;
  if (!orgId) throw new Error("Selecciona una empresa");
  const [{ data: members }, { data: org }] = await Promise.all([
    supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId),
    supabase.from("organizations").select("name,currency").eq("id", orgId).single(),
  ]);
  if (!members?.length) throw new Error("No perteneces a esta empresa");
  return { db: supabase, orgId, userId, roles: members.map((m) => m.role), currency: org?.currency ?? "EUR", orgName: org?.name ?? "tu empresa" };
}

// ---------------- Agent ----------------

export const sendAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId?: string | null; text: string; mode?: "chat" | "interview"; personaId?: string | null; workflowId?: string | null }) => {
    const text = String(d?.text ?? "").trim();
    if (!text) throw new Error("Escribe un mensaje");
    if (text.length > 4000) throw new Error("Mensaje demasiado largo (máx. 4000 caracteres)");
    return { conversationId: d.conversationId ?? null, text, mode: d.mode === "interview" ? "interview" as const : "chat" as const, personaId: d.personaId ? String(d.personaId) : null, workflowId: d.workflowId ? String(d.workflowId) : null };
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    let conversationId = data.conversationId;
    if (conversationId) {
      const { data: conv } = await ctx.db.from("agent_conversations").select("id").eq("id", conversationId).eq("org_id", ctx.orgId).maybeSingle();
      if (!conv) conversationId = null;
    }
    if (!conversationId) {
      const { data: conv, error } = await ctx.db.from("agent_conversations").insert({ org_id: ctx.orgId, user_id: ctx.userId, channel: "app", mode: data.mode, title: data.text.slice(0, 80) }).select("id").single();
      if (error) throw new Error(error.message);
      conversationId = conv.id;
    }
    const { runAgent } = await import("@/lib/agent/agent.server");
    const out = await runAgent(ctx, { conversationId, text: data.text, channel: "app", mode: data.mode, orgName: ctx.orgName, personaId: data.personaId, workflowId: data.workflowId });
    return { conversationId, text: out.text, pending: out.pending };
  });

export const decideAgentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "confirm" | "cancel" }) => ({ id: String(d.id), decision: d.decision === "confirm" ? "confirm" as const : "cancel" as const }))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    return decidePending(ctx, data.id, data.decision);
  });

export async function decidePending(ctx: ToolCtx, id: string, decision: "confirm" | "cancel") {
  const { data: act } = await ctx.db.from("agent_pending_actions").select("*").eq("id", id).eq("user_id", ctx.userId).eq("org_id", ctx.orgId).maybeSingle();
  if (!act) throw new Error("Acción no encontrada");
  if (act.status !== "pending") return { status: act.status, result: act.result };
  if (decision === "cancel") {
    await ctx.db.from("agent_pending_actions").update({ status: "cancelled", decided_at: new Date().toISOString() }).eq("id", id);
    return { status: "cancelled", result: "" };
  }
  // Claim first so a double click cannot execute twice.
  const { data: claimed } = await ctx.db.from("agent_pending_actions").update({ status: "confirmed", decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id");
  if (!claimed?.length) return { status: "confirmed", result: "" };
  try {
    await executeTool(ctx, act.tool, act.args);
    const result = `Hecho: ${act.summary}`;
    await ctx.db.from("agent_pending_actions").update({ result }).eq("id", id);
    if (act.conversation_id) await ctx.db.from("agent_messages").insert({ conversation_id: act.conversation_id, role: "assistant", content: result });
    return { status: "confirmed", result };
  } catch (e) {
    const result = errorText(e);
    await ctx.db.from("agent_pending_actions").update({ status: "failed", result }).eq("id", id);
    return { status: "failed", result };
  }
}

// ---------------- Onboarding ----------------

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/i;

async function fetchSite(raw: string) {
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new Error("La web no es válida"); }
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname)) throw new Error("La web no es válida");
  const res = await fetch(url, { headers: { "User-Agent": "NokkoBot/1.0", Accept: "text/html" }, redirect: "follow" }).catch(() => null);
  if (!res || !res.ok) throw new Error("No he podido leer esa web. Prueba a pegar el texto.");
  const html = (await res.text()).slice(0, 400_000);
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15_000);
}

export const extractSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url?: string; text?: string; files?: { filename: string; dataUrl: string }[] }) => {
    const files = (d.files ?? []).slice(0, 3).filter((f) => typeof f.dataUrl === "string" && f.dataUrl.startsWith("data:"));
    if (files.reduce((s, f) => s + f.dataUrl.length, 0) > 14_000_000) throw new Error("Los archivos son demasiado grandes (máx. ~10 MB en total)");
    const text = String(d.text ?? "").slice(0, 40_000);
    const url = String(d.url ?? "").trim();
    if (!url && !text.trim() && !files.length) throw new Error("Añade una web, texto o un documento");
    return { url, text, files };
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const site = data.url ? await fetchSite(data.url) : "";
    const raw = await ask(
      "Eres un estratega GTM B2B senior. A partir de la web, textos y documentos de una empresa, propones su configuración go-to-market: posicionamiento (marco de April Dunford), segmentos con rango de ACV y motion (plg <5K, inside 5K–50K, field 50K–250K, strategic >250K), ICPs con anti-ICP, 3 pilares de mensaje y hasta 5 cuentas objetivo de ejemplo si se mencionan clientes o el tipo de cliente es claro. Español neutro (tú), sin signos de exclamación ni emoji. Sé concreto y basado en las fuentes; usa null cuando no haya base razonable (no inventes cifras de win rate o cuota si no aparecen: déjalas null). En questions pon 2-4 preguntas clave que faltan para afinar.",
      JSON.stringify({ empresa: ctx.orgName, moneda_actual: ctx.currency, web: data.url ? { url: data.url, texto: site } : null, notas: data.text || null }),
      // "low": the proposal is reviewed point by point anyway, and a long call gets cut by mobile browsers (~60 s).
      { effort: "low", schema: { name: "gtm_setup", schema: SETUP_EXTRACTION_SCHEMA }, files: data.files },
    );
    try { return JSON.parse(raw) as SetupProposal; } catch {
      console.error("extractSetup invalid JSON", raw.slice(0, 300));
      throw new Error("La IA no devolvió una propuesta válida. Inténtalo de nuevo.");
    }
  });

/** Applies a batch of accepted proposals through the same tool registry the agent uses. */
export const applySetupItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: { tool: string; args: Record<string, unknown> }[] }) => ({ items: (d.items ?? []).slice(0, 40) }))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const results: { tool: string; ok: boolean; error?: string }[] = [];
    for (const it of data.items) {
      try { await executeTool(ctx, it.tool, it.args); results.push({ tool: it.tool, ok: true }); }
      catch (e) { results.push({ tool: it.tool, ok: false, error: errorText(e) }); }
    }
    return results;
  });

// ---------------- Proactive suggestions ----------------

export const refreshSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const snap = await loadSnapshot(ctx.db, ctx.orgId);
    await syncSuggestions(ctx.db, ctx.orgId, detect(snap));
    return { ok: true };
  });

export const decideSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "approve" | "snooze" | "dismiss" }) => ({ id: String(d.id), decision: (["approve", "snooze", "dismiss"].includes(d.decision) ? d.decision : "dismiss") as "approve" | "snooze" | "dismiss" }))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    return decideSuggestionCore(ctx, data.id, data.decision);
  });

export async function decideSuggestionCore(ctx: ToolCtx, id: string, decision: "approve" | "snooze" | "dismiss") {
  const { data: s } = await ctx.db.from("suggestions").select("*").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!s) throw new Error("Sugerencia no encontrada");
  if (s.status !== "pending") return { status: s.status, message: "Ya estaba gestionada" };
  const now = new Date().toISOString();
  if (decision === "snooze") {
    await ctx.db.from("suggestions").update({ status: "snoozed", snoozed_until: new Date(Date.now() + 3 * 86_400_000).toISOString(), updated_at: now }).eq("id", id);
    return { status: "snoozed", message: "Te lo recuerdo en 3 días" };
  }
  if (decision === "dismiss") {
    await ctx.db.from("suggestions").update({ status: "dismissed", updated_at: now }).eq("id", id);
    return { status: "dismissed", message: "Descartada; no volverá a aparecer" };
  }
  const { data: claimed } = await ctx.db.from("suggestions").update({ status: "approved", updated_at: now }).eq("id", id).eq("status", "pending").select("id");
  if (!claimed?.length) return { status: "approved", message: "Ya estaba gestionada" };
  const action = s.action as { tool: string; args: Record<string, unknown> } | null;
  if (action?.tool) {
    try { await executeTool(ctx, action.tool, action.args); }
    catch (e) {
      await ctx.db.from("suggestions").update({ status: "pending" }).eq("id", id);
      throw new Error((e as Error).message);
    }
  }
  return { status: "approved", message: action ? "Hecho" : "Marcada como hecha" };
}

// ---------------- Telegram linking ----------------

export const createTelegramLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    const expires = new Date(Date.now() + 15 * 60_000).toISOString();
    const { error } = await context.supabase.from("channel_links").upsert({ user_id: context.userId, channel: "telegram", link_code: code, code_expires_at: expires }, { onConflict: "user_id,channel" });
    if (error) throw new Error(error.message);
    return { code, expires };
  });

export const telegramBotInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { telegramConfigured, tg } = await import("@/lib/telegram.server");
    if (!telegramConfigured()) return { connected: false as const, username: null };
    try {
      const r = (await tg("getMe", {})) as { result?: { username?: string } };
      return { connected: true as const, username: r.result?.username ?? null };
    } catch { return { connected: false as const, username: null }; }
  });
