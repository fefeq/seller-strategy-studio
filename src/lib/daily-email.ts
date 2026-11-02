// Daily briefing email (pure, tested): when it is due for a person and how it reads. The content reuses
// src/lib/briefing.ts so the email and Inicio say the same; the sending is in daily-email.server.ts.
import type { BriefItem, BriefLink } from "@/lib/briefing";

export type DailyPrefs = { daily_email: boolean; daily_email_hour: number; timezone: string };
export const DEFAULT_DAILY: DailyPrefs = { daily_email: true, daily_email_hour: 8, timezone: "Europe/Madrid" };
/** If the chosen hour's run fails or is missed, later runs that day still send it, up to this many hours late. */
export const DAILY_WINDOW_HOURS = 3;

/** Local calendar day (YYYY-MM-DD), hour and minutes since midnight in the person's time zone. */
export function localClock(now: Date, timeZone: string): { day: string; hour: number; minutes: number; offsetMin: number } {
  let tz = timeZone;
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); } catch { tz = DEFAULT_DAILY.timezone; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24, minute = Number(parts.minute);
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, minute);
  return { day, hour, minutes: hour * 60 + minute, offsetMin: Math.round((asUtc - Math.floor(now.getTime() / 60_000) * 60_000) / 60_000) };
}

/** Due when it is on, and the local hour is the chosen one or up to DAILY_WINDOW_HOURS - 1 later. `day` is the once-per-day key. */
export function dailyEmailDue(prefs: DailyPrefs, now: Date): { due: boolean; day: string } {
  const c = localClock(now, prefs.timezone);
  const late = c.hour - prefs.daily_email_hour;
  return { due: prefs.daily_email && late >= 0 && late < DAILY_WINDOW_HOURS, day: c.day };
}

export type DailyContent = { name: string; orgName: string; auto: BriefItem[]; decisions: string[]; today: BriefItem[]; hour: number };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const href = (base: string, l: BriefLink | null) => (l == null ? null : typeof l === "string" ? `${base}${l}` : `${base}/accounts/${l.account}`);

export function dailySubject(c: DailyContent): string {
  const n = c.decisions.length;
  return n ? `${c.orgName} · ${n} ${n === 1 ? "cosa necesita" : "cosas necesitan"} tu decisión hoy` : `${c.orgName} · Tu resumen de hoy`;
}

/** Plain text and HTML of the email, in the Nokko Edición look (paper, ink, one red rule, no boxes). */
export function dailyEmailBody(c: DailyContent, base: string): { text: string; html: string } {
  const hello = `Buenos días${c.name ? `, ${c.name}` : ""}.`;
  const blocks: { title: string; items: { text: string; link: string | null }[]; empty: string }[] = [
    { title: "Lo que hice solo desde ayer", items: c.auto.map((i) => ({ text: i.text, link: href(base, i.link) })), empty: "Nada nuevo: no hubo trabajo automático." },
    { title: "Necesita tu decisión", items: c.decisions.map((t) => ({ text: t, link: `${base}/inbox` })), empty: "Nada pendiente de ti." },
    { title: "Hoy", items: c.today.map((i) => ({ text: i.text, link: href(base, i.link) })), empty: "Sin reuniones, tareas ni seguimientos para hoy." },
  ];
  const prefs = `${base}/team#avisos`;
  const foot = `Te llega cada día a las ${String(c.hour).padStart(2, "0")}:00. Cambia la hora o desactívalo en Equipo → Avisos: ${prefs}`;
  const text = [hello, "", ...blocks.flatMap((b) => [b.title.toUpperCase(), ...(b.items.length ? b.items.map((i) => `· ${i.text}`) : [b.empty]), ""]), `Abrir Nokko: ${base}/home`, "", foot].join("\n");
  const ink = "#14161a", grey = "#646a74", accent = "#3b45d6";
  const html = `<div style="background:#f6f6f4;padding:32px 0"><div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:0 24px;color:${ink};font-size:15px;line-height:1.55">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${accent}">Nokko · ${esc(c.orgName)}</p>
<h1 style="margin:0 0 20px;font-size:26px;font-weight:500;line-height:1.2">${esc(hello)}</h1>
${blocks.map((b) => `<div style="border-top:1px solid ${ink};padding-top:10px;margin-top:22px">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${grey}">${esc(b.title)}</p>
${b.items.length ? b.items.map((i) => `<p style="margin:0 0 6px">${i.link ? `<a href="${esc(i.link)}" style="color:${ink};text-decoration:underline">${esc(i.text)}</a>` : esc(i.text)}</p>`).join("") : `<p style="margin:0;color:${grey}">${esc(b.empty)}</p>`}
</div>`).join("")}
<p style="margin:28px 0 0"><a href="${esc(`${base}/home`)}" style="display:inline-block;background:${ink};color:#f6f6f4;padding:10px 16px;text-decoration:none">Abrir Nokko</a></p>
<p style="margin:28px 0 0;font-size:12px;color:${grey}">Te llega cada día a las ${String(c.hour).padStart(2, "0")}:00. <a href="${esc(prefs)}" style="color:${grey}">Cambia la hora o desactívalo</a> en Equipo → Avisos.</p>
</div></div>`;
  return { text, html };
}
