// NK-0174 SDD 2 (pure, tested): sender-only queries (design B), exact matching, human vs automatic by headers,
// and which leads get the anonymous «respondió» mark. No message text is ever read here.

export const MAX_SENDERS_PER_QUERY = 20;
export const LOOKBACK_DAYS = 30;
export const MAX_MESSAGES_PER_PASS = 100;

export const normEmail = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** R-1: one Gmail query per batch of contacted-lead addresses; never a query without a sender filter. */
export function senderQueries(
  emails: string[],
  days = LOOKBACK_DAYS,
  size = MAX_SENDERS_PER_QUERY,
): string[] {
  const list = [
    ...new Set(emails.map(normEmail).filter((e) => /^[^\s@()"]+@[^\s@()"]+\.[^\s@()"]+$/.test(e))),
  ].sort();
  const out: string[] = [];
  for (let i = 0; i < list.length; i += size)
    out.push(`from:(${list.slice(i, i + size).join(" OR ")}) newer_than:${days}d`);
  return out;
}

/** Address inside a From header: «Name <a@b.c>» or «a@b.c». */
export function senderAddress(from: string | null | undefined): string {
  const m = /<([^>]+)>/.exec(from ?? "");
  return normEmail(m ? m[1] : from);
}

export type Headers = Record<string, string | undefined>;
export function headerMap(list: { name: string; value: string }[] | undefined): Headers {
  const h: Headers = {};
  for (const x of list ?? []) h[x.name.toLowerCase()] = x.value;
  return h;
}

/** R-3: «auto» by headers, «drop» for delivery daemons, else «human». */
export function replyKind(h: Headers): "human" | "auto" | "drop" {
  const from = senderAddress(h["from"]);
  if (/^(mailer-daemon|postmaster)@/.test(from)) return "drop";
  const auto = h["auto-submitted"];
  if (auto && auto.trim().toLowerCase() !== "no") return "auto";
  if (/^(bulk|junk|auto_reply|list)$/i.test((h["precedence"] ?? "").trim())) return "auto";
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]) return "auto";
  return "human";
}

export type FoundMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  headers: Headers;
};
export type ContactedLead = { id: string; email: string | null };
export type ReplyRow = {
  gmail_id: string;
  thread_id: string;
  lead_id: string;
  received_at: string;
  kind: "human" | "auto";
};

/** R-2 + R-4: rows to store and the leads to mark (latest human reply date). Unmatched senders are ignored. */
export function matchReplies(messages: FoundMessage[], leads: ContactedLead[]) {
  const byEmail = new Map<string, string>();
  for (const l of leads) {
    const e = normEmail(l.email);
    if (e && !byEmail.has(e)) byEmail.set(e, l.id);
  }
  const rows: ReplyRow[] = [];
  const marks = new Map<string, string>();
  for (const m of messages) {
    const lead = byEmail.get(senderAddress(m.headers["from"]));
    if (!lead) continue;
    const kind = replyKind(m.headers);
    if (kind === "drop") continue;
    const ms = Number(m.internalDate);
    const at =
      Number.isFinite(ms) && ms > 0
        ? new Date(ms).toISOString()
        : new Date(m.headers["date"] ?? 0).toISOString();
    rows.push({ gmail_id: m.id, thread_id: m.threadId, lead_id: lead, received_at: at, kind });
    if (kind === "human" && (!marks.has(lead) || marks.get(lead)! < at)) marks.set(lead, at);
  }
  return { rows, marks: [...marks].map(([lead_id, replied_at]) => ({ lead_id, replied_at })) };
}
