// SDD-20261118-ux-legibilidad-pantallas-diarias · U-4 · CA-7b (gate round 2): the plan cell puts its own line only
// under a «Sin dato · motivo» mark; a number and «sin plan» stay inline.
import { describe, expect, it } from "vitest";
import { planIsMark } from "@/components/metrics/mark-text";

describe("planIsMark", () => {
  it("a number is not a mark", () => {
    expect(planIsMark({ value: 5000, state: "dato", reason: null })).toBe(false);
  });
  it("«sin plan» and «sin clientes presupuestados» are plain words, not marks", () => {
    expect(planIsMark({ value: null, state: "sin_dato", reason: "sin plan" })).toBe(false);
    expect(
      planIsMark({ value: null, state: "sin_dato", reason: "sin clientes presupuestados" }),
    ).toBe(false);
  });
  it("a missing figure with another reason is a «Sin dato» mark", () => {
    expect(planIsMark({ value: null, state: "sin_dato", reason: "falta margen" })).toBe(true);
  });
  it("a state «sin_dato» with a value is still a mark", () => {
    expect(planIsMark({ value: 3, state: "sin_dato", reason: "falta ACV" })).toBe(true);
  });
});
