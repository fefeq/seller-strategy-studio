// SDD-20261109-metrics-strategy-no-estimates · U-0 · CA-3, CA-4: coherence across surfaces. Replaces NK-0068's freeze
// net (strategy-freeze.test.ts): instead of pinning old numbers, the same segment and quarter must give the same CAC,
// payback and margin (value, state and reason) on Cobertura / CAC real (segmentCoverage), Payback real / Inicio
// (paybackByQuarter), Presupuesto vs real / KPI (quarterlyBudget), get_segment_coverage (MCP handler) and Diagnóstico
// (funnelDiagnosis); and the company CAC and payback of the KPI must be the ones the board shows. Fictional fixture.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { quarterRange } from "@/lib/metrics";
import { paybackByQuarter, segmentCoverage, type SegLike } from "@/lib/segment-coverage";
import { quarterlyBudget } from "@/lib/segment-budget";
import { quarterKpis } from "@/lib/quarter-kpis";
import { boardEconomics } from "@/lib/pipeline-board";
import { funnelDiagnosis } from "@/lib/funnel-diagnosis";
import {
  BUDGET_ROWS,
  COSTS,
  EXT_DEALS,
  NO_SEGMENTS,
  NOW,
  Q,
  Q3,
  SEGMENTS,
  TARGETS,
} from "@/test/metrics-fixture";

vi.mock("@/lib/mcp/context", async (importOriginal) => {
  const f = await import("@/test/metrics-fixture");
  return {
    ...(await importOriginal<typeof import("@/lib/mcp/context")>()),
    mcpCtx: async () => f.fixtureCtx(["owner"]),
  };
});
import { segmentCoverageTool } from "@/lib/mcp/tools/metrics";

type Fig = { value: number | null; state: string; reason: string | null };
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const segs = SEGMENTS as SegLike[];
const costsOf = (q: string) => COSTS.filter((c) => c.period === q);
const wonIn = (q: string) => {
  const { start, end } = quarterRange(q);
  return EXT_DEALS.filter((d) => {
    const t = new Date(d.closed_at ?? d.updated_at);
    return d.stage === "won" && t >= start && t < end;
  });
};

type McpSeg = {
  name: string;
  cac: { real: number | null; state: string; reason: string | null };
  payback: { real: number | null; state: string; reason: string | null };
  gross_margin: { pct: number | null; source: string | null };
};
async function mcpSegments(q: string): Promise<McpSeg[]> {
  const out = (await (segmentCoverageTool.handler as (a: unknown, c: unknown) => Promise<unknown>)(
    { quarter: q },
    {},
  )) as { content: { text: string }[] };
  return JSON.parse(out.content[0].text).segments;
}

/** The figures every surface shows for one segment and quarter, read the way each surface reads them. */
async function surfaces(q: string) {
  const range = quarterRange(q);
  const year = Number(q.slice(0, 4));
  const coverage = segmentCoverage(segs, EXT_DEALS, TARGETS, range, costsOf(q), BUDGET_ROWS);
  const payback = paybackByQuarter(segs, EXT_DEALS, COSTS, [q], quarterRange, BUDGET_ROWS);
  const budget = quarterlyBudget(segs, EXT_DEALS, BUDGET_ROWS, COSTS, year).byQuarter[q];
  const mcp = await mcpSegments(q);
  return segs.map((s, i) => ({
    id: s.id,
    coverage: coverage[i].figures,
    payback: payback[i].byQuarter[q].figures,
    budget: budget[i].figures,
    mcp: mcp[i],
  }));
}

