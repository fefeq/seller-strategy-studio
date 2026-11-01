import { describe, expect, it } from "vitest";
import { CAPABILITIES, NEED_KEYS, budgetState, planFor, sourcesLine, type Need } from "./planner";

const open = { remaining: 100, automatic: false, paused: false };

describe("planFor", () => {
  it("deep research puts Parallel first, quick research the fast sources", () => {
    const connected = ["parallel", "firecrawl", "perplexity"] as const;
    expect(
      planFor({ need: "research_account", connected: [...connected], depth: "deep", budget: open })
        .steps[0].service,
    ).toBe("parallel");
    expect(
      planFor({ need: "research_account", connected: [...connected], depth: "quick", budget: open })
        .steps[0].service,
    ).not.toBe("parallel");
  });
  it("email: Apollo first, Clay as fallback; skips what is not connected", () => {
    const p = planFor({ need: "find_email", connected: ["apollo", "clay"], budget: open });
    expect(p.steps.map((s) => s.service)).toEqual(["apollo", "clay"]);
    expect(planFor({ need: "find_email", connected: ["clay"], budget: open }).skipped[0]).toEqual({
      service: "apollo",
      reason: "no conectado",
    });
  });
  it("automatic work stops when the budget is paused, manual work does not", () => {
    expect(
      planFor({
        need: "find_email",
        connected: ["apollo"],
        budget: { remaining: 0, automatic: true, paused: true },
      }).blocked,
    ).toMatch(/Límite/);
    expect(
      planFor({
        need: "find_stakeholders",
        connected: ["apollo"],
        budget: { remaining: 0, automatic: false, paused: true },
      }).steps[0].service,
    ).toBe("apollo");
  });
});

describe("budgetState", () => {
  it("warns at 80 % and pauses at 100 %", () => {
    expect(budgetState(79, 100)).toMatchObject({ warn: false, paused: false });
    expect(budgetState(80, 100)).toMatchObject({ warn: true, paused: false });
    expect(budgetState(100, 100)).toMatchObject({ warn: true, paused: true, remaining: 0 });
    expect(budgetState(500, null).paused).toBe(false);
  });
});

it("sourcesLine names services and total", () => {
  expect(
    sourcesLine([
      { service: "parallel", cost: 0.3 },
      { service: "firecrawl", cost: 0.1 },
    ]),
  ).toBe("Fuentes: Parallel, Firecrawl · coste aprox. 0,40 €");
});

describe("NEED_KEYS", () => {
  it("declares a key for every need, and only for needs that exist", () => {
    expect(Object.keys(NEED_KEYS).sort()).toEqual(Object.keys(CAPABILITIES).sort());
  });
  it("account needs require the account key for that same need; contact needs require the person key", () => {
    for (const n of ["research_account", "find_stakeholders", "enrich_account"] as const)
      expect(NEED_KEYS[n]).toEqual({ entity: "cuenta", need: n });
    for (const n of ["enrich_contact", "find_email", "find_phone"] as const)
      expect(NEED_KEYS[n]).toEqual({ entity: "persona" });
  });
  it("needs that search by topic or read a file declare no key", () => {
    const none: Need[] = [
      "news_signals",
      "icp_companies",
      "case_studies",
      "competitors",
      "read_document",
    ];
    for (const n of none) expect(NEED_KEYS[n]).toBeNull();
  });
});
