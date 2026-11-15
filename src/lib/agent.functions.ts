import type { Json } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeTool, type ToolCtx } from "@/lib/agent/tools";
import { loadSnapshot, syncSuggestions, type Db } from "@/lib/org-data";
import { detect } from "@/lib/proactive";
import { isUndoRef, undoRefFor, type UndoRef } from "@/lib/setup-undo";
import { errorText } from "@/lib/errors";
import { canActOnSuggestion } from "@/lib/suggestion-board";
import { canViewStrategy, executeFormKind, needsPriceAccess } from "@/lib/strategy-suggestions";
import { executeIssue } from "@/lib/strategy-execute";

export type ExecuteInput =
  | { kind: "experiment"; draft: import("@/lib/strategy-execute").ExperimentDraft }
  | { kind: "task"; draft: import("@/lib/strategy-execute").TaskDraft };

export async function userCtx(
  supabase: Db,
  userId: string,
): Promise<ToolCtx & { orgName: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_org_id")
    .eq("id", userId)
    .single();
  const orgId = profile?.current_org_id;
  if (!orgId) throw new Error("Selecciona una empresa");
  const [{ data: members }, { data: org }] = await Promise.all([
    supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId),
    supabase.from("organizations").select("name,company_name,currency").eq("id", orgId).single(),
  ]);
  if (!members?.length) throw new Error("No perteneces a esta empresa");
  return {
    db: supabase,
    orgId,
    userId,
    roles: members.map((m) => m.role),
    currency: org?.currency ?? "EUR",
    orgName: org?.company_name?.trim() || org?.name || "tu empresa",
  };
}

// ---------------- Agent ----------------

export const sendAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      conversationId?: string | null;
      text: string;
      mode?: "chat" | "interview";
      personaId?: string | null;
      workflowId?: string | null;
    }) => {
      const text = String(d?.text ?? "").trim();
      if (!text) throw new Error("Escribe un mensaje");
      if (text.length > 4000) throw new Error("Mensaje demasiado largo (máx. 4000 caracteres)");
      return {
        conversationId: d.conversationId ?? null,
        text,
        mode: d.mode === "interview" ? ("interview" as const) : ("chat" as const),
        personaId: d.personaId ? String(d.personaId) : null,
        workflowId: d.workflowId ? String(d.workflowId) : null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    let conversationId = data.conversationId;
    if (conversationId) {
      const { data: conv } = await ctx.db
        .from("agent_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("org_id", ctx.orgId)
        .maybeSingle();
      if (!conv) conversationId = null;
    }
    if (!conversationId) {
      const { data: conv, error } = await ctx.db
        .from("agent_conversations")
        .insert({
          org_id: ctx.orgId,
          user_id: ctx.userId,
          channel: "app",
          mode: data.mode,
          title: data.text.slice(0, 80),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      conversationId = conv.id;
    }
    const { runAgent } = await import("@/lib/agent/agent.server");
    const out = await runAgent(ctx, {
      conversationId,
      text: data.text,
      channel: "app",
      mode: data.mode,
      orgName: ctx.orgName,
      personaId: data.personaId,
      workflowId: data.workflowId,
    });
    return { conversationId, text: out.text, pending: out.pending };
  });

export const decideAgentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "confirm" | "cancel" }) => ({
    id: String(d.id),
    decision: d.decision === "confirm" ? ("confirm" as const) : ("cancel" as const),
  }))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    return decidePending(ctx, data.id, data.decision);
  });

