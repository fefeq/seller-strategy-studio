import { describe, expect, it } from "vitest";
import { levelsFor, nextCursor, revealCost } from "./search";
import { planFor } from "./planner";

describe("need-based searches", () => {
  it("translates C-Level to each service's word and drops unknown levels", () => {
    expect(levelsFor("apollo", ["c_suite", "vp", "intern"])).toEqual(["c_suite", "vp"]);
    expect(levelsFor("clay", ["c_suite", "vp"])).toEqual(["c-suite", "vp"]);
  });

  it("keeps asking the same service for more results", () => {
    expect(nextCursor("apollo", true, 1, null)).toEqual({ service: "apollo", page: 2 });
    expect(nextCursor("clay", true, 1, "s_123")).toEqual({ service: "clay", searchId: "s_123" });
    expect(nextCursor("apollo", false, 1, null)).toBeNull();
  });

  it("reveal costs 0,02 € per email and more with the mobile", () => {
    expect(revealCost(3, false)).toBe(0.06);
    expect(revealCost(1, true)).toBe(0.17);
  });

  it("key people: free Apollo search first, then Clay", () => {
    const p = planFor({ need: "find_stakeholders", connected: ["apollo", "clay"], budget: { remaining: Infinity, automatic: false, paused: false } });
    expect(p.steps.map((s) => s.service)).toEqual(["apollo", "clay"]);
  });

  it("ICP companies: quick search tries Apollo before Clay and Parallel", () => {
    const p = planFor({ need: "icp_companies", connected: ["apollo", "clay", "parallel"], budget: { remaining: Infinity, automatic: false, paused: false } });
    expect(p.steps[0].service).toBe("apollo");
    expect(p.steps.map((s) => s.service)).toContain("clay");
  });
});
