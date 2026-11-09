// SDD-20261109-deals-no-source U-2 (NK-0107) CA-3 and the source guard of §13: the one place that names a deal source.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AI_NO_SOURCE,
  DEAL_SOURCE_LABELS,
  NO_SOURCE,
  dealSourceLabel,
  dealSourceOptions,
} from "./deal-source";
import { NO_SOURCE as METRICS_NO_SOURCE } from "./metrics-quarter";

describe("dealSourceLabel", () => {
  it("names a missing source «Sin origen», for null and for the grouping key", () => {
    expect(dealSourceLabel(null)).toBe("Sin origen");
    expect(dealSourceLabel(undefined)).toBe("Sin origen");
    expect(dealSourceLabel(NO_SOURCE)).toBe("Sin origen");
  });
  it("names the six known sources", () => {
    expect(dealSourceLabel("plg")).toBe("Producto (PLG)");
    expect(Object.keys(DEAL_SOURCE_LABELS)).toEqual([
      "outbound",
      "inbound",
      "partner",
      "plg",
      "event",
      "referral",
    ]);
  });
  it("returns an unknown text as it is", () => {
    expect(dealSourceLabel("Entrada de leads")).toBe("Entrada de leads");
  });
  it("shares the grouping key with Métricas and keeps the AI wording apart", () => {
    expect(NO_SOURCE).toBe(METRICS_NO_SOURCE);
    expect(AI_NO_SOURCE).toBe("sin origen");
  });
});

describe("dealSourceOptions", () => {
  it("starts with «Sin origen» and then the six, never choosing outbound for a null", () => {
    const o = dealSourceOptions(null);
    expect(Object.entries(o)[0]).toEqual(["", "Sin origen"]);
    expect(Object.keys(o)).toEqual([
      "",
      "outbound",
      "inbound",
      "partner",
      "plg",
      "event",
      "referral",
    ]);
  });
  it("adds a free text that is not one of the six as its own option", () => {
    const o = dealSourceOptions("Entrada de leads");
    expect(o["Entrada de leads"]).toBe("Entrada de leads");
    expect(Object.keys(o)).toHaveLength(8);
  });
  it("adds nothing for a known source", () => {
    expect(Object.keys(dealSourceOptions("inbound"))).toHaveLength(7);
  });
});

describe("source guard", () => {
  it("deal-source.ts never writes the literal «—»", () => {
    const src = readFileSync(`${process.cwd()}/src/lib/deal-source.ts`, "utf8");
    expect(src).not.toContain("—");
  });
});