describe("CA-3 coherence: one CAC, one payback and one margin per segment and quarter", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => vi.useRealTimers());

  for (const q of [Q, Q3]) {
    it(`CAC (value, state, reason) is equal on Cobertura, Payback real, Presupuesto vs real and MCP · ${q}`, async () => {
      for (const s of await surfaces(q)) {
        const c: Fig = s.coverage.cac;
        expect(c, s.id).toBeDefined();
        expect(s.payback.cac, `${s.id} paybackByQuarter`).toEqual(c);
        expect(s.budget.cac, `${s.id} quarterlyBudget`).toEqual(c);
        expect(
          { value: s.mcp.cac.real, state: s.mcp.cac.state, reason: s.mcp.cac.reason },
          `${s.id} get_segment_coverage`,
        ).toEqual({ value: round1(c.value), state: c.state, reason: c.reason });
      }
    });

    it(`payback (value, state, reason) is equal on Cobertura, Payback real, Presupuesto vs real and MCP · ${q}`, async () => {
      for (const s of await surfaces(q)) {
        const p: Fig = s.coverage.payback;
        expect(p, s.id).toBeDefined();
        expect(s.payback.payback, `${s.id} paybackByQuarter`).toEqual(p);
        expect(s.budget.payback, `${s.id} quarterlyBudget`).toEqual(p);
        expect(
          { value: s.mcp.payback.real, state: s.mcp.payback.state, reason: s.mcp.payback.reason },
          `${s.id} get_segment_coverage`,
        ).toEqual({ value: round1(p.value), state: p.state, reason: p.reason });
        // Never Infinity, NaN or a negative number on any surface.
        if (p.value != null) expect(Number.isFinite(p.value) && p.value >= 0, s.id).toBe(true);
      }
    });

    it(`the margin used is the same everywhere · ${q}`, async () => {
      for (const s of await surfaces(q)) {
        const m: Fig = s.coverage.margin;
        expect(m, s.id).toBeDefined();
        expect(s.payback.margin, `${s.id} paybackByQuarter`).toEqual(m);
        expect(s.budget.margin, `${s.id} quarterlyBudget`).toEqual(m);
        expect(s.mcp.gross_margin.pct, `${s.id} get_segment_coverage`).toBe(round1(m.value));
      }
    });
  }

  it("M1, not M2 nor M4: Pyme's payback uses the 60 % margin of its won deal with lines on every surface", async () => {
    const pyme = (await surfaces(Q)).find((s) => s.id === "s-pyme")!;
    expect(pyme.coverage.margin).toMatchObject({ value: 60, state: "real" });
    expect(pyme.budget.margin).toMatchObject({ value: 60, state: "real" });
    expect(pyme.mcp.gross_margin).toEqual({ pct: 60, source: "deals" });
  });

  it("Diagnóstico shows the same payback (rounded to one decimal) and, without one, says why", async () => {
    const d = funnelDiagnosis({
      quarter: Q,
      segments: SEGMENTS,
      deals: EXT_DEALS,
      leads: [],
      trials: [],
      costs: costsOf(Q),
      budgetRows: BUDGET_ROWS,
      activationEvent: null,
      stripe: null,
    })!;
    const cov = segmentCoverage(segs, EXT_DEALS, TARGETS, quarterRange(Q), costsOf(Q), BUDGET_ROWS);
    for (const [i, seg] of d.segments.entries()) {
      const m = seg.phases
        .find((p) => p.id === "revenue")!
        .measures.find((x) => x.id === "payback");
      if (!m) continue; // only slg segments judge payback
      const p: Fig = cov[i].figures.payback;
      if (p.value == null) {
        expect(m.value, seg.segment_id).toBeNull();
        expect(m.verdict, seg.segment_id).toBeNull();
        expect(m.missing, seg.segment_id).toContain(p.reason!);
      } else expect(m.value, seg.segment_id).toBe(round1(p.value));
    }
  });
});

describe("CA-3 coherence: one company CAC and one company payback", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => vi.useRealTimers());

  const cases = [
    { name: "with an unsegmented won deal", q: Q, segments: segs },
    { name: "with shared cost and nobody won", q: Q3, segments: segs },
    { name: "in a company without segments", q: Q, segments: NO_SEGMENTS as SegLike[] },
  ];
  for (const c of cases) {
    it(`KPI: acquisition = every cost of the quarter, CAC = that cost / every won deal (D11) · ${c.name}`, () => {
      const [k] = quarterKpis(c.segments, EXT_DEALS, BUDGET_ROWS, COSTS, [c.q]);
      const cost = costsOf(c.q).reduce((s, x) => s + x.amount, 0);
      const won = wonIn(c.q).length;
      expect(k.actual.acquisition).toBe(cost || null);
      expect(k.actual.cac).toBe(cost && won ? cost / won : null);
      expect(k.figures.cac.value).toBe(k.actual.cac);
    });

    it(`the board shows the KPI's CAC and payback (value, state, reason) · ${c.name}`, () => {
      const [k] = quarterKpis(c.segments, EXT_DEALS, BUDGET_ROWS, COSTS, [c.q]);
      const b = boardEconomics({
        deals: EXT_DEALS,
        segments: c.segments,
        budgets: BUDGET_ROWS,
        costs: costsOf(c.q),
        quarter: c.q,
        now: NOW,
      });
      expect(b.realCac).toEqual(k.figures.cac);
      expect(b.payback).toEqual(k.figures.payback);
    });
  }

  it("without segments the company payback says why instead of a number", () => {
    const [k] = quarterKpis(NO_SEGMENTS as SegLike[], EXT_DEALS, BUDGET_ROWS, COSTS, [Q]);
    expect(k.figures.payback).toEqual({
      value: null,
      state: "sin_dato",
      reason: "ningún segmento con payback",
    });
  });
});