export async function decidePending(ctx: ToolCtx, id: string, decision: "confirm" | "cancel") {
  const { data: act } = await ctx.db
    .from("agent_pending_actions")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!act) throw new Error("Acción no encontrada");
  if (act.status !== "pending") return { status: act.status, result: act.result };
  if (decision === "cancel") {
    const { data: cancelled, error } = await ctx.db
      .from("agent_pending_actions")
      .update({ status: "cancelled", decided_at: new Date().toISOString() })
      .eq("id", id).eq("org_id", ctx.orgId).eq("user_id", ctx.userId).eq("status", "pending").select("id");
    if (error) throw error;
    if (!cancelled?.length) return { status: "confirmed", result: "La acción ya se está procesando." };
    return { status: "cancelled", result: "" };
  }
  // Claim first so a double click cannot execute twice.
  const { data: claimed, error: claimError } = await ctx.db
    .from("agent_pending_actions")
    .update({ status: "confirmed", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.orgId).eq("user_id", ctx.userId)
    .eq("status", "pending")
    .select("id");
  if (claimError) throw claimError;
  if (!claimed?.length) return { status: "confirmed", result: "" };
  try {
    const out = await executeTool(ctx, act.tool, act.args);
    // A tool can add what the user must know after confirming (a warning, or that it went to Aprobaciones).
    const note =
      out && typeof out === "object" && typeof (out as { mensaje?: unknown }).mensaje === "string"
        ? (out as { mensaje: string }).mensaje
        : "";
    const { getTool } = await import("@/lib/agent/tools");
    const { SPENDING_READS, spendResultText } = await import("@/lib/agent/spend-confirm");
    // A2: a confirmed spending read keeps its full result here and in the conversation (paid data is never lost).
    const result = (SPENDING_READS as readonly string[]).includes(act.tool) && getTool(act.tool)
      ? spendResultText(act.summary, out)
      : note
        ? `Hecho: ${act.summary}. ${note}`
        : `Hecho: ${act.summary}`;
    await ctx.db.from("agent_pending_actions").update({ result }).eq("id", id);
    if (act.conversation_id)
      await ctx.db
        .from("agent_messages")
        .insert({ conversation_id: act.conversation_id, role: "assistant", content: result.length > 8000 ? `${result.slice(0, 8000)}… (resultado completo guardado en la acción confirmada)` : result });
    return { status: "confirmed", result };
  } catch (e) {
    const result = errorText(e);
    await ctx.db.from("agent_pending_actions").update({ status: "failed", result }).eq("id", id);
    return { status: "failed", result };
  }
}

// ---------------- Onboarding ----------------

export const extractSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { url?: string; text?: string; files?: { filename: string; dataUrl: string }[] }) => {
      const files = (d.files ?? [])
        .slice(0, 3)
        .filter((f) => typeof f.dataUrl === "string" && f.dataUrl.startsWith("data:"));
      if (files.reduce((s, f) => s + f.dataUrl.length, 0) > 14_000_000)
        throw new Error("Los archivos son demasiado grandes (máx. ~10 MB en total)");
      const text = String(d.text ?? "").slice(0, 40_000);
      const url = String(d.url ?? "").trim();
      if (!url && !text.trim() && !files.length)
        throw new Error("Añade una web, texto o un documento");
      return { url, text, files };
    },
  )
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const { readSite, extractSetupCore } = await import("@/lib/setup-extract.server");
    const site = data.url ? await readSite(data.url) : "";
    return extractSetupCore(ctx, { url: data.url, site, text: data.text, files: data.files });
  });

/** Applies a batch of accepted proposals through the same tool registry the agent uses. */
export const applySetupItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: { tool: string; args: Record<string, unknown> }[] }) => ({
    items: (d.items ?? []).slice(0, 40),
  }))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const results: { tool: string; ok: boolean; error?: string; undo?: UndoRef | null }[] = [];
    const { SPEND_TOOLS } = await import("@/lib/agent/spend-confirm");
    for (const it of data.items) {
      try {
        // A2: setup proposals never spend; a spending tool here is refused instead of running unconfirmed.
        if (it.tool in SPEND_TOOLS) throw new Error("Esta acción gasta saldo: lánzala desde el agente para confirmar su coste.");
        const r = await executeTool(ctx, it.tool, it.args);
        results.push({ tool: it.tool, ok: true, undo: undoRefFor(it.tool, it.args, r) });
      } catch (e) {
        results.push({ tool: it.tool, ok: false, error: errorText(e) });
      }
    }
    return results;
  });

/**
 * Deletes what a saved batch created (see src/lib/setup-undo.ts). Runs with the caller's client, so
 * row-level security applies: deleting is the Owner's, as everywhere else.
 */
