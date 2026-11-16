// When an open deal counts as cold. The threshold follows the segment's real sales cycle (a
// quarter of it, never under 14 days nor over 60) unless the company sets its own number. Pure so
// Pipeline, Inicio, the agent and the stale_deal detector agree on who is cold.
import { assignSegment, type DealLike, type SegLike } from "@/lib/segment-coverage";
import { segmentActuals } from "@/lib/pipeline-real";

export const DEFAULT_STALE_DAYS = 14;
export const MIN_STALE_DAYS = 14;
export const MAX_STALE_DAYS = 60;
/** Share of the sales cycle a deal may sit idle before it is cold. */
export const CYCLE_SHARE = 0.25;

const DAY = 86_400_000;

export type StaleSource = "empresa" | "ciclo" | "defecto";
export type StaleThreshold = { days: number; source: StaleSource; cycleDays: number | null };

/** Company override wins; else a share of the real cycle clamped to 14–60; else 14. */
export function staleThreshold(
  cycleDays: number | null | undefined,
  override: number | null | undefined,
): StaleThreshold {
  if (override && override > 0)
    return { days: Math.round(override), source: "empresa", cycleDays: cycleDays ?? null };
  if (cycleDays && cycleDays > 0)
    return {
      days: Math.min(MAX_STALE_DAYS, Math.max(MIN_STALE_DAYS, Math.round(cycleDays * CYCLE_SHARE))),
      source: "ciclo",
      cycleDays,
    };
  return { days: DEFAULT_STALE_DAYS, source: "defecto", cycleDays: null };
}

/** The company override lives next to the lead limits in lead_settings.sla as stale_deal_days. */
export function readStaleDays(raw: unknown): number | null {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = Number(o.stale_deal_days);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export type StaleDeal<T> = { deal: T; idleDays: number; threshold: StaleThreshold; stale: boolean };

/**
 * Every open deal with its idle days and the threshold of its segment (the company's cycle when the
 * segment has no won deals yet). Closed deals are never cold.
 */
export function staleDeals<T extends DealLike & { id: string }>(
  deals: T[],
  segments: SegLike[],
  override: number | null,
  now = new Date(),
): StaleDeal<T>[] {
  const real = segmentActuals(segments, deals, now);
  return deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .map((deal) => {
      const seg = assignSegment(deal, segments);
      const cycle = (seg ? real.bySegment[seg]?.cycleDays : null) ?? real.overall.cycleDays;
      const threshold = staleThreshold(cycle, override);
      const idleDays = Math.max(
        0,
        Math.floor((now.getTime() - new Date(deal.updated_at).getTime()) / DAY),
      );
      return { deal, idleDays, threshold, stale: idleDays >= threshold.days };
    });
}

export function thresholdText(t: StaleThreshold) {
  if (t.source === "empresa") return `${t.days} días, fijado por la empresa`;
  if (t.source === "ciclo")
    return `${t.days} días, un cuarto del ciclo real de ${t.cycleDays} días`;
  return `${t.days} días por defecto: aún no hay ciclo real`;
}
