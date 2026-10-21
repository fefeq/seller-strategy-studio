import { describe, expect, it } from "vitest";
import { reportText, weekStart, weeklyReport, type ReportDeal, type ReportLead } from "./weekly-report";
import { DEFAULT_LEAD_SLA } from "./lead-funnel";

const now = new Date("2026-10-19T07:00:00Z"); // a Monday
const ago = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const money = (n: number) => `${n} €`;
const deal = (id: string, o: Partial<ReportDeal> = {}): ReportDeal => ({ id, name: id.toUpperCase(), stage: "demo", amount: 10_000, segment_id: null, close_date: null, closed_at: null, created_at: ago(40), updated_at: ago(1), owner_id: null, ...o });
const lead = (id: string, o: Partial<ReportLead> = {}): ReportLead => ({ id, company: id, stage: "new", created_at: ago(2), sql_at: null, opportunity_at: null, stage_entered_at: ago(0), next_step_at: null, ...o });
const base = { now, segments: [], staleDays: null, leadSla: DEFAULT_LEAD_SLA, money, history: [], leads: [] };

describe("week", () => {
  it("starts on Monday", () => {
    expect(weekStart(new Date("2026-10-19T07:00:00Z"))).toBe("2026-10-19");
    expect(weekStart(new Date("2026-10-22T23:00:00Z"))).toBe("2026-10-19");
    expect(weekStart(new Date("2026-10-25T23:59:00Z"))).toBe("2026-10-19");
  });
});

describe("weekly report", () => {
  it("lists forward moves of the week, once per deal, and wins apart", () => {
    const r = weeklyReport({ ...base,
      deals: [deal("a"), deal("b"), deal("w", { stage: "won", closed_at: ago(2) }), deal("old")],
      history: [
        { deal_id: "a", from_stage: "qualified", to_stage: "demo", changed_at: ago(3) },
        { deal_id: "a", from_stage: "discovery", to_stage: "qualified", changed_at: ago(5) },
        { deal_id: "b", from_stage: "proposal", to_stage: "demo", changed_at: ago(2) }, // backwards
        { deal_id: "w", from_stage: "negotiation", to_stage: "won", changed_at: ago(2) },
        { deal_id: "old", from_stage: "discovery", to_stage: "demo", changed_at: ago(10) },
      ],
    });
    expect(r.advanced).toEqual([{ id: "a", name: "A", from: "Cualificado", to: "Demo / prueba" }]);
    expect(r.won).toEqual([{ id: "w", name: "W", amount: 10_000 }]);
    expect(r.headline).toBe("2 deals avanzaron y 0 se enfriaron; 1 ganado");
  });
  it("flags cold deals with the segment threshold and marks the new ones", () => {
    const r = weeklyReport({ ...base, deals: [deal("c", { updated_at: ago(16) }), deal("d", { updated_at: ago(40) }), deal("e", { updated_at: ago(3) })] });
    expect(r.cold.map((c) => [c.id, c.isNew])).toEqual([["d", false], ["c", true]]);
    expect(r.todo[0]).toBe("Retomar D: 40 días sin actividad.");
  });
  it("counts leads of the week and late ones", () => {
    const r = weeklyReport({ ...base, deals: [deal("a")], leads: [lead("l1", { sql_at: ago(1), stage: "sql" }), lead("l2", { created_at: ago(10), stage: "contacted", stage_entered_at: ago(5) }), lead("l3", { stage: "opportunity", opportunity_at: ago(2) })] });
    expect(r.leads).toEqual({ entered: 2, toSql: 1, toOpportunity: 1, late: 1 });
  });
  it("with nothing to report says so instead of inventing numbers", () => {
    const r = weeklyReport({ ...base, deals: [] });
    expect(r.headline).toBe("Semana sin actividad: aún no hay pipeline");
    expect(r.todo).toEqual(["Sin deals abiertos: entra leads nuevos o crea el primer deal."]);
  });
  it("renders a plain-text version", () => {
    const r = weeklyReport({ ...base, deals: [deal("a", { close_date: "2026-10-01" }), deal("c", { updated_at: ago(20) })], history: [{ deal_id: "a", from_stage: "discovery", to_stage: "demo", changed_at: ago(1) }] });
    const t = reportText(r, money);
    expect(t).toContain("Pipeline abierto: 20000 € en 2 deals.");
    expect(t).toContain("· A: Descubrimiento → Demo / prueba");
    expect(t).toContain("· C: 20 días sin actividad");
    expect(t).toContain("Con el cierre vencido (1): A.");
    expect(t).toContain("1. Retomar C: 20 días sin actividad.");
    expect(t.length).toBeLessThan(1500);
  });
});

describe("delivery timing", () => {
  it("runs on Monday from 06:00 UTC and keys one report per company and week", async () => {
    const { isReportTime, weeklyKey } = await import("./weekly-report.server");
    expect(isReportTime(new Date("2026-10-19T05:59:00Z"))).toBe(false);
    expect(isReportTime(new Date("2026-10-19T06:00:00Z"))).toBe(true);
    expect(isReportTime(new Date("2026-10-20T09:00:00Z"))).toBe(false);
    expect(weeklyKey("org1", "2026-10-19")).toBe("weekly_report:org1:2026-10-19");
  });
});
