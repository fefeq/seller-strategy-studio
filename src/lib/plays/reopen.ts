import { CATALOG } from "./catalog";

// Which closed suggestions of a play's rules come back (SDD-20261109-plays-no-reopen, U-1). Pure.
// A suggestion the system closed reopens only when its play was resumed AFTER the closing: a play_states row with enabled = true
// and updated_at later than the suggestion's updated_at (play_states_stamp sets it on every write). No rows, nothing reopens.

export type PlayStateRow = { play_id: string; enabled: boolean; updated_at: string };
export type ClosedSuggestion = {
  id: string;
  detector: string;
  updated_at: string;
  snoozed_until: string | null;
};
export type Reopening = { status: "pending" | "snoozed"; snoozed_until: string | null };

/**
 * For each closed suggestion of a detector that belongs to a play: null (leave it closed) or how it reopens. Suggestions of a
 * detector that belongs to no play are not in the result. A postponement still in the future is kept (snoozed); one that passed
 * or is empty comes back pending with no date. Instants are compared as dates, never as text.
 */
export function reopenable(
  rows: PlayStateRow[],
  closed: ClosedSuggestion[],
  now: Date,
): Map<string, Reopening | null> {
  const resumedAt = new Map<string, number>();
  for (const r of rows) {
    const t = Date.parse(r.updated_at);
    if (r.enabled && Number.isFinite(t)) resumedAt.set(r.play_id, t);
  }
  const out = new Map<string, Reopening | null>();
  for (const c of closed) {
    const plays = CATALOG.filter((p) => p.detectors.includes(c.detector));
    if (!plays.length) continue;
    const closedAt = Date.parse(c.updated_at);
    const resumed =
      Number.isFinite(closedAt) &&
      plays.some((p) => {
        const t = resumedAt.get(p.id);
        return t !== undefined && t > closedAt;
      });
    if (!resumed) {
      out.set(c.id, null);
      continue;
    }
    const until = c.snoozed_until ? Date.parse(c.snoozed_until) : NaN;
    out.set(
      c.id,
      Number.isFinite(until) && until > now.getTime()
        ? { status: "snoozed", snoozed_until: c.snoozed_until }
        : { status: "pending", snoozed_until: null },
    );
  }
  return out;
}