export const undoSetupItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { refs: unknown[] }) => ({
    refs: (Array.isArray(d?.refs) ? d.refs : []).filter(isUndoRef).slice(0, 40),
  }))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!ctx.roles.includes("owner"))
      throw new Error("Solo el Owner puede deshacer un guardado: borra lo que se creó.");
    let undone = 0;
    const failed: string[] = [];
    for (const r of data.refs) {
      const { data: rows, error } = await ctx.db
        .from(r.table)
        .delete()
        .eq("org_id", ctx.orgId)
        .eq("id", r.id)
        .select("id");
      if (error || !rows?.length) failed.push(r.table);
      else undone++;
    }
    return { undone, failed: failed.length };
  });

// ---------------- Proactive suggestions ----------------

export const refreshSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // touched: suggestions the user opened with «Resolver»; if they no longer apply they close as done by the user.
  .inputValidator((d?: { touched?: string[] }) => ({
    touched: Array.isArray(d?.touched)
      ? d!.touched.filter((x) => typeof x === "string").slice(0, 100)
      : [],
  }))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const snap = await loadSnapshot(ctx.db, ctx.orgId);
    await syncSuggestions(ctx.db, ctx.orgId, detect(snap), data.touched, {
      onboardingSeen: (snap.onboarding ?? []).map((o) => o.user_id),
    });
    return { ok: true };
  });

export const decideSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      decision: "approve" | "snooze" | "dismiss";
      reason?: string;
      execute?: ExecuteInput;
    }) => ({
      id: String(d.id),
      decision: (["approve", "snooze", "dismiss"].includes(d.decision) ? d.decision : "dismiss") as
        "approve" | "snooze" | "dismiss",
      reason: typeof d.reason === "string" ? d.reason.slice(0, 500) : undefined,
      execute: d.execute,
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    return decideSuggestionCore(ctx, data.id, data.decision, {
      reason: data.reason,
      execute: data.execute,
    });
  });

