// SDD-20261109-metrics-strategy-no-estimates · U-5 · CA-11, CA-15: the two MCP metric tools. get_segment_coverage says
// the state, reason and window of each figure (no `payback.source: "objetivo"`, never a negative or an Infinity
// turned null); get_real_metrics says the window of its win rate and of its ACV and where the ACV comes from. Only
// Owner and Sales Leader may call them: any other role gets the app's role error before a single table is read.
// Fake mcpCtx over the fictional fixture (src/test/metrics-fixture.ts); no network.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ roles: ["owner"] as string[], log: [] as string[] }));
vi.mock("@/lib/mcp/context", async (importOriginal) => {
  const f = await import("@/test/metrics-fixture");
  return {
    ...(await importOriginal<typeof import("@/lib/mcp/context")>()),
    mcpCtx: async () => f.fixtureCtx(state.roles, state.log),
  };
});
import { realMetrics, segmentCoverageTool } from "@/lib/mcp/tools/metrics";
import { NOW, Q } from "@/test/metrics-fixture";

type Handler = (args: unknown, ctx: unknown) => Promise<{ content: { text: string }[] }>;
const run = async (tool: { handler: unknown }, args: unknown = {}) =>
  JSON.parse((await (tool.handler as Handler)(args, {})).content[0].text);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  state.roles = ["owner"];
  state.log = [];
});

const ROLE_ERROR = "Tu rol en esta empresa no permite esta acción";

describe("CA-15: only Owner and Sales Leader, before any read", () => {
  for (const [name, tool, args] of [
    ["get_real_metrics", realMetrics, {}],
    ["get_segment_coverage", segmentCoverageTool, { quarter: Q }],
  ] as const) {
    it(`${name}: owner and sales_leader get data`, async () => {
      for (const roles of [["owner"], ["sales_leader"]]) {
        state.roles = roles;
        expect((await run(tool, args)).segments.length, roles[0]).toBeGreaterThan(0);
      }
    });
    it(`${name}: ae, marketing and no role are refused and nothing is read`, async () => {
      for (const roles of [["ae"], ["marketing"], []]) {
        state.roles = roles;
        state.log = [];
        await expect(run(tool, args), roles.join() || "none").rejects.toThrow(ROLE_ERROR);
        expect(state.log, `${roles.join() || "none"} reads`).toEqual([]);
      }
    });
    it(`${name}: its description says so`, () => {
      expect((tool as unknown as { description: string }).description).toContain(
        "Solo Owner y Sales Leader.",
      );
    });
  }
});

describe("CA-11: get_segment_coverage says state, reason and window", () => {
  type Seg = {
    name: string;
    acv: { value: number | null; state: string; reason: string | null };
    cac: { real: number | null; state: string; reason: string | null };
    payback: Record<string, unknown> & { real: number | null; window: string };
    win_rate: Record<string, unknown> & { window: string };
  };
  it("acv, cac and payback carry state and reason; payback and win rate their window; no payback.source", async () => {
    const out = await run(segmentCoverageTool, { quarter: Q });
    for (const s of out.segments as Seg[]) {
      expect(Object.keys(s.acv).sort(), s.name).toEqual(["reason", "state", "value"]);
      expect(s.cac, s.name).toHaveProperty("state");
      expect(s.cac, s.name).toHaveProperty("reason");
      expect(Object.keys(s.payback).sort(), s.name).toEqual(
        ["ok", "real", "reason", "state", "target", "window"].sort(),
      );
      expect(s.payback.window, s.name).toBe("trimestre");
      expect(s.win_rate.window, s.name).toBe("trimestre");
      expect(s.payback, s.name).not.toHaveProperty("source");
    }
  });
  it("never a negative payback; a margin ≤ 0 is a null with its reason, not an Infinity turned null", async () => {
    const out = await run(segmentCoverageTool, { quarter: Q });
    const by = Object.fromEntries((out.segments as Seg[]).map((s) => [s.name, s]));
    for (const s of out.segments as Seg[])
      if (s.payback.real != null) expect(s.payback.real, s.name).toBeGreaterThanOrEqual(0);
    expect(by["Cero"].payback).toMatchObject({ real: null, reason: "margen 0 % o negativo" });
    expect(by["Negativo"].payback).toMatchObject({ real: null, reason: "margen 0 % o negativo" });
    // D3 / D4: no ACV from minimum × 1.5 or 0
    expect(by["Mid"].acv).toEqual({
      value: null,
      state: "sin_dato",
      reason: "falta el máximo del rango de ACV",
    });
    expect(by["Sin rango"].acv).toEqual({
      value: null,
      state: "sin_dato",
      reason: "falta rango de ACV",
    });
  });
  it("its description states the windows, the «Sin dato» reasons and that the target CAC never makes a payback", () => {
    const d = (segmentCoverageTool as unknown as { description: string }).description;
    expect(d).toMatch(/trimestre/);
    expect(d).toMatch(/null/);
    expect(d).toMatch(/nunca con el CAC objetivo/);
  });
});

describe("CA-11: get_real_metrics says its windows and the origin of the ACV", () => {
  it("total and each segment: win_rate_window, acv_window and acv_source", async () => {
    const out = await run(realMetrics);
    for (const row of [out.overall, ...out.segments]) {
      expect(row.win_rate_window).toBe("ultimos_365_dias");
      expect(row.acv_window).toBe("todo_el_historico");
      expect(row).toHaveProperty("acv_source");
    }
    expect(out.overall.acv_source).toBe("ganados");
  });
  it("its description no longer says «últimos 12 meses» for everything", () => {
    const d = (realMetrics as unknown as { description: string }).description;
    expect(d).not.toContain("(últimos 12 meses)");
    expect(d).toMatch(/365 días/);
    expect(d).toMatch(/todo el histórico/);
  });
});

describe("CA-11 / CA-15: .lovable/mcp/manifest.json matches the code", () => {
  it("both descriptions in the manifest are the ones of the code", async () => {
    const { readFileSync } = await import("node:fs");
    const manifest = JSON.parse(readFileSync(".lovable/mcp/manifest.json", "utf8")) as {
      mcp: { tools: { name: string; description: string }[] };
    };
    for (const tool of [realMetrics, segmentCoverageTool]) {
      const t = tool as unknown as { name: string; description: string };
      expect(manifest.mcp.tools.find((m) => m.name === t.name)?.description, t.name).toBe(
        t.description,
      );
    }
  });
});
