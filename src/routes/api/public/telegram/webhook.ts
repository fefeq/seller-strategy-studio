import { createFileRoute } from "@tanstack/react-router";
import { safeErrorLog, storedErrorLabel } from "@/lib/agent/safe-error-log";
import { errorText } from "@/lib/errors";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { webhookSecret, sendText, tg, telegramConfigured } =
          await import("@/lib/telegram.server");
        if (!telegramConfigured()) return new Response("Not configured", { status: 503 });
        const expected = await webhookSecret();
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        const { timingSafeEqual } = await import("node:crypto");
        const a = Buffer.from(actual),
          b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b))
          return new Response("Unauthorized", { status: 401 });

        const update = await request.json().catch(() => null);
        if (!update || typeof update.update_id !== "number")
          return Response.json({ ok: true, ignored: true });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        // Idempotency: first writer wins; a retried update that already completed is skipped.
        const { error: insErr } = await db
          .from("telegram_updates")
          .insert({ update_id: update.update_id, payload: update });
        if (insErr) return Response.json({ ok: true, duplicate: true });

        try {
          await handle(db, update, { sendText, tg });
          await db
            .from("telegram_updates")
            .update({ processed_at: new Date().toISOString(), error: null })
            .eq("update_id", update.update_id);
        } catch (e) {
          console.error("telegram handle failed", safeErrorLog(e));
          await db
            .from("telegram_updates")
            .update({
              processed_at: new Date().toISOString(),
              error: storedErrorLabel(e),
            })
            .eq("update_id", update.update_id);
        }
        return Response.json({ ok: true });
      },
    },
  },
});

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type Tg = {
  sendText: (
    chat: string | number,
    text: string,
    b?: { text: string; data: string }[][],
  ) => Promise<unknown>;
  tg: (m: string, b: Record<string, unknown>) => Promise<unknown>;
};

/** The parts of a Telegram update this handler reads (the webhook body is untrusted JSON). */
type TelegramUpdate = {
  callback_query?: {
    id?: string;
    data?: string;
    message?: { chat?: { id?: string | number } };
  };
  message?: { chat?: { id?: string | number }; text?: unknown };
};

