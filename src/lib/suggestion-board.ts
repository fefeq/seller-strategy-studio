// Team view of suggestions: who owns what and what is falling behind. Pure so the panel and tests agree.

export const OVERDUE_DAYS = 7;
export const LEADER_ROLES = ["owner", "sales_leader"] as const;
export const canSeeTeam = (roles: string[]) => roles.some((r) => (LEADER_ROLES as readonly string[]).includes(r));

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente", snoozed: "Pospuesta", approved: "Hecha", dismissed: "Descartada", resolved: "Resuelta sola",
};
export const OPEN_STATUSES = ["pending", "snoozed"] as const;

export type BoardItem = { id: string; user_id: string | null; status: string; priority: number; created_at: string; snoozed_until: string | null };

const DAY = 86_400_000;
export const ageDays = (s: Pick<BoardItem, "created_at">, now = new Date()) => Math.max(0, Math.floor((now.getTime() - new Date(s.created_at).getTime()) / DAY));
/** Pending for more than 7 days. */
export const isOverdue = (s: BoardItem, now = new Date()) => s.status === "pending" && ageDays(s, now) > OVERDUE_DAYS;

export function boardSummary(items: BoardItem[], now = new Date()) {
  const pending = items.filter((s) => s.status === "pending");
  const open = items.filter((s) => s.status === "pending" || s.status === "snoozed");
  return {
    pending: pending.length,
    urgent: pending.filter((s) => s.priority === 1).length,
    unassigned: open.filter((s) => !s.user_id).length,
    snoozed: items.filter((s) => s.status === "snoozed").length,
    overdue: pending.filter((s) => isOverdue(s, now)).length,
  };
}

/** Open suggestions per owner (null = sin responsable), most loaded first. */
export function byOwner(items: BoardItem[], now = new Date()) {
  const m = new Map<string | null, { owner: string | null; pending: number; urgent: number; overdue: number; snoozed: number }>();
  for (const s of items) {
    if (s.status !== "pending" && s.status !== "snoozed") continue;
    const g = m.get(s.user_id) ?? { owner: s.user_id, pending: 0, urgent: 0, overdue: 0, snoozed: 0 };
    if (s.status === "snoozed") g.snoozed++;
    else { g.pending++; if (s.priority === 1) g.urgent++; if (isOverdue(s, now)) g.overdue++; }
    m.set(s.user_id, g);
  }
  return [...m.values()].sort((a, b) => b.urgent - a.urgent || b.pending - a.pending);
}

/**
 * Closed suggestions (the panel loads the last 30 days): done by the user (approved: «Hecho», «Aprobar y
 * hacer» or fixed through «Resolver»), solved on their own (resolved) and dismissed — kept apart so we can
 * see which suggestions lead to real action.
 */
export function closedSummary(items: Pick<BoardItem, "status">[]) {
  const n = (st: string) => items.filter((s) => s.status === st).length;
  return { done: n("approved"), solved: n("resolved"), dismissed: n("dismissed") };
}
