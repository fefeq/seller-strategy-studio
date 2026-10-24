import { describe, expect, it } from "vitest";
import { buildTimeline, daysSinceTouch, fillTemplate, missingVars, monthGrid, offerFromLines } from "./crm";

describe("buildTimeline", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  it("merges activities, calls, past meetings, done tasks and stage changes, newest first", () => {
    const t = buildTimeline({
      now,
      activities: [{ id: "1", kind: "email", subject: "Propuesta", body: "", occurred_at: "2026-10-20T10:00:00Z" }],
      calls: [{ id: "2", title: "Discovery", occurred_at: "2026-10-22T10:00:00Z", summary: null, created_at: "2026-10-22T10:00:00Z" }],
      meetings: [
        { id: "3", title: "Demo", scheduled_at: "2026-10-23T10:00:00Z", notes: null, created_at: "2026-10-01T00:00:00Z" },
        { id: "4", title: "Futura", scheduled_at: "2026-11-02T10:00:00Z", notes: null, created_at: "2026-10-01T00:00:00Z" },
      ],
      tasks: [{ id: "5", title: "Enviar NDA", due_date: "2026-10-21", done: true, created_at: "2026-10-01" }, { id: "6", title: "Abierta", due_date: "2026-10-25", done: false, created_at: "2026-10-01" }],
      stages: [{ deal_id: "d", from_stage: "discovery", to_stage: "proposal", changed_at: "2026-10-24T09:00:00Z" }],
      stageLabel: (k) => ({ discovery: "Discovery", proposal: "Propuesta" })[k] ?? k,
    });
    expect(t.map((i) => i.title)).toEqual(["Discovery → Propuesta", "Demo", "Discovery", "Hecho: Enviar NDA", "Propuesta"]);
    expect(daysSinceTouch(t, now)).toBe(1);
  });
  it("has no last touch without activity", () => {
    expect(daysSinceTouch(buildTimeline({ stages: [{ deal_id: "d", from_stage: null, to_stage: "x", changed_at: "2026-10-01" }] }))).toBeNull();
  });
});

describe("fillTemplate", () => {
  it("fills known variables and leaves unknown ones visible", () => {
    expect(fillTemplate("Hola {{nombre}}, sobre {{ empresa }} y {{deal}}", { nombre: "Ana", empresa: "Acme" })).toBe("Hola Ana, sobre Acme y {{deal}}");
    expect(missingVars("Hola {{nombre}} {{nombre}} {{deal}}")).toEqual(["nombre", "deal"]);
  });
});

describe("offerFromLines", () => {
  it("numbers the next version and freezes yearly recurring and one-off totals without costs", () => {
    const o = offerFromLines([
      { name: "Pro", quantity: 2, unit_price: 100, unit_cost: 20, discount_pct: 10, billing: "monthly" },
      { name: "Setup", quantity: 1, unit_price: 500, unit_cost: null, discount_pct: 0, billing: "one_off" },
    ], [1, 2]);
    expect(o.version).toBe(3);
    expect(o.recurring_total).toBe(2160);
    expect(o.one_off_total).toBe(500);
    expect(Object.keys(o.lines[0])).not.toContain("unit_cost");
  });
});

describe("monthGrid", () => {
  it("starts weeks on Monday", () => {
    const g = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday
    expect(g[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(g.flat().filter(Boolean).length).toBe(31);
  });
});

import { teamOwners } from "./crm";
describe("teamOwners", () => {
  const teams = [{ id: "t1", lead_id: "lead" }, { id: "t2", lead_id: null }];
  const members = [{ team_id: "t1", user_id: "ana" }, { team_id: "t2", user_id: "luis" }];
  it("shows everyone without a filter", () => expect(teamOwners("", teams, members, "ana")).toBeNull());
  it("«Mi equipo» shows my teammates, the team lead and me", () => expect([...teamOwners("mine", teams, members, "ana")!].sort()).toEqual(["ana", "lead"]));
  it("a chosen team shows only its people", () => expect([...teamOwners("t2", teams, members, "ana")!]).toEqual(["luis"]));
});
