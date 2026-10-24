import { describe, expect, it } from "vitest";
import { cohorts, lostAnalysis, reconciledFunnel, weeklyTrend, type RDeal, type RHistory } from "./revops";

const path = ["discovery", "proposal", "negotiation"];
const d = (id: string, stage: string, amount = 100, extra: Partial<RDeal> = {}): RDeal =>
  ({ id, stage, amount, created_at: "2026-01-05T12:00:00Z", closed_at: null, source: "inbound", segment_id: "s1", ...extra });
const deals = [
  d("a", "won", 1000, { closed_at: "2026-01-25T12:00:00Z" }),
  d("b", "lost", 500, { closed_at: "2026-01-20T12:00:00Z", source: "outbound" }),
  d("c", "proposal"),
  d("e", "discovery", 100, { updated_at: "2026-01-05T12:00:00Z" }),
];
const history: RHistory[] = [
  { deal_id: "b", from_stage: "discovery", to_stage: "proposal", changed_at: "2026-01-10T12:00:00Z" },
  { deal_id: "b", from_stage: "proposal", to_stage: "lost", changed_at: "2026-01-20T12:00:00Z" },
];

describe("reconciledFunnel", () => {
  const f = reconciledFunnel(deals, history, path, new Date("2026-03-01T00:00:00Z"));
  it("entered = advanced + dropped + pending at every stage", () => {
    for (const s of f) expect(s.entered).toBe(s.advanced + s.dropped + s.pending);
  });
  it("counts each deal where it is", () => {
    expect(f[0]).toMatchObject({ entered: 4, advanced: 3, pending: 1, dropped: 0 });
    expect(f[1]).toMatchObject({ entered: 3, advanced: 1, dropped: 1, pending: 1 });
  });
  it("flags pending deals untouched for 30 days as stale", () => expect(f[0].stale).toBe(1));
});

describe("lostAnalysis", () => {
  it("records the stage a deal died in and the value lost", () => {
    const l = lostAnalysis(deals, history, path);
    expect(l.total).toBe(1);
    expect(l.amount).toBe(500);
    expect(l.byStage[0]).toMatchObject({ key: "proposal", count: 1 });
  });
});

describe("cohorts", () => {
  it("win rate only over closed deals", () => {
    const c = cohorts(deals, (x) => x.source ?? "—");
    const inbound = c.find((x) => x.key === "inbound")!;
    expect(inbound).toMatchObject({ created: 3, won: 1, lost: 0, winRate: 1, medianDaysToWin: 20 });
  });
});

describe("weeklyTrend", () => {
  it("buckets created and closed deals by Monday week", () => {
    const w = weeklyTrend(deals, 4, new Date("2026-01-26T10:00:00Z"));
    expect(w.map((x) => x.start)).toEqual(["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
    expect(w[0].created).toBe(4);
    expect(w[2]).toMatchObject({ lost: 1 });
    expect(w[3]).toMatchObject({ won: 1, wonAmount: 1000 });
  });
});
