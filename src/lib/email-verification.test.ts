import { describe, expect, it } from "vitest";
import {
  EMAIL_RECHECK_DAYS,
  apolloEmailStatus,
  effectiveEmailStatus,
  emailDraftGate,
  normalizeVerificationEmail,
} from "./email-verification";
const email = "synthetic@example.invalid";
const now = new Date("2026-11-13T00:00:00Z");
describe("NK-0173 model", () => {
  it("CA-1 normalizes and never reuses another address", () => {
    expect(normalizeVerificationEmail(" SYNTHETIC@EXAMPLE.INVALID ")).toBe(email);
    expect(effectiveEmailStatus(email, null, now)).toBe("unverified");
    expect(
      effectiveEmailStatus(
        email,
        { email: "other@example.invalid", status: "verified", checked_at: now.toISOString() },
        now,
      ),
    ).toBe("unverified");
  });
  it("CA-2 rechecks after exactly the 90-day window and rejects invalid/future dates", () => {
    expect(EMAIL_RECHECK_DAYS).toBe(90);
    const row = {
      email,
      status: "verified" as const,
      checked_at: new Date(now.getTime() - 90 * 86400000).toISOString(),
    };
    expect(effectiveEmailStatus(email, row, now)).toBe("verified");
    expect(effectiveEmailStatus(email, row, new Date(now.getTime() + 1))).toBe("unverified");
    expect(effectiveEmailStatus(email, { ...row, checked_at: "bad" }, now)).toBe("unverified");
    expect(effectiveEmailStatus(email, { ...row, checked_at: "2026-11-14T00:00:00Z" }, now)).toBe(
      "unverified",
    );
  });
  it("CA-3 only recognizes documented verified; unknown and absent never verify", () => {
    expect(apolloEmailStatus("verified")).toBe("verified");
    for (const value of [null, undefined, "", "extrapolated", "unavailable", "surprise"])
      expect(apolloEmailStatus(value)).toBe("unverifiable");
  });
  it("CA-4 invalid and catch-all cannot bypass the gate", () => {
    for (const status of ["invalid", "catch_all"] as const)
      for (const strict of [false, true])
        expect(emailDraftGate(status, strict).allowed).toBe(false);
  });
  it("CA-5 unknown states pass marked unless only-verified is requested", () => {
    for (const status of ["unverified", "unverifiable"] as const) {
      expect(emailDraftGate(status)).toEqual({ allowed: true, marked: true });
      expect(emailDraftGate(status, true).allowed).toBe(false);
    }
    expect(emailDraftGate("verified", true)).toEqual({ allowed: true, marked: false });
  });
});
