// Telegram Bot API through the Lovable connector gateway (bot token injected by the gateway).
const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

export function telegramConfigured() {
  return !!process.env["LOVABLE_API_KEY"] && !!process.env["TELEGRAM_API_KEY"];
}

export async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["TELEGRAM_API_KEY"] ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Telegram ${method} failed [${res.status}]: ${text.slice(0, 300)}`);
    throw new Error(`Telegram ${method} failed [${res.status}]`);
  }
  return JSON.parse(text);
}

/** Plain text (no parse_mode) so model markdown never breaks delivery. */
export function toPlain(md: string) {
  return md.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "").replace(/`([^`]+)`/g, "$1").slice(0, 4000);
}

export async function sendText(chatId: string | number, text: string, buttons?: { text: string; data: string }[][]) {
  return tg("sendMessage", {
    chat_id: chatId,
    text: toPlain(text),
    ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) } } : {}),
  });
}

export async function webhookSecret() {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`telegram-webhook:${process.env["TELEGRAM_API_KEY"] ?? ""}`).digest("base64url");
}
