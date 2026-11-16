import { describe, expect, it } from "vitest";
import {
  checkStageEdit,
  DEFAULT_STAGES,
  firstOpenStage,
  lateStages,
  newStageKey,
  openStages,
  reorderOpen,
  sortStages,
  stageByLabel,
  stageIndex,
  stageLabel,
  stageOptions,
  stagePath,
  type Stage,
} from "./stages";
import { pipelineBoard } from "./pipeline-board";
import { DEFAULT_LEAD_SLA } from "./lead-funnel";
import { weeklyReport } from "./weekly-report";
import { stageGate } from "./bmad/tracks";
import { meddpiccGaps } from "./proactive/detectors/meddpicc-gaps";

// A company that renamed Demo, added Piloto after it, removed Negociación and listed Perdido first.
const custom: Stage[] = [
  { key: "lost", label: "Perdido", position: 101, kind: "lost", board_group: null, probability: 0 },
  {
    key: "discovery",
    label: "Primera llamada",
    position: 1,
    kind: "open",
    board_group: "opportunity",
    probability: 10,
  },
  {
    key: "demo",
    label: "Demo",
    position: 2,
    kind: "open",
    board_group: "progress",
    probability: 40,
  },
  {
    key: "piloto",
    label: "Piloto",
    position: 3,
    kind: "open",
    board_group: "progress",
    probability: 60,
  },
  {
    key: "proposal",
    label: "Propuesta",
    position: 4,
    kind: "open",
    board_group: "progress",
    probability: 75,
  },
  { key: "won", label: "Cliente", position: 100, kind: "won", board_group: null, probability: 100 },
];

describe("stages", () => {
  it("falls back to the default seven", () => {
    expect(sortStages(null).map((s) => s.key)).toEqual(DEFAULT_STAGES.map((s) => s.key));
    expect(stagePath([])).toEqual([
      "discovery",
      "qualified",
      "demo",
      "proposal",
      "negotiation",
      "won",
    ]);
  });
  it("orders open stages by position, then won, then lost", () => {
    expect(sortStages(custom).map((s) => s.key)).toEqual([
      "discovery",
      "demo",
      "piloto",
      "proposal",
      "won",
      "lost",
    ]);
    expect(openStages(custom).map((s) => s.key)).toEqual([
      "discovery",
      "demo",
      "piloto",
      "proposal",
    ]);
    expect(firstOpenStage(custom).key).toBe("discovery");
    expect(stagePath(custom)).toEqual(["discovery", "demo", "piloto", "proposal", "won"]);
  });
  it("names stages with the company label, and keeps unknown keys readable", () => {
    expect(stageLabel("won", custom)).toBe("Cliente");
    expect(stageLabel("negotiation", custom)).toBe("Negociación");
    expect(stageLabel("raro", custom)).toBe("raro");
    expect(stageOptions(custom)).toEqual({
      discovery: "Primera llamada",
      demo: "Demo",
      piloto: "Piloto",
      proposal: "Propuesta",
    });
    expect(Object.keys(stageOptions(custom, true))).toEqual([
      "discovery",
      "demo",
      "piloto",
      "proposal",
      "won",
      "lost",
    ]);
  });
  it("puts lost off the path", () => {
    expect(stageIndex("lost", custom)).toBe(-1);
    expect(stageIndex("piloto", custom)).toBe(2);
  });
  it("makes unique keys that are never won or lost", () => {
    expect(newStageKey("Prueba técnica", custom)).toBe("prueba_tecnica");
    expect(newStageKey("Piloto", custom)).toBe("piloto_2");
    expect(newStageKey("Won", custom)).toBe("won_2");
    expect(newStageKey("¿?", custom)).toBe("etapa");
  });
  it("checks names and probabilities", () => {
    expect(checkStageEdit("  ", 10, custom)).toMatch(/nombre/);
    expect(checkStageEdit("Piloto", 10, custom)).toMatch(/Ya hay/);
    expect(checkStageEdit("Piloto", 10, custom, "piloto")).toBeNull();
    expect(checkStageEdit("Firma", 120, custom)).toMatch(/entre 0 y 100/);
  });
  it("swaps one open stage with its neighbour and renumbers only what changed", () => {
    expect(reorderOpen(custom, "piloto", -1)).toEqual([
      { key: "piloto", position: 2 },
      { key: "demo", position: 3 },
    ]);
    expect(reorderOpen(custom, "discovery", -1)).toEqual([]);
    expect(reorderOpen(custom, "won", 1)).toEqual([]);
  });
  it("matches a label written by a person", () => {
    expect(stageByLabel("piloto", custom)).toBe("piloto");
    expect(stageByLabel("Primera  llamada", custom)).toBe("discovery");
    expect(stageByLabel("won", custom)).toBe("won");
    expect(stageByLabel("cliente", custom)).toBe("won");
    expect(stageByLabel("Negociación", custom)).toBeNull();
  });
  it("late stages are the last two open ones, fewer when the pipeline is short", () => {
    expect([...lateStages(custom)]).toEqual(["piloto", "proposal"]);
    expect([...lateStages(null)]).toEqual(["proposal", "negotiation"]);
    expect([...lateStages(custom.filter((s) => s.key !== "piloto"))]).toEqual(["proposal"]);
    expect([...lateStages(custom.filter((s) => s.key !== "piloto" && s.key !== "demo"))]).toEqual(
      [],
    );
  });
  it("an exact key wins over another stage's label", () => {
    const swapped: Stage[] = [
      {
        key: "qualified",
        label: "Demo",
        position: 1,
        kind: "open",
        board_group: "opportunity",
        probability: 25,
      },
      {
        key: "demo",
        label: "Prueba técnica",
        position: 2,
        kind: "open",
        board_group: "progress",
        probability: 40,
      },
    ];
    expect(stageByLabel("demo", swapped)).toBe("demo");
    expect(stageByLabel("Demo", swapped)).toBe("qualified");
    expect(stageByLabel("prueba tecnica", swapped)).toBe("demo");
  });
  it("names that differ only in accents clash; standard keys stay reserved after a delete", () => {
    expect(checkStageEdit("Proposta", 10, custom)).toBeNull();
    expect(checkStageEdit("propuésta", 10, custom)).toMatch(/Ya hay/);
    expect(newStageKey("Negotiation", custom)).toBe("negotiation_2");
  });
});

