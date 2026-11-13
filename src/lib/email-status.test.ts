import { describe, expect, it } from "vitest";
import { EMAIL_STATUS_LABEL, emailBlockReason, emailGateMark, emailStatusFor } from "./email-status";

// NK-0173 SDD 3: every state has its Spanish word; the graduated gate blocks invalid/catch-all
// with a reason and marks unverified/unverifiable.
const now = new Date("2026-11-13T00:00:00Z");
const row = { email: "a@example.invalid", status: "verified" as const, checked_at: now.toISOString() };

describe("email status surfacing", () => {
  it("CA-1 every state has its word in Spanish", () => {
    expect(EMAIL_STATUS_LABEL).toEqual({
      verified: "verificado",
      catch_all: "catch-all",
      unverifiable: "no verificable",
      invalid: "inválido",
      unverified: "sin verificar",
    });
  });
  it("CA-1 an empty or missing address is not a case of the rule", () => {
    expect(emailStatusFor(null, row, now)).toBeNull();
    expect(emailStatusFor("  ", row, now)).toBeNull();
    expect(emailStatusFor("a@example.invalid", row, now)).toBe("verified");
  });
  it("CA-1 an expired check reads as unverified", () => {
    const old = { ...row, checked_at: new Date(now.getTime() - 91 * 86400000).toISOString() };
    expect(emailStatusFor("a@example.invalid", old, now)).toBe("unverified");
  });
  it("CA-3 invalid and catch-all carry a reason and what to do", () => {
    expect(emailBlockReason("invalid")).toBe(
      "Este email es inválido: no preparo el borrador. Busca otro contacto de la cuenta.",
    );
    expect(emailBlockReason("catch_all")).toBe(
      "Este dominio acepta cualquier dirección (catch-all): no preparo el borrador. Busca otro contacto de la cuenta.",
    );
    for (const s of ["verified", "unverified", "unverifiable"] as const)
      expect(emailBlockReason(s)).toBeNull();
  });
  it("CA-4 unverified and unverifiable carry a visible mark; verified carries none", () => {
    expect(emailGateMark("unverified")).toBe("email sin verificar");
    expect(emailGateMark("unverifiable")).toBe("email no verificable");
    expect(emailGateMark("verified")).toBeNull();
    expect(emailGateMark("invalid")).toBeNull();
    expect(emailGateMark("catch_all")).toBeNull();
  });
});
