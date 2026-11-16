import { describe, expect, it } from "vitest";
import { diagnose } from "./gtm-diagnosis";
import { lineDiagnosis, readLineInput, summarizeLines } from "./business-lines";

describe("NK-0167 business lines", () => {
  it.each(["b2b", "b2c", "marketplace"])("CA-1 rejects zero ticket for %s", (model) => {
    expect(readLineInput({ model, acv: 0, friction: "self_serve", stage: "early" })).toBeNull();
  });
  it("CA-1 rejects incomplete, non-numeric and non-finite inputs", () => {
    const valid = { model: "b2b", acv: 100, friction: "self_serve", stage: "early" };
    for (const acv of ["100", null, -1, NaN, Infinity])
      expect(readLineInput({ ...valid, acv })).toBeNull();
    for (const raw of [
      null,
      [],
      {},
      { ...valid, model: "other" },
      { ...valid, stage: "other" },
      { ...valid, friction: "other" },
    ])
      expect(readLineInput(raw)).toBeNull();
  });
  it("CA-8 a single line uses the existing diagnosis with no new rules", () => {
    const input = {
      model: "b2b" as const,
      acv: 1200,
      friction: "self_serve" as const,
      stage: "early" as const,
    };
    expect(lineDiagnosis(input)).toEqual(diagnose(input));
    expect(lineDiagnosis({ ...input, acv: 5000 })?.archetype).toBe("B");
    expect(lineDiagnosis({ ...input, acv: 50000 })?.archetype).toBe("C");
  });
  it("CA-8 lines remain separate and the public summary omits ticket and custom name", () => {
    const summary = summarizeLines([
      {
        id: "synthetic-first",
        name: "Private synthetic label",
        is_primary: true,
        position: 0,
        model: "b2b",
        acv: 80000,
        friction: "committee",
        stage: "scale",
      },
      {
        id: "synthetic-second",
        name: "Another synthetic label",
        is_primary: false,
        position: 1,
        model: "b2c",
        acv: 120,
        friction: "self_serve",
        stage: "early",
      },
    ]);
    expect(summary.map((line) => line.archetype)).toEqual(["C", "D"]);
    expect(summary.map((line) => line.motion)).toEqual(["field_sales", "plg"]);
    expect(summary[0]?.isPrimary).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("Private synthetic label");
    expect(summary.every((line) => !("acv" in line) && !("name" in line))).toBe(true);
  });
  it("CA-1 invalid lines never become diagnoses or public summaries", () => {
    const invalid = {
      id: "invalid",
      is_primary: true,
      position: 0,
      model: "b2c",
      acv: 0,
      friction: "self_serve",
      stage: "early",
    };
    expect(lineDiagnosis(invalid)).toBeNull();
    expect(summarizeLines([invalid])).toEqual([]);
  });
});
