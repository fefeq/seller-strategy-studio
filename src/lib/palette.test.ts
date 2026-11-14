// Ola 0.2 / 0.3: ⌘K opens the exact lead or person, and lists Respuestas and Onboarding.
import { describe, expect, it } from "vitest";
import { hitTarget, PALETTE_SCREENS } from "./palette";

describe("hitTarget", () => {
  it("opens the exact lead", () => {
    expect(hitTarget({ kind: "Lead", id: "l1" })).toEqual({ to: "/leads", search: { lead: "l1" } });
  });
  it("opens the exact person", () => {
    expect(hitTarget({ kind: "Persona", id: "p1" })).toEqual({ to: "/people", search: { persona: "p1" } });
  });
  it("keeps accounts and deals", () => {
    expect(hitTarget({ kind: "Cuenta", id: "a1" })).toEqual({ to: "/accounts/$id", params: { id: "a1" } });
    expect(hitTarget({ kind: "Deal", id: "d1" })).toEqual({ to: "/deals", search: { deal: "d1" } });
  });
});

describe("PALETTE_SCREENS", () => {
  it("includes /replies and /onboarding", () => {
    const to = PALETTE_SCREENS.map((s) => s.to);
    expect(to).toContain("/replies");
    expect(to).toContain("/onboarding");
  });
});
