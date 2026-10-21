// Transactional email through Resend's HTTP API. Server-only: the key lives in Lovable Cloud
// secrets as RESEND_API_KEY; RESEND_FROM is the verified sender («Nokko <informes@nokko.ai>»).
// Without the key nothing is sent and the caller gets { sent: false } so it can carry on.

export function emailConfigured() {
  return !!process.env["RESEND_API_KEY"];
}

const FROM = () => process.env["RESEND_FROM"] || "Nokko <informes@nokko.ai>";

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Plain text in a readable column; the text version is the same content. */
export function textToHtml(title: string, text: string, link?: { href: string; label: string }) {
  const body = escape(text).split("\n").map((l) => (l.trim() === "" ? "<br>" : `<p style="margin:0 0 4px">${l}</p>`)).join("");
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;font-size:15px;line-height:1.5">
<h1 style="font-size:22px;font-weight:500;margin:0 0 16px">${escape(title)}</h1>
${body}
${link ? `<p style="margin:20px 0 0"><a href="${escape(link.href)}" style="color:#1a1a1a">${escape(link.label)} →</a></p>` : ""}
<p style="margin:28px 0 0;font-size:12px;color:#777">Nokko te envía este informe cada lunes. Puedes desactivarlo desde la configuración de Telegram y avisos de la app.</p>
</div>`;
}

export async function sendEmail(opts: { to: string[]; subject: string; text: string; html?: string }): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (!emailConfigured()) return { sent: false, error: "RESEND_API_KEY no configurada" };
  if (!opts.to.length) return { sent: false, error: "sin destinatarios" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM(), to: opts.to, subject: opts.subject, text: opts.text, html: opts.html ?? textToHtml(opts.subject, opts.text) }),
  });
  if (!res.ok) {
    const err = (await res.text().catch(() => "")).slice(0, 300);
    console.error("resend error", res.status, err);
    return { sent: false, error: `Resend ${res.status}: ${err}` };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: data.id };
}