async function handle(db: Admin, update: TelegramUpdate, t: Tg) {
  const { channelCtx } = await import("@/lib/channel-ctx.server");

  // Button presses (confirm agent actions / manage suggestions).
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = String(cq.message?.chat?.id ?? "");
    await t.tg("answerCallbackQuery", { callback_query_id: cq.id }).catch(() => {});
    const { data: link } = await db
      .from("channel_links")
      .select("user_id")
      .eq("channel", "telegram")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (!link) return;
    const ctx = await channelCtx(db, link.user_id);
    if (!ctx) return t.sendText(chatId, "No tienes una empresa activa en Nokko.");
    const [kind, id, decision] = String(cq.data ?? "").split(":");
    const { decidePending, decideSuggestionCore } = await import("@/lib/agent.functions");
    try {
      if (kind === "a") {
        const r = await decidePending(ctx, id, decision === "c" ? "confirm" : "cancel");
        return t.sendText(
          chatId,
          r.status === "confirmed"
            ? r.result || "Hecho."
            : r.status === "cancelled"
              ? "Cancelado."
              : `No se ha podido hacer. ${r.result || "Vuelve a intentarlo desde Sugerencias, en la app."}`,
        );
      }
      if (kind === "q") {
        const said = String(cq.data ?? "").slice(2);
        if (said) await agentReply(db, ctx, chatId, said, t);
        return;
      }
      if (kind === "n") {
        const { parseAutonomy, AUTONOMY } = await import("@/lib/autonomy");
        const level = parseAutonomy(id);
        const up = await db
          .from("user_agent_prefs")
          .upsert({ user_id: ctx.userId, autonomy: level, updated_at: new Date().toISOString() });
        if (up.error) throw up.error;
        return t.sendText(
          chatId,
          `Nivel cambiado a ${AUTONOMY[level].label}. ${AUTONOMY[level].short} Puedes cambiarlo cuando quieras con /nivel.`,
        );
      }
      if (
        kind === "s" &&
        (decision === "approve" || decision === "dismiss" || decision === "snooze")
      ) {
        const r = await decideSuggestionCore(ctx, id, decision);
        return t.sendText(chatId, r.message);
      }
    } catch (e) {
      return t.sendText(chatId, `No se ha podido hacer. ${errorText(e)}`);
    }
    return;
  }

  const msg = update.message;
  if (!msg?.chat?.id || typeof msg.text !== "string") return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();

  // Linking: "/start CODE" (deep link) or "/vincular CODE".
  const m = text.match(/^\/(?:start|vincular)\s+([A-Z0-9]{6})$/i);
  if (m) {
    const code = m[1].toUpperCase();
    const { data: link } = await db
      .from("channel_links")
      .select("id,code_expires_at")
      .eq("link_code", code)
      .maybeSingle();
    if (!link || !link.code_expires_at || new Date(link.code_expires_at) < new Date())
      return t.sendText(
        chatId,
        "Ese código no es válido o ha caducado. Genera uno nuevo en Nokko → Equipo.",
      );
    await db
      .from("channel_links")
      .update({ chat_id: null })
      .eq("channel", "telegram")
      .eq("chat_id", chatId);
    await db
      .from("channel_links")
      .update({
        chat_id: chatId,
        linked_at: new Date().toISOString(),
        link_code: null,
        code_expires_at: null,
      })
      .eq("id", link.id);
    return t.sendText(
      chatId,
      "Tu cuenta de Nokko está vinculada. Pregúntame lo que quieras (p. ej. «¿qué debería hacer hoy?») y cada mañana te enviaré tus 3 prioridades.",
    );
  }

  const { data: link } = await db
    .from("channel_links")
    .select("user_id")
    .eq("channel", "telegram")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!link)
    return t.sendText(
      chatId,
      "Hola, soy Nokko. Para usarme, abre la app → Equipo → «Conectar Telegram» y envíame el código: /vincular CÓDIGO",
    );
  if (text === "/start") return t.sendText(chatId, "Ya estás vinculado. ¿En qué te ayudo?");
  const ctx = await channelCtx(db, link.user_id);
  if (!ctx)
    return t.sendText(chatId, "No tienes una empresa activa en Nokko. Elige una en la app.");

  if (text === "/nivel") {
    const { autonomyBlocks } = await import("@/lib/autonomy-blocks");
    const { toTelegram } = await import("@/lib/conversation");
    const { data: pref } = await db
      .from("user_agent_prefs")
      .select("autonomy")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    const { absoluteUrl } = await import("@/lib/site");
    const r = toTelegram(autonomyBlocks(pref?.autonomy, "n:"), absoluteUrl("/"));
    return t.sendText(chatId, r.text, r.buttons);
  }

  if (text === "/nueva") {
    await db
      .from("agent_conversations")
      .insert({ org_id: ctx.orgId, user_id: ctx.userId, channel: "telegram", title: "Telegram" });
    return t.sendText(chatId, "Nueva conversación. ¿Qué necesitas?");
  }

  return agentReply(db, ctx, chatId, text, t);
}

type Ctx = NonNullable<
  Awaited<ReturnType<(typeof import("@/lib/channel-ctx.server"))["channelCtx"]>>
>;

/** Runs the shared agent and answers with the same E2 blocks the app shows (actions, next steps, links). */
async function agentReply(db: Admin, ctx: Ctx, chatId: string, text: string, t: Tg) {
  await t.tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  let { data: conv } = await db
    .from("agent_conversations")
    .select("id")
    .eq("org_id", ctx.orgId)
    .eq("user_id", ctx.userId)
    .eq("channel", "telegram")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conv)
    conv = (
      await db
        .from("agent_conversations")
        .insert({ org_id: ctx.orgId, user_id: ctx.userId, channel: "telegram", title: "Telegram" })
        .select("id")
        .single()
    ).data;
  if (!conv) return;

  const { runAgent } = await import("@/lib/agent/agent.server");
  try {
    const out = await runAgent(ctx, {
      conversationId: conv.id,
      text: text.slice(0, 4000),
      channel: "telegram",
      mode: "chat",
      orgName: ctx.orgName,
    });
    const { replyBlocks, toTelegram } = await import("@/lib/conversation");
    const { absoluteUrl } = await import("@/lib/site");
    const r = toTelegram(replyBlocks(out.text, out.pending), absoluteUrl("/"));
    await t.sendText(
      chatId,
      r.text ? `${out.text}\n\n${r.text}` : out.text,
      r.buttons.length ? r.buttons : undefined,
    );
  } catch (e) {
    await t.sendText(chatId, errorText(e));
  }
}
