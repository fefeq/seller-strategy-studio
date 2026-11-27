import { describe, expect, it } from "vitest";
import {
  CORE_SECTIONS,
  approvalErrorMessage,
  approvalMessage,
  buildCorePatch,
  missingCoreSections,
  parseApprovalResult,
  type StrategySnapshot,
} from "./strategy-core";

const complete: StrategySnapshot = {
  icpProfiles: [{ industries: "Logística", why_fit: "" }],
  segments: [{ name: "Mid-market" }],
  positioning: [{ differentiator: "Entrega en 24 horas", key_benefit: "Menos inventario parado" }],
  pillars: [{ message: "Vende más sin sumar personas" }],
};

describe("strategy core sections", () => {
  it("shows exactly five sections", () => {
    expect(CORE_SECTIONS).toHaveLength(5);
  });

  it("finds nothing missing when the five sections are filled", () => {
    expect(missingCoreSections(complete)).toEqual([]);
  });

  it("reports which section is empty", () => {
    const s = { ...complete, pillars: [{ message: "   " }] };
    expect(missingCoreSections(s)).toEqual(["messages"]);
    expect(approvalMessage({ approved: false, missing: ["messages"] })).toBe("Falta completar: Mensajes.");
  });

  it("never sends hidden fields nor unchanged ones", () => {
    const original = { differentiator: "A", key_benefit: "B", elevator_pitch: "pitch guardado", tagline: "lema" };
    const edited = { differentiator: "A2", key_benefit: "B", elevator_pitch: "", tagline: null };
    const patch = buildCorePatch(original, edited, ["differentiator", "key_benefit"]);
    expect(patch).toEqual({ differentiator: "A2" });
    expect("elevator_pitch" in patch).toBe(false);
    expect("tagline" in patch).toBe(false);
  });

  it("parses the server answer safely", () => {
    expect(parseApprovalResult({ approved: true, missing: [] })).toEqual({ approved: true, missing: [] });
    expect(parseApprovalResult(null)).toEqual({ approved: false, missing: [] });
  });

  it("shows a clear message without technical text when the role is not allowed", () => {
    const msg = approvalErrorMessage({ code: "42501" });
    expect(msg).toContain("gerente");
    expect(msg).not.toMatch(/42501|exception|error/i);
  });
});
