// Background jobs → notices (pure; tested). How a finished task reads in the notification centre, who hears
// about it on Telegram and when, and the small rules the job runner shares with the screens.
import { ENRICH_LABEL, type EnrichField } from "@/lib/clay";

export type JobNotice = { title: string; body: string | null; link: string; needs_decision: boolean };

type Change = { field: EnrichField; empty: boolean; proposed: string | null };
type CompleteOut = { changes: Change[]; found: boolean; sources: string; blocked: string | null };

const list = (fields: EnrichField[]) => fields.map((f) => ENRICH_LABEL[f]?.toLowerCase() ?? f).join(", ");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «Completar datos» run in the background: empty fields were written; differing ones wait for a person. */
export function completeNotice(account: { id: string; name: string }, out: CompleteOut, written: EnrichField[]): JobNotice {
  const link = `/accounts/${account.id}`;
  if (out.blocked) return { title: `No he completado ${account.name}`, body: out.blocked, link, needs_decision: false };
  const review = out.changes.filter((c) => !c.empty && c.proposed).map((c) => c.field);
  if (!out.found || (!written.length && !review.length))
    return { title: `${account.name}: no encontré datos nuevos`, body: out.sources || null, link, needs_decision: false };
  const parts: string[] = [];
  if (written.length) parts.push(`Completé ${list(written)}`);
  if (review.length) parts.push(`${written.length ? "y hay" : "Hay"} ${review.length === 1 ? "un dato distinto" : `${review.length} datos distintos`} a lo que tenías (${list(review)}): revísalo`);
  return { title: `${account.name}: ${parts.join(" ")}.`, body: out.sources || null, link, needs_decision: review.length > 0 };
}

type SearchOut = { rows: { existingId?: string | null }[]; sources: string; blocked: string | null };

/** «Buscar personas clave» finished: how many new people, and a link that reopens the results. */
export function peopleNotice(account: { id: string; name: string }, out: SearchOut): JobNotice {
  const link = `/accounts/${account.id}?tab=stakeholders&people=1`;
  if (out.blocked) return { title: `No he buscado personas en ${account.name}`, body: out.blocked, link, needs_decision: false };
  const fresh = out.rows.filter((r) => !r.existingId).length;
  if (!fresh) return { title: `${account.name}: no encontré personas clave nuevas`, body: out.sources || null, link, needs_decision: false };
  return { title: `${account.name}: encontré ${plural(fresh, "persona clave", "personas clave")}. Elige cuáles añadir al mapa.`, body: out.sources || null, link, needs_decision: true };
}

/** «Buscar empresas por ICP» finished. */
export function companiesNotice(out: SearchOut): JobNotice {
  const link = "/accounts?icp=1";
  if (out.blocked) return { title: "No he buscado empresas", body: out.blocked, link, needs_decision: false };
  const fresh = out.rows.filter((r) => !r.existingId).length;
  if (!fresh) return { title: "Búsqueda por ICP: ninguna empresa nueva con esos criterios", body: out.sources || null, link, needs_decision: false };
  return { title: `Búsqueda por ICP: ${plural(fresh, "empresa nueva", "empresas nuevas")}. Elige cuáles añadir como cuentas.`, body: out.sources || null, link, needs_decision: true };
}

/** Jev qualification of a batch of leads. */
export function qualifyNotice(out: { done: number; failed: number; error: string | null; moves: number }): JobNotice {
  const link = "/leads";
  if (!out.done && !out.failed) return { title: "No había leads abiertos pendientes de calificar", body: null, link, needs_decision: false };
  if (!out.done) return { title: "No he podido calificar los leads", body: out.error, link, needs_decision: false };
  const moves = out.moves ? ` ${plural(out.moves, "propone cambiar de etapa", "proponen cambiar de etapa")}: revísalo en Leads.` : "";
  const rest = out.failed ? ` ${out.failed} no se pudieron calificar${out.error ? `: ${out.error}` : "."}` : "";
  return { title: `${plural(out.done, "lead calificado", "leads calificados")} con IA.${moves}`, body: rest.trim() || null, link, needs_decision: out.moves > 0 };
}

