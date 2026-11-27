import { describe, expect, it } from "vitest";
import {
  firstMissingStrategySection,
  isEmptyStrategyText,
  missingSectionMessage,
  type StrategySnapshot,
} from "./strategy-approval-check";

const complete = (): StrategySnapshot => ({
  icpProfiles: [{ name: "Distribuidoras medianas", industries: "Logística", why_fit: "" }],
  segments: [{ name: "Mid-market", motion: "inside" }],
  positioning: [{ one_liner: "Menos tiempo en rutas, más entregas" }],
  messagingPillars: [{ title: "Ahorro", message: "Recorta horas de planificación" }],
});

describe("isEmptyStrategyText", () => {
  it("treats whitespace-only text as empty", () => {
    expect(isEmptyStrategyText("   \n\t ")).toBe(true);
    expect(isEmptyStrategyText(null)).toBe(true);
  });

  it("treats placeholder text as empty", () => {
    expect(isEmptyStrategyText("Describe aquí tu cliente ideal")).toBe(true);
    expect(isEmptyStrategyText("...")).toBe(true);
    expect(isEmptyStrategyText("Lorem ipsum dolor")).toBe(true);
  });

  it("accepts real text", () => {
    expect(isEmptyStrategyText("Empresas de logística")).toBe(false);
  });
});

describe("firstMissingStrategySection", () => {
  it("returns null when all five sections are complete", () => {
    expect(firstMissingStrategySection(complete())).toBeNull();
  });

  it("names the section filled only with spaces", () => {
    const s = complete();
    s.messagingPillars = [{ title: "Ahorro", message: "    " }];
    expect(firstMissingStrategySection(s)).toBe("Mensajes");
  });

  it("names the ideal customer section when it has placeholder text", () => {
    const s = complete();
    s.icpProfiles = [{ name: "ICP", industries: "Describe aquí la industria", why_fit: " " }];
    expect(firstMissingStrategySection(s)).toBe("Cliente ideal");
  });

  it("names positioning when every field is blank", () => {
    const s = complete();
    s.positioning = [{ one_liner: "", elevator_pitch: "  ", differentiation: null }];
    expect(firstMissingStrategySection(s)).toBe("Posicionamiento");
  });

  it("names sales models when no segment has a motion", () => {
    const s = complete();
    s.segments = [{ name: "Mid-market", motion: " " }];
    expect(firstMissingStrategySection(s)).toBe("Modelos de venta");
  });

  it("builds a message that names the section", () => {
    expect(missingSectionMessage("Mensajes")).toContain("«Mensajes»");
  });
});
