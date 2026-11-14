// NK-0174 SDD 4 (pure, tested): ordering, filter and headline for the «Respuestas» screen. Metadata only.
export type ReplyKind = "human" | "auto";
export type InboxRow = { id: string; received_at: string; kind: ReplyKind; lead_id: string | null };
export type InboxFilter = "all" | ReplyKind;

export const FILTER_LABEL: Record<InboxFilter, string> = { all: "Todas", human: "De personas", auto: "Automáticas" };
export const KIND_LABEL: Record<ReplyKind, string> = { human: "Respuesta de persona", auto: "Respuesta automática" };

export function viewReplies<T extends InboxRow>(rows: T[], filter: InboxFilter): T[] {
  return rows.filter((r) => filter === "all" || r.kind === filter).sort((a, b) => b.received_at.localeCompare(a.received_at));
}

export function repliesHeadline(rows: InboxRow[], now = new Date(), days = 30): string {
  const since = now.getTime() - days * 86_400_000;
  const n = rows.filter((r) => r.kind === "human" && Date.parse(r.received_at) >= since).length;
  if (!n) return "Respuestas";
  return `${n} ${n === 1 ? "respuesta" : "respuestas"} de personas en ${days} días`;
}
