// Agent turn summary (SDD-20261121-agent-turn-metrics, NK-0191, CA-8): pure. Turns rows of agent_turns and the proposed
// actions of those turns into the figures the PRD's discard criterion needs. Nothing here is estimated: with no turns
// the answer is «no data», an unknown cost never adds zero, and only actions with a turn id count as the agent's
// proposals (autopilot, approved suggestions and MCP write theirs with no turn).
// The read-only query that feeds it is documented in src/lib/AGENTS.md.
import { median } from "@/lib/spend";
import type { TurnOutcome } from "./turn-record";

export type TurnMetricRow = {
  id: string;
  created_at: string;
  outcome: string;
  duration_ms: number;
  cost_usd: number | null;
  cost_kind: string;
};
export type ActionMetricRow = { turn_id: string | null; status: string };
/** `from` is included, `to` is not. Either may be left out. */
export type TurnPeriod = { from?: string; to?: string };

export type TurnSummary =
  | { data: false }
  | {
      data: true;
      turns: number;
      byOutcome: Record<TurnOutcome, number>;
      /** Actions proposed in these turns, by what the person decided. */
      proposals: {
        total: number;
        confirmed: number;
        dismissed: number;
        failed: number;
        pending: number;
      };
      durationMs: { median: number; p90: number };
      /** USD. `measuredUsd` is null when no turn has a measured cost. */
      cost: { measuredUsd: number | null; measuredTurns: number; unknownTurns: number };
      /** What the figures cannot see: a turn the runtime cuts before its end leaves no row, so failed turns may
       *  be undercounted. */
      limits: ["turns_cut_by_runtime_not_counted"];
    };

/** Nearest-rank percentile; null without samples (never zero). */
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length, Math.max(1, Math.ceil((p / 100) * s.length))) - 1]!;
}

const PROPOSAL_STATUS = {
  confirmed: "confirmed",
  cancelled: "dismissed",
  failed: "failed",
  pending: "pending",
} as const;

export function summarizeTurns(
  turns: TurnMetricRow[],
  actions: ActionMetricRow[],
  period: TurnPeriod = {},
): TurnSummary {
  const from = period.from ? Date.parse(period.from) : Number.NEGATIVE_INFINITY;
  const to = period.to ? Date.parse(period.to) : Number.POSITIVE_INFINITY;
  const inPeriod = turns.filter((t) => {
    const at = Date.parse(t.created_at);
    return at >= from && at < to;
  });
  if (!inPeriod.length) return { data: false };

  const byOutcome: Record<TurnOutcome, number> = {
    answered: 0,
    proposed: 0,
    empty: 0,
    failed: 0,
    refused: 0,
  };
  for (const t of inPeriod) if (t.outcome in byOutcome) byOutcome[t.outcome as TurnOutcome] += 1;

  const ids = new Set(inPeriod.map((t) => t.id));
  const proposals = { total: 0, confirmed: 0, dismissed: 0, failed: 0, pending: 0 };
  for (const a of actions) {
    if (!a.turn_id || !ids.has(a.turn_id)) continue;
    proposals.total += 1;
    const key = PROPOSAL_STATUS[a.status as keyof typeof PROPOSAL_STATUS];
    if (key) proposals[key] += 1;
  }

  const durations = inPeriod.map((t) => t.duration_ms);
  const measured = inPeriod.filter(
    (t) => t.cost_kind === "measured" && typeof t.cost_usd === "number" && t.cost_usd >= 0,
  );
  return {
    data: true,
    turns: inPeriod.length,
    byOutcome,
    proposals,
    durationMs: { median: median(durations)!, p90: percentile(durations, 90)! },
    cost: {
      measuredUsd: measured.length ? measured.reduce((sum, t) => sum + t.cost_usd!, 0) : null,
      measuredTurns: measured.length,
      unknownTurns: inPeriod.length - measured.length,
    },
    limits: ["turns_cut_by_runtime_not_counted"],
  };
}
