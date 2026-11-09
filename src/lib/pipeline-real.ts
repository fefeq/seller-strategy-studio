// Real ACV, win rate and sales cycle from the pipeline, overall and per segment. Pure so the
// calculator, the dashboards and future AI snapshots read the same numbers.
import { assignSegment, type DealLike, type SegLike } from "@/lib/segment-coverage";
import { previousQuarter, segmentCac, type CostLike } from "@/lib/cac";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { LAST_4_QUARTERS } from "@/lib/unit-economics";

export type Actuals = {
  /** Average amount of won deals; falls back to open deals when nothing is won yet. */
  acv: number | null;
  acvSource: "ganados" | "abiertos" | null;
  acvSample: number;
  /** won / (won + lost) over the window, in %. */
  winRate: number | null;
  closedSample: number;
  /** Median days from entry to won. */
  cycleDays: number | null;
  cycleSample: number;
};

const DAY = 86_400_000;

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** `windowDays` limits win rate and cycle to deals closed recently (default: last 12 months). */
export function actuals(deals: DealLike[], now = new Date(), windowDays = 365): Actuals {
  const since = now.getTime() - windowDays * DAY;
  const closedAt = (d: DealLike) => new Date(d.closed_at ?? d.updated_at).getTime();
  const recent = deals.filter((d) => (d.stage === "won" || d.stage === "lost") && closedAt(d) >= since);
  const won = recent.filter((d) => d.stage === "won");
  const priced = (xs: DealLike[]) => xs.filter((d) => Number(d.amount) > 0);
  const avg = (xs: DealLike[]) => xs.reduce((s, d) => s + Number(d.amount), 0) / xs.length;
  const wonPriced = priced(deals.filter((d) => d.stage === "won"));
  const openPriced = priced(deals.filter((d) => d.stage !== "won" && d.stage !== "lost"));
  const acvBase = wonPriced.length ? wonPriced : openPriced;
  const cycles = won.map((d) => (closedAt(d) - new Date(d.created_at).getTime()) / DAY).filter((x) => x >= 0);
  const cycle = median(cycles);
  return {
    acv: acvBase.length ? avg(acvBase) : null,
    acvSource: wonPriced.length ? "ganados" : openPriced.length ? "abiertos" : null,
    acvSample: acvBase.length,
    winRate: recent.length ? (won.length / recent.length) * 100 : null,
    closedSample: recent.length,
    cycleDays: cycle == null ? null : Math.round(cycle),
    cycleSample: cycles.length,
  };
}

export function segmentActuals(segments: SegLike[], deals: DealLike[], now = new Date()) {
  const bySeg: Record<string, Actuals> = {};
  for (const s of segments) bySeg[s.id] = actuals(deals.filter((d) => assignSegment(d, segments) === s.id), now);
  return { overall: actuals(deals, now), bySegment: bySeg };
}

/** The current quarter and the previous n-1, newest first (2026-Q4, 2026-Q3, …). */
export function lastQuarters(now = new Date(), n = 4) {
  const out = [quarterOf(now)];
  while (out.length < n) out.push(previousQuarter(out[out.length - 1]));
  return out;
}

/**
 * Real CAC per segment over the last 4 quarters (current included): entered costs of those quarters
 * divided by deals won since the start of the oldest one, through segmentCac → cacOf (the one formula; the window
 * is data: «los últimos 4 trimestres»). Used by the strategy calculator's payback.
 */
export function trailingCac(segments: SegLike[], deals: DealLike[], costs: (CostLike & { period: string })[], now = new Date()) {
  const quarters = lastQuarters(now, 4);
  const start = quarterRange(quarters[quarters.length - 1]).start.getTime();
  const won = (id: string) => deals.filter((d) => {
    const t = new Date(d.closed_at ?? d.updated_at).getTime();
    return d.stage === "won" && t >= start && t <= now.getTime() && assignSegment(d, segments) === id;
  }).length;
  return segmentCac(
    costs.filter((c) => quarters.includes(c.period)),
    Object.fromEntries(segments.map((s) => [s.id, won(s.id)])),
    segments.map((s) => s.id),
    LAST_4_QUARTERS,
  );
}
