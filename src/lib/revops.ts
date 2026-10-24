/**
 * RevOps analysis (ported from the RevOps Dashboard engine, fed with Nokko's real deals).
 * Pure and tested: reconciled stage funnel, closed-lost analysis, cohorts and weekly trends.
 */

export type RDeal = {
  id: string; stage: string; amount: number | null; created_at: string; closed_at: string | null;
  updated_at?: string | null; source: string | null; segment_id: string | null;
};
export type RHistory = { deal_id: string; from_stage: string | null; to_stage: string; changed_at: string };

const WON = "won";
const LOST = "lost";
const DAY = 86_400_000;

/** Furthest open stage a deal reached (index in path), and the stage it was in when lost. */
function journey(d: RDeal, hist: RHistory[], path: string[]) {
  const idx = (s: string | null) => (s ? path.indexOf(s) : -1);
  let reached = idx(d.stage);
  let lostFrom: string | null = null;
  for (const h of hist) {
    reached = Math.max(reached, idx(h.to_stage), idx(h.from_stage));
    if (h.to_stage === LOST && h.from_stage && h.from_stage !== LOST) lostFrom = h.from_stage;
  }
  if (d.stage === WON) reached = path.length; // won passed every open stage
  if (reached < 0) reached = 0; // unknown stage: counts as having entered the first one
  if (d.stage === LOST && !lostFrom) lostFrom = path[Math.min(reached, path.length - 1)] ?? null;
  return { reached, lostFrom };
}

function byDeal(history: RHistory[]) {
  const m = new Map<string, RHistory[]>();
  for (const h of [...history].sort((a, b) => a.changed_at.localeCompare(b.changed_at))) {
    const l = m.get(h.deal_id) ?? []; l.push(h); m.set(h.deal_id, l);
  }
  return m;
}

export type FunnelStep = {
  stage: string; entered: number; advanced: number; dropped: number; pending: number; stale: number;
  advanceRate: number | null; enteredAmount: number;
};

/**
 * Reconciled funnel over open stages: at every stage entered = advanced + dropped + pending.
 * «stale» = pending deals with no change for `staleDays` (a subset of pending).
 */
export function reconciledFunnel(deals: RDeal[], history: RHistory[], path: string[], now = new Date(), staleDays = 30): FunnelStep[] {
  const h = byDeal(history);
  const lastMove = (d: RDeal) => {
    const l = h.get(d.id); const t = l?.length ? l[l.length - 1].changed_at : (d.updated_at ?? d.created_at);
    return new Date(t).getTime();
  };
  return path.map((stage, i) => {
    let entered = 0, advanced = 0, dropped = 0, pending = 0, stale = 0, enteredAmount = 0;
    for (const d of deals) {
      const { reached, lostFrom } = journey(d, h.get(d.id) ?? [], path);
      if (reached < i) continue;
      entered++; enteredAmount += Number(d.amount ?? 0);
      if (reached > i) advanced++;
      else if (d.stage === LOST || lostFrom === stage && d.stage === LOST) dropped++;
      else {
        pending++;
        if (now.getTime() - lastMove(d) > staleDays * DAY) stale++;
      }
    }
    return { stage, entered, advanced, dropped, pending, stale, enteredAmount, advanceRate: entered - pending > 0 ? advanced / (entered - pending) : null };
  });
}

export type Group = { key: string; count: number; amount: number };

/** Closed-lost: where deals die (stage), and by segment / source, with value lost. */
export function lostAnalysis(deals: RDeal[], history: RHistory[], path: string[]) {
  const h = byDeal(history);
  const lost = deals.filter((d) => d.stage === LOST);
  const tally = (key: (d: RDeal) => string): Group[] => {
    const m = new Map<string, Group>();
    for (const d of lost) { const k = key(d); const g = m.get(k) ?? { key: k, count: 0, amount: 0 }; g.count++; g.amount += Number(d.amount ?? 0); m.set(k, g); }
    return [...m.values()].sort((a, b) => b.count - a.count || b.amount - a.amount);
  };
  return {
    total: lost.length,
    amount: lost.reduce((s, d) => s + Number(d.amount ?? 0), 0),
    byStage: tally((d) => journey(d, h.get(d.id) ?? [], path).lostFrom ?? "—"),
    bySegment: tally((d) => d.segment_id ?? "—"),
    bySource: tally((d) => d.source ?? "—"),
  };
}

export type Cohort = { key: string; created: number; open: number; won: number; lost: number; winRate: number | null; wonAmount: number; avgWon: number | null; medianDaysToWin: number | null };

/** Cohorts by source or segment: volume, win rate, value and speed. */
export function cohorts(deals: RDeal[], key: (d: RDeal) => string): Cohort[] {
  const m = new Map<string, RDeal[]>();
  for (const d of deals) { const k = key(d); m.set(k, [...(m.get(k) ?? []), d]); }
  return [...m.entries()].map(([k, ds]) => {
    const won = ds.filter((d) => d.stage === WON); const lost = ds.filter((d) => d.stage === LOST);
    const wonAmount = won.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const days = won.filter((d) => d.closed_at).map((d) => (new Date(d.closed_at!).getTime() - new Date(d.created_at).getTime()) / DAY).sort((a, b) => a - b);
    const mid = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) : null;
    return { key: k, created: ds.length, open: ds.length - won.length - lost.length, won: won.length, lost: lost.length,
      winRate: won.length + lost.length ? won.length / (won.length + lost.length) : null, wonAmount,
      avgWon: won.length ? wonAmount / won.length : null, medianDaysToWin: mid == null ? null : Math.round(mid) };
  }).sort((a, b) => b.created - a.created);
}

export type Week = { start: string; created: number; won: number; lost: number; wonAmount: number };

/** Last `weeks` weeks (Monday-based, UTC), oldest first. */
export function weeklyTrend(deals: RDeal[], weeks = 12, now = new Date()): Week[] {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const first = monday.getTime() - (weeks - 1) * 7 * DAY;
  const out: Week[] = Array.from({ length: weeks }, (_, i) => ({ start: new Date(first + i * 7 * DAY).toISOString().slice(0, 10), created: 0, won: 0, lost: 0, wonAmount: 0 }));
  const slot = (iso: string | null | undefined) => { if (!iso) return -1; const i = Math.floor((new Date(iso).getTime() - first) / (7 * DAY)); return i >= 0 && i < weeks ? i : -1; };
  for (const d of deals) {
    const c = slot(d.created_at); if (c >= 0) out[c].created++;
    if (d.stage === WON || d.stage === LOST) {
      const s = slot(d.closed_at ?? d.updated_at); if (s < 0) continue;
      if (d.stage === WON) { out[s].won++; out[s].wonAmount += Number(d.amount ?? 0); } else out[s].lost++;
    }
  }
  return out;
}
