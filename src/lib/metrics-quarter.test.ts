// SDD-20261106-metrics-honest-data · U-1 · CA-1 (filter), CA-3 (calculation), CA-4: the quarter filters the
// funnel, the lost deals and the win rates of /metrics, and a deal without source counts as «Sin origen» («—»),
// never as Outbound. Fictional data.
import { describe, expect, it } from "vitest";
import { quarterRange } from "@/lib/metrics";
import type { RDeal, RHistory } from "@/lib/revops";
import { NO_SOURCE, funnelInQuarter, lostInQuarter, quarterWinRates } from "@/lib/metrics-quarter";

const Q4 = quarterRange("2026-Q4");
const deal = (
  o: Partial<RDeal & { owner_id: string | null }> & { id: string },
): RDeal & { owner_id: string | null } => ({
  stage: "discovery",
  amount: 1000,
  created_at: "2026-10-05T10:00:00Z",
  closed_at: null,
  updated_at: "2026-10-06T10:00:00Z",
  source: "inbound",
  segment_id: null,
  owner_id: null,
  ...o,
});
const h = (
  deal_id: string,
  from_stage: string | null,
  to_stage: string,
  changed_at: string,
): RHistory => ({ deal_id, from_stage, to_stage, changed_at });

describe("CA-1 funnelInQuarter: deals created in the quarter and only their history", () => {
  const deals = [
    deal({ id: "in1", created_at: "2026-10-01T00:00:00Z" }),
    deal({
      id: "in2",
      created_at: "2026-12-31T23:59:59Z",
      stage: "lost",
      closed_at: "2027-01-10T10:00:00Z",
    }),
    deal({ id: "before", created_at: "2026-09-30T23:59:59Z" }),
    deal({ id: "after", created_at: "2027-01-01T00:00:00Z" }),
  ];
  const history = [
    h("in1", null, "discovery", "2026-10-01T00:00:00Z"),
    h("in2", "discovery", "lost", "2027-01-10T10:00:00Z"),
    h("before", null, "discovery", "2026-09-30T23:59:59Z"),
    h("before", "discovery", "demo", "2026-10-15T10:00:00Z"),
  ];
  it("keeps deals with created_at in [start, end) and drops the rest", () => {
    const f = funnelInQuarter(deals, history, Q4);
    expect(f.deals.map((d) => d.id)).toEqual(["in1", "in2"]);
  });
  it("keeps the history of the kept deals only, whatever its date", () => {
    const f = funnelInQuarter(deals, history, Q4);
    expect(f.history.map((x) => `${x.deal_id}:${x.to_stage}`)).toEqual([
      "in1:discovery",
      "in2:lost",
    ]);
  });
  it("an empty quarter gives no deals", () => {
    expect(funnelInQuarter(deals, history, quarterRange("2025-Q1")).deals).toEqual([]);
  });
});

describe("CA-1 lostInQuarter: lost deals with closed_at ?? updated_at in the quarter", () => {
  const deals = [
    deal({
      id: "lostQ",
      stage: "lost",
      closed_at: "2026-11-01T10:00:00Z",
      created_at: "2026-01-01T10:00:00Z",
    }),
    deal({
      id: "lostNoClosed",
      stage: "lost",
      closed_at: null,
      updated_at: "2026-12-01T10:00:00Z",
      created_at: "2025-06-01T10:00:00Z",
    }),
    deal({ id: "lostBefore", stage: "lost", closed_at: "2026-09-29T10:00:00Z" }),
    deal({
      id: "lostClosedOutUpdatedIn",
      stage: "lost",
      closed_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-11-01T10:00:00Z",
    }),
    deal({ id: "wonQ", stage: "won", closed_at: "2026-11-01T10:00:00Z" }),
    deal({ id: "open", stage: "demo" }),
  ];
  const history = [
    h("lostQ", "demo", "lost", "2026-11-01T10:00:00Z"),
    h("wonQ", "demo", "won", "2026-11-01T10:00:00Z"),
    h("lostBefore", "demo", "lost", "2026-09-29T10:00:00Z"),
  ];
  it("keeps only lost deals closed in the quarter (updated_at when closed_at is missing)", () => {
    const l = lostInQuarter(deals, history, Q4);
    expect(l.deals.map((d) => d.id)).toEqual(["lostQ", "lostNoClosed"]);
  });
  it("keeps the history of the kept deals only", () => {
    expect(lostInQuarter(deals, history, Q4).history.map((x) => x.deal_id)).toEqual(["lostQ"]);
  });
});

describe("CA-3 / CA-4 quarterWinRates", () => {
  const rep = (d: { owner_id: string | null }) =>
    d.owner_id === "u1" ? "Ana Ficticia" : "Sin asignar";
  const deals = [
    deal({
      id: "w1",
      stage: "won",
      closed_at: "2026-10-10T10:00:00Z",
      source: "inbound",
      owner_id: "u1",
    }),
    deal({
      id: "w2",
      stage: "won",
      closed_at: null,
      updated_at: "2026-11-10T10:00:00Z",
      source: null,
      owner_id: "u1",
    }),
    deal({ id: "l1", stage: "lost", closed_at: "2026-12-10T10:00:00Z", source: null }),
    deal({
      id: "l2",
      stage: "lost",
      closed_at: "2026-12-11T10:00:00Z",
      source: "outbound",
      owner_id: "u1",
    }),
    // closed outside the quarter: never counted
    deal({
      id: "wOld",
      stage: "won",
      closed_at: "2025-05-10T10:00:00Z",
      source: "outbound",
      owner_id: "u1",
    }),
    deal({ id: "lOld", stage: "lost", closed_at: "2026-09-30T10:00:00Z", source: null }),
    // open: never counted
    deal({ id: "o1", stage: "demo", source: null }),
  ];
  it("global win rate counts only deals closed (closed_at ?? updated_at) in the quarter", () => {
    const r = quarterWinRates(deals, Q4, rep);
    expect(r.overall).toEqual({ won: 2, lost: 2, closed: 4, rate: 0.5 });
  });
  it("by source: a null source counts as «—» (Sin origen), never as outbound", () => {
    const r = quarterWinRates(deals, Q4, rep);
    const by = Object.fromEntries(r.bySource.map((x) => [x.k, x]));
    expect(NO_SOURCE).toBe("—");
    expect(by["—"]).toMatchObject({ won: 1, lost: 1, rate: 0.5 });
    expect(by.outbound).toMatchObject({ won: 0, lost: 1, rate: 0 });
    expect(by.inbound).toMatchObject({ won: 1, lost: 0, rate: 1 });
    expect(r.bySource.reduce((s, x) => s + x.won + x.lost, 0)).toBe(4);
  });
  it("by rep: the quarter's closed deals only", () => {
    const r = quarterWinRates(deals, Q4, rep);
    const by = Object.fromEntries(r.byRep.map((x) => [x.k, x]));
    expect(by["Ana Ficticia"]).toMatchObject({ won: 2, lost: 1 });
    expect(by["Sin asignar"]).toMatchObject({ won: 0, lost: 1 });
  });
  it("without closed deals in the quarter the global rate is null (never a measured 0) and the groups are empty", () => {
    const r = quarterWinRates(deals, quarterRange("2026-Q2"), rep);
    expect(r.overall).toEqual({ won: 0, lost: 0, closed: 0, rate: null });
    expect(r.bySource).toEqual([]);
    expect(r.byRep).toEqual([]);
  });
});