describe("company stages downstream", () => {
  const now = new Date("2026-11-10T10:00:00Z");
  const deal = (id: string, stage: string) => ({
    id,
    name: id,
    owner_id: null,
    stage,
    amount: 1000,
    close_date: "2026-12-01",
    closed_at: null,
    updated_at: "2026-11-01T00:00:00Z",
  });
  it("the board shows the company's columns in its groups", () => {
    const board = pipelineBoard(
      [],
      [deal("a", "piloto"), deal("b", "discovery")],
      { start: new Date("2026-10-01"), end: new Date("2027-01-01") },
      DEFAULT_LEAD_SLA,
      now,
      custom,
    );
    expect(board.find((g) => g.id === "opportunities")!.columns.map((c) => c.label)).toEqual([
      "Primera llamada",
    ]);
    const progress = board.find((g) => g.id === "progress")!;
    expect(progress.columns.map((c) => c.stage)).toEqual(["demo", "piloto", "proposal"]);
    expect(progress.count).toBe(1);
  });
  it("the weekly report follows the company's order and names", () => {
    const r = weeklyReport({
      now,
      deals: [
        { ...deal("a", "proposal"), segment_id: null, created_at: "2026-10-01T00:00:00Z" },
        { ...deal("b", "demo"), segment_id: null, created_at: "2026-10-01T00:00:00Z" },
      ],
      history: [
        {
          deal_id: "a",
          from_stage: "piloto",
          to_stage: "proposal",
          changed_at: "2026-11-05T00:00:00Z",
        },
        { deal_id: "b", from_stage: "lost", to_stage: "demo", changed_at: "2026-11-05T00:00:00Z" },
      ],
      leads: [],
      segments: [],
      staleDays: null,
      leadSla: DEFAULT_LEAD_SLA,
      money: (n) => `${n} €`,
      stages: custom,
    });
    expect(r.advanced).toEqual([{ id: "a", name: "a", from: "Piloto", to: "Propuesta" }]);
  });
  it("stage gates walk the company's path and keep the criteria of standard stages it removed", () => {
    const g = stageGate({ amount: 20000, meddpicc: {} }, "proposal", stagePath(custom));
    expect(g.missing).toEqual(
      expect.arrayContaining([
        "Identify pain",
        "Metrics",
        "Champion",
        "Economic buyer",
        "Decision criteria",
      ]),
    );
    expect(
      stageGate({ amount: 20000, meddpicc: {} }, "discovery", stagePath(custom)).missing,
    ).toEqual([]);
    expect(
      stageGate({ amount: 20000, meddpicc: {} }, "piloto", stagePath(custom)).missing,
    ).toContain("Metrics");
  });
  it("the MEDDPICC detector watches the company's late stages and names them", () => {
    const found = meddpiccGaps({
      now,
      orgId: "o",
      setup: {} as never,
      meetings: [],
      accounts: [],
      stakeholders: [],
      registrations: [],
      trials: [],
      segments: [],
      deals: [
        {
          id: "a",
          name: "Acme",
          stage: "piloto",
          amount: 1,
          close_date: null,
          updated_at: "",
          owner_id: null,
          meddpicc: {},
          account_id: null,
        },
      ],
      stages: custom,
    });
    expect(found[0].title).toBe("Acme está en Piloto con MEDDPICC incompleto");
  });
});
