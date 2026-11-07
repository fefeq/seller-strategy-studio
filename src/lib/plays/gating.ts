import { CATALOG } from "./catalog";
import { effectiveState } from "./status";

// Which proactive rules a company has switched off by pausing plays (SDD-20261106-plays-library-core, U-5). Pure.
// A company with no play_states rows has none switched off, so detect() behaves exactly as before.

/** The proactive rules (`detector` ids) that belong to the given plays. */
export function detectorsOf(playIds: string[]): Set<string> {
  const ids = new Set(playIds);
  return new Set(CATALOG.filter((p) => ids.has(p.id)).flatMap((p) => p.detectors));
}

/** Plays that run proactive rules and are paused for the company, from its play_states rows. Rows for plays that are not in the catalogue are ignored. */
export function disabledPlayIds(rows: { play_id: string; enabled: boolean }[]): string[] {
  const byId = new Map(rows.map((r) => [r.play_id, r]));
  return CATALOG.filter(
    (p) => p.detectors.length > 0 && !effectiveState(p, byId.get(p.id)).enabled,
  ).map((p) => p.id);
}
