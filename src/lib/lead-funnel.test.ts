import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_SLA, funnelBy, leadCohort, leadDelay, leadFunnel, readSla, type LeadRow } from "./lead-funnel";

const now = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("delayed leads", () => {
  it("default limits are Nuevo 1, Contactado 3, MQL 5 and SQL 7 days", () => {
    expect(DEFAULT_LEAD_SLA).toEqual({ new: 1, contacted: 3, mql: 5, sql: 7 });
  });
  it("a lead staying longer than its stage limit is delayed", () => {
    expect(leadDelay({ stage: "contacted", stage_entered_at: daysAgo(4), next_step_at: null }, DEFAULT_LEAD_SLA, now).reasons).toEqual(["stalled"]);
    expect(leadDelay({ stage: "contacted", stage_entered_at: daysAgo(2), next_step_at: null }, DEFAULT_LEAD_SLA, now).late).toBe(false);
  });
  it("a lead whose follow-up date has passed is delayed even inside its limit", () => {
    const d = leadDelay({ stage: "sql", stage_entered_at: daysAgo(1), next_step_at: "2026-10-18" }, DEFAULT_LEAD_SLA, now);
    expect(d.reasons).toEqual(["followup"]);
    expect(d.followupOverdueDays).toBe(2);
  });
  it("both reasons can apply at once", () => {
    expect(leadDelay({ stage: "new", stage_entered_at: daysAgo(3), next_step_at: "2026-10-19" }, DEFAULT_LEAD_SLA, now).reasons).toEqual(["stalled", "followup"]);
  });
  it("converted and discarded leads are never delayed", () => {
    expect(leadDelay({ stage: "opportunity", stage_entered_at: daysAgo(90), next_step_at: "2026-01-01" }, DEFAULT_LEAD_SLA, now).late).toBe(false);
    expect(leadDelay({ stage: "disqualified", stage_entered_at: daysAgo(90), next_step_at: null }, DEFAULT_LEAD_SLA, now).late).toBe(false);
  });
  it("each company can change its limits", () => {
    expect(readSla({ new: 2, mql: "x" })).toEqual({ new: 2, contacted: 3, mql: 5, sql: 7 });
  });
});

const L = (id: string, o: Partial<LeadRow>): LeadRow => ({ id, stage: "new", created_at: "2026-10-01T00:00:00Z", stage_entered_at: "2026-10-01T00:00:00Z", contacted_at: null, mql_at: null, sql_at: null, opportunity_at: null, next_step_at: null, deal_id: null, segment_id: null, source: null, ...o });

describe("full funnel Lead → Contactado → MQL → SQL → Oportunidad → Ganado", () => {
  const leads = [
    L("a", { stage: "opportunity", contacted_at: "2026-10-02T00:00:00Z", mql_at: "2026-10-03T00:00:00Z", sql_at: "2026-10-05T00:00:00Z", opportunity_at: "2026-10-07T00:00:00Z", deal_id: "d1", segment_id: "smb" }),
    L("b", { stage: "opportunity", contacted_at: "2026-10-01T00:00:00Z", mql_at: "2026-10-01T00:00:00Z", sql_at: "2026-10-03T00:00:00Z", opportunity_at: "2026-10-09T00:00:00Z", deal_id: "d2", segment_id: "smb" }),
    L("c", { stage: "disqualified", contacted_at: "2026-10-02T00:00:00Z", mql_at: "2026-10-04T00:00:00Z", segment_id: "mid" }),
    L("d", { stage: "new", segment_id: "mid" }),
  ];
  const deals = [{ id: "d1", stage: "won", closed_at: "2026-10-31T00:00:00Z" }, { id: "d2", stage: "proposal", closed_at: null }];

  it("counts every lead that reached each step, including discarded ones", () => {
    const f = leadFunnel(leads, deals);
    expect(f.steps.map((s) => s.count)).toEqual([4, 3, 3, 2, 2, 1]);
    expect(f.disqualified).toBe(1);
  });
  it("conversion is step to step and from the first step", () => {
    const f = leadFunnel(leads, deals);
    expect(f.steps[4].fromPrev).toBe(1);
    expect(f.steps[5].fromPrev).toBe(0.5);
    expect(f.steps[5].fromStart).toBe(0.25);
  });
  it("time to each step is the median days since the lead entered", () => {
    const f = leadFunnel(leads, deals);
    expect(f.medianDays.opportunity).toBe(7);
    expect(f.medianDays.won).toBe(30);
  });
  it("splits by segment", () => {
    const g = funnelBy(leads, deals, (l) => l.segment_id ?? "—");
    const smb = g.find((x) => x.key === "smb")!;
    expect(smb.toOpportunity).toBe(1);
    expect(smb.toWon).toBe(0.5);
    expect(g.find((x) => x.key === "mid")!.toOpportunity).toBe(0);
  });
  it("cohorts by the date the lead entered", () => {
    expect(leadCohort([L("x", { created_at: "2026-09-30T23:00:00Z" }), ...leads], new Date("2026-10-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z"))).toHaveLength(4);
  });
});
