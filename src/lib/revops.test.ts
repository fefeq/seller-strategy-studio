import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cohorts, lostAnalysis, reconciledFunnel, weeklyTrend, type RDeal, type RHistory } from "./revops";
import { NO_SOURCE } from "./metrics-quarter";

const path = ["discovery", "proposal", "negotiation"];
const d = (id: string, stage: string, amount = 100, extra: Partial<RDeal> = {}): RDeal =>
  ({ id, stage, amount, created_at: "2026-01-05T12:00:00Z", closed_at: null, source: "inbound", segment_id: "s1", ...extra });
const deals = [
  d("a", "won", 1000, { closed_at: "2026-01-26T12:00:00Z" }),
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
    expect(inbound).toMatchObject({ created: 3, won: 1, lost: 0, winRate: 1, medianDaysToWin: 21 });
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

// SDD-20261109-deals-no-source U-2 (NK-0107) CA-6: a deal without source is grouped under NO_SOURCE, written once, never as a literal.
describe("deals without source", () => {
  const nullSource = [d("n1", "lost", 700, { closed_at: "2026-01-20T12:00:00Z", source: null })];
  it("lostAnalysis and cohorts group a null source under NO_SOURCE", () => {
    expect(lostAnalysis(nullSource, [], path).bySource).toEqual([
      { key: NO_SOURCE, count: 1, amount: 700 },
    ]);
    expect(cohorts(nullSource, (x) => x.source ?? NO_SOURCE).map((c) => c.key)).toEqual([
      NO_SOURCE,
    ]);
  });
  it("revops.ts, the panels and the label maps use NO_SOURCE, not a «—» literal for the source", () => {
    const read = (f: string) => readFileSync(`${process.cwd()}/${f}`, "utf8");
    expect(read("src/lib/revops.ts")).not.toMatch(/source \?\? "—"/);
    expect(read("src/components/metrics/revops-panels.tsx")).not.toMatch(/source \?\? "—"/);
    expect(read("src/components/metrics/revops-panels.tsx")).not.toContain('"—": "Sin origen"');
    expect(read("src/components/metrics/performance-panels.tsx")).not.toContain(
      '"—": "Sin origen"',
    );
  });
});
