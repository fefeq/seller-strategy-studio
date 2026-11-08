// Quarter filters of /metrics (SDD-20261106-metrics-honest-data U-1): the funnel, the lost deals and the win
// rates follow the selected quarter. Pure and tested; src/lib/revops.ts stays as ported, it just receives the
// filtered deals.
import { winRate } from "@/lib/metrics";
import type { RHistory } from "@/lib/revops";

type Range = { start: Date; end: Date };
type Dated = {
  id: string;
  created_at: string;
  closed_at: string | null;
  updated_at?: string | null;
};
type Closable = {
  stage: string;
  closed_at: string | null;
  updated_at?: string | null;
  source: string | null;
};

/** Key of a deal without source: shown as «Sin origen», like Perdidos and Cohortes. */
export const NO_SOURCE = "—";

const inRange = (s: string | null | undefined, r: Range) => {
  if (!s) return false;
  const t = new Date(s).getTime();
  return t >= r.start.getTime() && t < r.end.getTime();
};
/** The rule /metrics already uses for a closed deal: closed_at, else updated_at. */
const closedIn = (d: { closed_at: string | null; updated_at?: string | null }, r: Range) =>
  inRange(d.closed_at ?? d.updated_at, r);

const historyOf = (deals: { id: string }[], history: RHistory[]) => {
  const ids = new Set(deals.map((d) => d.id));
  return history.filter((h) => ids.has(h.deal_id));
};

/** Embudo of the quarter: deals created in it, with their whole history. */
export function funnelInQuarter<D extends Dated>(deals: D[], history: RHistory[], range: Range) {
  const kept = deals.filter((d) => inRange(d.created_at, range));
  return { deals: kept, history: historyOf(kept, history) };
}

/** Perdidos of the quarter: lost deals closed (closed_at ?? updated_at) in it, with their history. */
export function lostInQuarter<D extends Dated & { stage: string }>(
  deals: D[],
  history: RHistory[],
  range: Range,
) {
  const kept = deals.filter((d) => d.stage === "lost" && closedIn(d, range));
  return { deals: kept, history: historyOf(kept, history) };
}

export type WinGroup = { k: string; won: number; lost: number; rate: number };

/**
 * Win rate of the deals closed in the quarter: global (rate null without closed deals, never a measured 0),
 * by source (null source → NO_SOURCE) and by rep (`repOf` names the owner).
 */
export function quarterWinRates<D extends Closable>(
  deals: D[],
  range: Range,
  repOf: (d: D) => string,
) {
  const closed = deals.filter(
    (d) => (d.stage === "won" || d.stage === "lost") && closedIn(d, range),
  );
  const group = (key: (d: D) => string): WinGroup[] => {
    const g: Record<string, { won: number; lost: number }> = {};
    for (const d of closed) {
      const k = key(d);
      g[k] ??= { won: 0, lost: 0 };
      g[k][d.stage === "won" ? "won" : "lost"]++;
    }
    return Object.entries(g).map(([k, v]) => ({ k, ...v, rate: winRate(v.won, v.lost) }));
  };
  const won = closed.filter((d) => d.stage === "won").length;
  return {
    overall: {
      won,
      lost: closed.length - won,
      closed: closed.length,
      rate: closed.length ? won / closed.length : null,
    },
    bySource: group((d) => d.source ?? NO_SOURCE),
    byRep: group(repOf),
  };
}
