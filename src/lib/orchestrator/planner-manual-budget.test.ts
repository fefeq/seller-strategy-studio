import { describe, expect, it } from "vitest";
import { budgetState, planFor } from "./planner";

// NK-0173 SDD 2 (Q-6): manual costed actions are never paused by the monthly limit; they still log their spend.
describe("planFor manual budget (Q-6)", () => {
  it("CA-1 a manual need with cost goes ahead with the budget exhausted; the automatic one stays blocked", () => {
    const manual = planFor({
      need: "find_email",
      connected: ["apollo", "clay"],
      budget: { remaining: 0, automatic: false, paused: true },
    });
    expect(manual.steps.map((s) => s.service)).toEqual(["apollo", "clay"]);
    expect(manual.blocked).toBeNull();
    const automatic = planFor({
      need: "find_email",
      connected: ["apollo", "clay"],
      budget: { remaining: 0, automatic: true, paused: true },
    });
    expect(automatic.steps).toEqual([]);
    expect(automatic.blocked).toMatch(/Límite/);
  });
  it("CA-1 an automatic need with cost is skipped without budget even when not paused yet", () => {
    const p = planFor({
      need: "find_email",
      connected: ["apollo"],
      budget: { remaining: 0.01, automatic: true, paused: false },
    });
    expect(p.steps).toEqual([]);
    expect(p.skipped).toContainEqual({ service: "apollo", reason: "sin presupuesto" });
  });
  it("CA-2 manual still skips what is not connected or already cached", () => {
    const p = planFor({
      need: "find_email",
      connected: ["clay"],
      alreadyHave: ["clay"],
      budget: { remaining: 0, automatic: false, paused: true },
    });
    expect(p.steps).toEqual([]);
    expect(p.skipped).toContainEqual({ service: "apollo", reason: "no conectado" });
    expect(p.skipped).toContainEqual({ service: "clay", reason: "ya hay datos" });
  });
  it("CA-2 the 80 % warning and the 100 % automatic pause do not change", () => {
    expect(budgetState(80, 100)).toMatchObject({ warn: true, paused: false });
    expect(budgetState(100, 100)).toMatchObject({ warn: true, paused: true, remaining: 0 });
  });
});