export async function decideSuggestionCore(
  ctx: ToolCtx,
  id: string,
  decision: "approve" | "snooze" | "dismiss",
  opts: { reason?: string; execute?: ExecuteInput } = {},
) {
  const { data: s } = await ctx.db
    .from("suggestions")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  // Telegram runs this with the privileged client: the visibility rule RLS applies in the app is checked here.
  // A price suggestion is only for roles that may see prices (CA-19, CA-58): checked before «ya gestionada», so its existence is not revealed.
  if (!s || !canActOnSuggestion(s, ctx.userId, ctx.roles) || !canViewStrategy(s, ctx.roles))
    throw new Error("Sugerencia no encontrada");
  if (s.status !== "pending") return { status: s.status, message: "Ya estaba gestionada" };
  // Strategic suggestions (F0): the decision is logged with who, when and why (CA-4); acting on it arrives with F3.
  if (s.detector.startsWith("strategy_")) {
    // A test or a commercial action is only accepted with its form (CA-35, CA-36): nothing is logged until the draft is valid.
    const needs = executeFormKind(s.strategy);
    if (decision === "approve" && needs) {
      if (opts.execute === undefined)
        throw new Error(
          needs === "experiment"
            ? "No la he aceptado. Esta sugerencia crea un experimento y hay que revisarlo antes de aceptarla. Ábrela en Sugerencias, completa el formulario y acéptala allí"
            : "No la he aceptado. Esta sugerencia crea una tarea y hay que revisarla antes de aceptarla. Ábrela en Sugerencias, completa el formulario y acéptala allí",
        );
      const issue = executeIssue(needs, opts.execute);
      if (issue) throw new Error(`No la he aceptado. ${issue}`);
    } else if (decision === "approve" && opts.execute !== undefined) {
      throw new Error(`No la he aceptado. ${executeIssue(null, opts.execute)}`);
    }
    const { decideStrategy } = await import("@/lib/strategy-core");
    const r = await decideStrategy(
      ctx,
      s,
      decision === "approve" ? "accept" : decision === "snooze" ? "postpone" : "dismiss",
      { reason: opts.reason },
    );
    let result = r;
    if (r.message !== "Ya estaba gestionada" && decision === "approve") {
      // F3: accepting acts, but only inside the guard rails of strategy-execute (a pending proposal, or a task or experiment the person edited).
      const { proposeChange, createExperimentFromSuggestion, createTaskFromSuggestion } =
        await import("@/lib/strategy-execute-core");
      if (opts.execute?.kind === "experiment")
        await createExperimentFromSuggestion(ctx, id, opts.execute.draft);
      else if (opts.execute?.kind === "task")
        await createTaskFromSuggestion(ctx, id, opts.execute.draft);
      else if (await proposeChange(ctx, s))
        result = {
          ...r,
          message: "Aceptada. Queda como propuesta pendiente de confirmar; no he cambiado nada.",
        };
    }
    if (r.message !== "Ya estaba gestionada") {
      const { rememberDecision } = await import("@/lib/memory.server");
      // The memory is read by every member and by the agent: a price suggestion leaves none.
      if (decision !== "snooze" && !needsPriceAccess(s)) await rememberDecision(ctx, s, decision);
    }
    return result;
  }
  const now = new Date().toISOString();
  if (decision === "snooze") {
    await ctx.db
      .from("suggestions")
      .update({
        status: "snoozed",
        snoozed_until: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        updated_at: now,
      })
      .eq("id", id);
    return { status: "snoozed", message: "Te lo recuerdo en 3 días" };
  }
  if (decision === "dismiss") {
    await ctx.db.from("suggestions").update({ status: "dismissed", updated_at: now }).eq("id", id);
    const { rememberDecision } = await import("@/lib/memory.server");
    await rememberDecision(ctx, s, "dismiss");
    return { status: "dismissed", message: "Descartada; no volverá a aparecer" };
  }
  const { data: claimed } = await ctx.db
    .from("suggestions")
    .update({ status: "approved", updated_at: now })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { status: "approved", message: "Ya estaba gestionada" };
  const action = s.action as { tool: string; args: Record<string, unknown> } | null;
  let note = "";
  const { SPEND_TOOLS, spendEstimateLine, withEstimate } = await import("@/lib/agent/spend-confirm");
  if (action?.tool && action.tool in SPEND_TOOLS) {
    // A2: approving a suggestion that spends prepares the action with its cost estimate; it runs only on confirm.
    const { summarizeAction } = await import("@/lib/agent/tools");
    const summary = withEstimate(
      summarizeAction(action.tool, action.args),
      action.tool,
      await spendEstimateLine(ctx.db, ctx.orgId, action.tool),
    );
    const { error } = await ctx.db.from("agent_pending_actions").insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      tool: action.tool,
      args: action.args as unknown as Json,
      summary,
    });
    if (error) {
      await ctx.db.from("suggestions").update({ status: "pending" }).eq("id", id);
      throw new Error(errorText(error));
    }
    const { rememberDecision } = await import("@/lib/memory.server");
    await rememberDecision(ctx, s, "approve");
    return { status: "approved", message: `Gasta saldo: confírmalo en Sugerencias (${summary}).` };
  }
  if (action?.tool) {
    try {
      const out = await executeTool(ctx, action.tool, action.args);
      if (
        out &&
        typeof out === "object" &&
        typeof (out as { mensaje?: unknown }).mensaje === "string"
      )
        note = (out as { mensaje: string }).mensaje;
    } catch (e) {
      await ctx.db.from("suggestions").update({ status: "pending" }).eq("id", id);
      throw new Error((e as Error).message);
    }
  }
  const { rememberDecision } = await import("@/lib/memory.server");
  await rememberDecision(ctx, s, "approve");
  return {
    status: "approved",
    message: action ? (note ? `Hecho. ${note}` : "Hecho") : "Marcada como hecha",
  };
}

// ---------------- Telegram linking ----------------

export const createTelegramLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    const expires = new Date(Date.now() + 15 * 60_000).toISOString();
    const { error } = await context.supabase
      .from("channel_links")
      .upsert(
        { user_id: context.userId, channel: "telegram", link_code: code, code_expires_at: expires },
        { onConflict: "user_id,channel" },
      );
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
    } catch {
      return { connected: false as const, username: null };
    }
  });