/** Where a job's notice leads when the job itself left no link (a failure): the record or the screen it came from. */
export function jobLink(kind: string, input: Record<string, unknown> | null | undefined): string {
  const i = input ?? {};
  const acc = typeof i.accountId === "string" ? `/accounts/${i.accountId}` : null;
  switch (kind) {
    case "key_people": return acc ? `${acc}?tab=stakeholders` : "/accounts";
    case "stakeholder_research": return "/accounts";
    case "account_signals": return acc ? `${acc}?tab=signals` : "/accounts";
    case "complete_account": case "account_research": return acc ?? "/accounts";
    case "icp_companies": return "/accounts";
    case "qualify_leads": return "/leads";
    case "discover": return "/discoveries";
    case "autopilot_now": return "/home";
    case "weekly_report": return "/inbox";
    case "posthog_sync": return "/integrations";
    case "debate": return "/debates";
    case "draft_artifact": return "/cycle";
    case "onboarding_read": return "/onboarding";
    case "deep_review": return typeof i.artifactId === "string" ? `/cycle?artifact=${i.artifactId}` : "/cycle";
    default: return "/hub";
  }
}

/** «Traer más» appends the next page to the previous results, without repeating a row. */
export function appendRows<R>(prev: R[], next: R[], key: (r: R) => string): R[] {
  const seen = new Set(prev.map(key));
  return [...prev, ...next.filter((r) => { const k = key(r); if (seen.has(k)) return false; seen.add(k); return true; })];
}

/** A second click on the same task for the same record reuses the one already running. */
export function activeJobFor<J extends { kind: string; target_id: string | null; status: string }>(jobs: J[], kind: string, targetId: string): J | null {
  return jobs.find((j) => j.kind === kind && j.target_id === targetId && (j.status === "queued" || j.status === "running")) ?? null;
}

export const unreadCount = (rows: { read_at: string | null }[]) => rows.filter((r) => !r.read_at).length;

/** A result a screen still shows: finished, recent (24 h) and not set aside by the person. */
export function freshResult<J extends { status: string; finished_at: string | null; id: string }>(job: J | null | undefined, dismissed: string | null, now = Date.now()): J | null {
  if (!job || job.status !== "done" || job.id === dismissed || !job.finished_at) return null;
  return now - new Date(job.finished_at).getTime() < 24 * 3_600_000 ? job : null;
}

// ---------------- Telegram ----------------

export type TelegramLevel = "all" | "important" | "decisions" | "off";
export type NoticePrefs = { telegram: TelegramLevel; quiet_from: number; quiet_to: number; timezone: string };
export const DEFAULT_PREFS: NoticePrefs = { telegram: "important", quiet_from: 22, quiet_to: 8, timezone: "Europe/Madrid" };
export const TELEGRAM_LEVEL_LABEL: Record<TelegramLevel, string> = {
  all: "Todo lo que termine",
  important: "Solo lo importante",
  decisions: "Solo lo que necesita mi decisión",
  off: "Nada por Telegram",
};

/** Finished tasks worth a Telegram message under «Solo lo importante» (fails and decisions always are). */
export const IMPORTANT_JOBS = new Set(["discover", "autopilot_now", "weekly_report", "qualify_leads", "debate", "draft_artifact", "playbook_library", "icp_companies", "key_people"]);

/** Hour of the day (0–23) in a time zone; falls back to UTC if the zone is unknown. */
export function localHour(now: Date, timeZone: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(now);
    return Number(h) % 24;
  } catch { return now.getUTCHours(); }
}

/** Night silence: from quiet_from (inclusive) to quiet_to (exclusive), wrapping midnight; equal hours = no silence. */
export function isQuiet(hour: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Whether a notice deserves Telegram for this person's preference (ignores the time of day). */
export function telegramWorthy(notice: { kind: string }, jobKind: string | null, level: TelegramLevel): boolean {
  if (level === "off") return false;
  if (level === "all") return true;
  if (notice.kind === "needs_decision") return true;
  if (level === "decisions") return false;
  return notice.kind === "failed" || (!!jobKind && IMPORTANT_JOBS.has(jobKind)) || notice.kind === "autopilot" || notice.kind === "money";
}

/** Send now, hold until the night silence ends, or never. */
export function telegramDecision(notice: { kind: string }, jobKind: string | null, prefs: NoticePrefs, now: Date): "send" | "hold" | "skip" {
  if (!telegramWorthy(notice, jobKind, prefs.telegram)) return "skip";
  return isQuiet(localHour(now, prefs.timezone), prefs.quiet_from, prefs.quiet_to) ? "hold" : "send";
}

/** The Telegram text: title, detail and an absolute link to open it in Nokko. */
export function telegramText(n: { title: string; body: string | null; link: string | null }, siteUrl: string): string {
  return [n.title, n.body, n.link ? `${siteUrl}${n.link.startsWith("/") ? n.link : `/${n.link}`}` : null].filter(Boolean).join("\n\n").slice(0, 3900);
}
