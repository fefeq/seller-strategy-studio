// @vitest-environment node
// SDD-20261121-agent-turn-metrics (NK-0191), U-5 · CA-8: the pure summary of agent turns for a period. Fictional rows.
import { describe, expect, it } from "vitest";
import {
  percentile,
  summarizeTurns,
  type ActionMetricRow,
  type TurnMetricRow,
} from "@/lib/agent/turn-metrics";

let n = 0;
const turn = (over: Partial<TurnMetricRow> = {}): TurnMetricRow => ({
  id: `turn-${++n}`,
  created_at: "2026-11-10T10:00:00.000Z",
  outcome: "answered",
  duration_ms: 1000,
  cost_usd: null,
  cost_kind: "unknown",
  ...over,
});
const action = (turn_id: string | null, status: string): ActionMetricRow => ({ turn_id, status });

describe("summarizeTurns", () => {
  it("CA-8: with no turns it says there is no data, never zeros", () => {
    expect(summarizeTurns([], [])).toEqual({ data: false });
    // Actions alone (autopilot, suggestions) are not turns.
    expect(summarizeTurns([], [action(null, "confirmed")])).toEqual({ data: false });
    const outside = turn({ created_at: "2026-10-01T00:00:00.000Z" });
    expect(summarizeTurns([outside], [], { from: "2026-11-01T00:00:00.000Z" })).toEqual({
      data: false,
    });
  });

  it("CA-8: counts turns by result over the closed set", () => {
    const s = summarizeTurns(
      [
        turn(),
        turn(),
        turn({ outcome: "proposed" }),
        turn({ outcome: "empty" }),
        turn({ outcome: "failed" }),
        turn({ outcome: "failed" }),
        turn({ outcome: "refused" }),
      ],
      [],
    );
    expect(s).toMatchObject({
      data: true,
      turns: 7,
      byOutcome: { answered: 2, proposed: 1, empty: 1, failed: 2, refused: 1 },
    });
  });

  it("CA-8: proposals count only actions with a turn id of a turn in the period", () => {
    const a = turn({ outcome: "proposed" });
    const b = turn({ outcome: "proposed" });
    const old = turn({ outcome: "proposed", created_at: "2026-10-01T00:00:00.000Z" });
    const s = summarizeTurns(
      [a, b, old],
      [
        action(a.id, "confirmed"),
        action(a.id, "confirmed"),
        action(a.id, "cancelled"),
        action(b.id, "failed"),
        action(b.id, "pending"),
        // Autopilot, approved suggestions and MCP: no turn, so they are not the agent's proposals.
        action(null, "confirmed"),
        action(null, "pending"),
        // A turn outside the period, and a turn id that matches no turn read.
        action(old.id, "confirmed"),
        action("turn-unknown", "confirmed"),
      ],
      { from: "2026-11-01T00:00:00.000Z", to: "2026-12-01T00:00:00.000Z" },
    );
    expect(s).toMatchObject({
      data: true,
      turns: 2,
      proposals: { total: 5, confirmed: 2, dismissed: 1, failed: 1, pending: 1 },
    });
  });

  it("CA-8: median and 90th percentile of the duration", () => {
    const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 10_000];
    const s = summarizeTurns(
      durations.map((duration_ms) => turn({ duration_ms })),
      [],
    );
    expect(s).toMatchObject({ data: true, durationMs: { median: 550, p90: 900 } });
    const one = summarizeTurns([turn({ duration_ms: 3000 })], []);
    expect(one).toMatchObject({ durationMs: { median: 3000, p90: 3000 } });
  });

  it("CA-8: total measured cost and how many turns have an unknown cost; unknown never adds zero", () => {
    const s = summarizeTurns(
      [
        turn({ cost_usd: 0.002, cost_kind: "measured" }),
        turn({ cost_usd: 0.003, cost_kind: "measured" }),
        turn({ cost_usd: 0, cost_kind: "measured" }),
        turn(),
        turn(),
      ],
      [],
    );
    expect(s).toMatchObject({
      data: true,
      cost: { measuredUsd: expect.closeTo(0.005, 10), measuredTurns: 3, unknownTurns: 2 },
    });
  });

  it("CA-8: with no measured turn the total is empty, not zero", () => {
    const s = summarizeTurns([turn(), turn()], []);
    expect(s).toMatchObject({ cost: { measuredUsd: null, measuredTurns: 0, unknownTurns: 2 } });
  });

  it("CA-8: a row marked measured without a number counts as unknown, never as zero", () => {
    const s = summarizeTurns([turn({ cost_kind: "measured", cost_usd: null })], []);
    expect(s).toMatchObject({ cost: { measuredUsd: null, measuredTurns: 0, unknownTurns: 1 } });
  });

  it("CA-8: the period takes `from` in and leaves `to` out", () => {
    const rows = [
      turn({ created_at: "2026-11-01T00:00:00.000Z" }),
      turn({ created_at: "2026-11-15T12:00:00.000Z" }),
      turn({ created_at: "2026-12-01T00:00:00.000Z" }),
    ];
    const period = { from: "2026-11-01T00:00:00.000Z", to: "2026-12-01T00:00:00.000Z" };
    expect(summarizeTurns(rows, [], period)).toMatchObject({ turns: 2 });
    expect(summarizeTurns(rows, [])).toMatchObject({ turns: 3 });
    expect(summarizeTurns(rows, [], { to: "2026-11-15T12:00:00.000Z" })).toMatchObject({
      turns: 1,
    });
  });

  it("CA-8: the summary says that turns cut by the runtime leave no row", () => {
    const s = summarizeTurns([turn()], []);
    expect(s.data && s.limits).toEqual(["turns_cut_by_runtime_not_counted"]);
  });
});

describe("percentile", () => {
  it("nearest rank, null without samples", () => {
    expect(percentile([], 90)).toBeNull();
    expect(percentile([5], 90)).toBe(5);
    expect(percentile([3, 1, 2], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 90)).toBe(10);
  });
});
