// SDD-20261031-ux-move-without-drag: CA-1, 2, 6, 7, 13, 14, 15 (pure rules; the gestures are in src/components/board-move.test.tsx).
import { describe, expect, it } from "vitest";
import { DEFAULT_STAGES } from "@/lib/stages";
import { MOVE_COPY, UNDO_MS, adjacentColumn, boardAnnouncements, canMoveLead, columnAt, dealMoveOptions, isReversibleMove, leadMoveOptions, undoDeal, undoLead } from "@/lib/board-move";

const stages = DEFAULT_STAGES;
const open = stages.filter((s) => s.kind === "open").map((s) => s.key);

describe("CA-1 deal menu lists every stage and marks the current one", () => {
  const opts = dealMoveOptions(stages, open[1]!);
  it("includes open stages, Ganado and Perdido, in order", () => {
    expect(opts.map((o) => o.key)).toEqual([...open, "won", "lost"]);
    expect(opts.map((o) => o.label)).toContain("Ganado");
  });
  it("marks exactly the current stage", () => {
    expect(opts.filter((o) => o.current).map((o) => o.key)).toEqual([open[1]]);
  });
  it("uses the company's own stages, not a fixed list", () => {
    const custom = [{ key: "a", label: "Alfa", position: 1, kind: "open", board_group: "opportunity", probability: 10 }, { key: "won", label: "Ganado", position: 9, kind: "won", board_group: "closed", probability: 100 }] as never;
    expect(dealMoveOptions(custom, "a").map((o) => o.key)).toEqual(["a", "won"]);
  });
});

describe("CA-6 / CA-7 lead menu", () => {
  it("offers every stage, earlier ones and Descartado included, and marks the current one", () => {
    const o = leadMoveOptions("mql");
    expect(o.map((x) => x.key)).toEqual(["new", "contacted", "mql", "sql", "opportunity", "disqualified"]);
    expect(o.filter((x) => x.current).map((x) => x.key)).toEqual(["mql"]);
  });
  it("a lead that already is an opportunity cannot be moved from the lead board", () => {
    expect(canMoveLead("opportunity")).toBe(false);
    expect(canMoveLead("sql")).toBe(true);
    expect(canMoveLead("disqualified")).toBe(true);
    expect(MOVE_COPY.leadIsOpportunity).toContain("Pipeline");
  });
});

describe("CA-14 / CA-15 which moves can be undone", () => {
  it("deals: open → open is reversible; anything involving Ganado or Perdido is not", () => {
    expect(isReversibleMove({ entity: "deal", from: open[0]!, to: open[2]!, stages })).toBe(true);
    expect(isReversibleMove({ entity: "deal", from: open[0]!, to: "won", stages })).toBe(false);
    expect(isReversibleMove({ entity: "deal", from: open[0]!, to: "lost", stages })).toBe(false);
    expect(isReversibleMove({ entity: "deal", from: "won", to: open[0]!, stages })).toBe(false);
    expect(isReversibleMove({ entity: "deal", from: "lost", to: open[0]!, stages })).toBe(false);
  });
  it("leads: only among Nuevo, Contactado, MQL and SQL", () => {
    expect(isReversibleMove({ entity: "lead", from: "new", to: "sql" })).toBe(true);
    expect(isReversibleMove({ entity: "lead", from: "sql", to: "contacted" })).toBe(true);
    expect(isReversibleMove({ entity: "lead", from: "sql", to: "opportunity" })).toBe(false);
    expect(isReversibleMove({ entity: "lead", from: "new", to: "disqualified" })).toBe(false);
    expect(isReversibleMove({ entity: "lead", from: "disqualified", to: "new" })).toBe(false);
  });
  it("CA-13 dropping on the same stage is never a move", () => {
    expect(isReversibleMove({ entity: "deal", from: open[0]!, to: open[0]!, stages })).toBe(false);
    expect(isReversibleMove({ entity: "lead", from: "new", to: "new" })).toBe(false);
  });
  it("the undo window is 5 seconds, like Sugerencias", () => {
    expect(UNDO_MS).toBe(5000);
  });
});

describe("undo writes the values saved just before the move", () => {
  it("deal: previous stage and previous probability (even a hand-edited one), only if the stage is still the moved one", () => {
    expect(undoDeal({ prevStage: "qualified", prevProbability: 37, movedTo: "proposal" })).toEqual({ patch: { stage: "qualified", probability: 37 }, onlyIfStage: "proposal" });
  });
  it("lead: previous stage, only if still the moved one", () => {
    expect(undoLead({ prevStage: "new", movedTo: "mql" })).toEqual({ patch: { stage: "new" }, onlyIfStage: "mql" });
  });
});

describe("keyboard walks between columns", () => {
  const cols = [{ id: "c", left: 200, width: 100 }, { id: "a", left: 0, width: 100 }, { id: "b", left: 100, width: 100 }];
  it("moves to the neighbour and stops at the ends", () => {
    expect(adjacentColumn(cols, "a", 1)).toBe("b");
    expect(adjacentColumn(cols, "b", 1)).toBe("c");
    expect(adjacentColumn(cols, "c", 1)).toBe("c");
    expect(adjacentColumn(cols, "a", -1)).toBe("a");
    expect(adjacentColumn(cols, "c", -1)).toBe("b");
  });
  it("finds the column under a point", () => {
    expect(columnAt(cols, 130)).toBe("b");
    expect(columnAt([], 10)).toBeNull();
  });
});

describe("CA-12 screen reader messages", () => {
  const a = boardAnnouncements((id) => (id === "d1" ? "Acme" : id), (id) => ({ c1: "Cualificado", c2: "Propuesta" })[id] ?? id);
  const active = { id: "d1", data: { current: { column: "c1" } } };
  it("lifting says where the card is and how to move it", () => {
    const m = a.onDragStart({ active });
    expect(m).toContain("Acme");
    expect(m).toContain("Cualificado");
    expect(m).toContain("flechas");
  });
  it("moving and dropping say where it goes", () => {
    expect(a.onDragOver({ active, over: { id: "c2" } })).toContain("Propuesta");
    expect(a.onDragOver({ active, over: { id: "c1" } })).toBeUndefined();
    expect(a.onDragOver({ active, over: null })).toContain("ninguna etapa");
    expect(a.onDragEnd({ active, over: { id: "c2" } })).toContain("Has soltado «Acme» en Propuesta");
    expect(a.onDragEnd({ active, over: { id: "c1" } })).toContain("no cambia nada");
    expect(a.onDragCancel({ active })).toContain("Cancelado");
  });
});
