// Email through Resend, via the Lovable connector gateway (the linked Resend connection gives
// RESEND_API_KEY, a gateway key, plus LOVABLE_API_KEY). Server-only. Sender «Nokko <avisos@nokko.ai>»
// unless RESEND_FROM says otherwise; nokko.ai must be verified in that Resend account.
// Without the keys nothing is sent and the caller gets { sent: false } so it can carry on.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export function emailConfigured() {
  return !!process.env["RESEND_API_KEY"] && !!process.env["LOVABLE_API_KEY"];
}

const FROM = () => process.env["RESEND_FROM"] || "Nokko <avisos@nokko.ai>";

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Plain text in a readable column; the text version is the same content. */
export function textToHtml(title: string, text: string, link?: { href: string; label: string }, footer = "Nokko te envía este informe cada lunes. Puedes desactivarlo desde la configuración de Telegram y avisos de la app.") {
  const body = escape(text).split("\n").map((l) => (l.trim() === "" ? "<br>" : `<p style="margin:0 0 4px">${l}</p>`)).join("");
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#14161a;font-size:15px;line-height:1.5">
<h1 style="font-size:22px;font-weight:500;margin:0 0 16px">${escape(title)}</h1>
${body}
${link ? `<p style="margin:20px 0 0"><a href="${escape(link.href)}" style="color:#14161a">${escape(link.label)} →</a></p>` : ""}
<p style="margin:28px 0 0;font-size:12px;color:#646a74">${escape(footer)}</p>
</div>`;
}

export type SendResult = { sent: boolean; id?: string; error?: string; status?: number };

/** One send. Each recipient in `to` sees the others: pass one address per call for personal emails. */
export async function sendEmail(opts: { to: string[]; subject: string; text: string; html?: string; idempotencyKey?: string }): Promise<SendResult> {
  if (!emailConfigured()) return { sent: false, error: "Resend no está conectado" };
  if (!opts.to.length) return { sent: false, error: "sin destinatarios" };
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["RESEND_API_KEY"]!,
      "Content-Type": "application/json",
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({ from: FROM(), to: opts.to, subject: opts.subject, text: opts.text, html: opts.html ?? textToHtml(opts.subject, opts.text) }),
  });
  if (!res.ok) {
    const err = (await res.text().catch(() => "")).slice(0, 300);
    console.error("resend error", res.status, err);
    return { sent: false, status: res.status, error: `Resend ${res.status}: ${err}` };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: data.id };
}
