import { describe, expect, it } from "vitest";
import { closingIn, pipelineBoard, pipelineEconomics, type BoardDeal, type BoardLead } from "./pipeline-board";
import { DEFAULT_LEAD_SLA } from "./lead-funnel";
import { quarterRange } from "./metrics";

const NOW = new Date("2026-10-20T10:00:00Z");
const q4 = quarterRange("2026-Q4");
let n = 0;
const lead = (o: Partial<BoardLead>): BoardLead => ({ id: `l${++n}`, company: "Acme", contact_name: null, owner_id: null, stage: "new", stage_entered_at: "2026-10-19T10:00:00Z", next_step_at: null, amount: null, ...o });
const deal = (o: Partial<BoardDeal>): BoardDeal => ({ id: `d${++n}`, name: "Deal", owner_id: null, stage: "discovery", amount: 10000, close_date: "2026-12-15", closed_at: null, updated_at: "2026-10-01", ...o });

describe("pipelineBoard", () => {
  const leads = [
    lead({ company: "Reciente", stage_entered_at: "2026-10-19T10:00:00Z" }),
    lead({ company: "Antiguo", stage_entered_at: "2026-10-10T10:00:00Z" }),
    lead({ stage: "sql" }),
    lead({ stage: "opportunity" }), // already represented by its deal
    lead({ stage: "disqualified" }),
  ];
  const deals = [
    deal({ stage: "discovery" }),
    deal({ stage: "negotiation", close_date: "2026-10-01", amount: 5000 }),
    deal({ stage: "won", closed_at: "2026-10-05T12:00:00Z", amount: 7000 }),
    deal({ stage: "won", closed_at: "2026-06-05T12:00:00Z" }),
    deal({ stage: "lost" }),
  ];
  const board = pipelineBoard(leads, deals, q4, DEFAULT_LEAD_SLA, NOW);
  const g = (id: string) => board.find((x) => x.id === id)!;

  it("shows open leads only, without opportunity or discarded leads", () => expect(g("leads").count).toBe(3));
  it("orders leads by time waiting and flags the late ones", () => {
    const nuevo = g("leads").columns.find((c) => c.stage === "new")!;
    expect(nuevo.items.map((i) => i.name)).toEqual(["Antiguo", "Reciente"]);
    expect(nuevo.items[0].late).toBe(true);
    expect(nuevo.items[0].lateText).toContain("días en la etapa");
    expect(nuevo.items[1].late).toBe(false);
  });
  it("splits open deals into opportunities and deals in progress", () => {
    expect(g("opportunities").count).toBe(1);
    expect(g("progress").count).toBe(1);
    expect(g("progress").amount).toBe(5000);
  });
  it("flags deals whose close date has passed", () => {
    const neg = g("progress").columns.find((c) => c.stage === "negotiation")!.items[0];
    expect(neg.late).toBe(true);
    expect(neg.lateText).toContain("vencido");
  });
  it("counts only deals won in the quarter", () => {
    expect(g("won").count).toBe(1);
    expect(g("won").amount).toBe(7000);
  });
});

describe("closingIn", () => {
  it("keeps open deals whose close date is in the quarter", () => {
    const ds = [deal({ close_date: "2026-11-01" }), deal({ close_date: "2027-01-10" }), deal({ close_date: null }), deal({ stage: "won", close_date: "2026-11-01" })];
    expect(closingIn(ds, q4)).toHaveLength(1);
  });
});

describe("pipelineEconomics", () => {
  it("real CAC divides the cost by won deals; projected adds open deals at the win rate", () => {
    const e = pipelineEconomics({ cost: 12000, won: 2, closing: 4, winRatePct: 25, acv: 12000, marginPct: 80 });
    expect(e.realCac).toBe(6000);
    expect(e.expectedWins).toBe(3);
    expect(e.projectedCac).toBe(4000);
    expect(e.realPayback).toBeCloseTo(6000 / ((12000 * 0.8) / 12));
    expect(e.projectedPayback).toBeCloseTo(5);
  });
  it("no costs, no wins or no margin leave the figures empty", () => {
    expect(pipelineEconomics({ cost: null, won: 2, closing: 1, winRatePct: 50, acv: 1000, marginPct: 80 }).realCac).toBeNull();
    expect(pipelineEconomics({ cost: 5000, won: 0, closing: 0, winRatePct: 50, acv: 1000, marginPct: 80 }).realCac).toBeNull();
    expect(pipelineEconomics({ cost: 5000, won: 1, closing: 0, winRatePct: 50, acv: 1000, marginPct: null }).realPayback).toBeNull();
  });
});
