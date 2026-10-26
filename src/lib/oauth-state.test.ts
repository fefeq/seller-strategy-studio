import { describe, expect, it } from "vitest";
import { safeReturnPath, signState, STATE_TTL_MS, verifyState, type OAuthState } from "./oauth-state";

const now = 1_800_000_000_000;
const state: OAuthState = { p: "drive", o: "org-1", u: "user-1", r: "/integrations", t: now + STATE_TTL_MS };

describe("state signature (SDD 10, CA-10 · only the person who started it can finish it)", () => {
  it("round-trips a valid state", async () => {
    const token = await signState("secreto-de-prueba", state);
    expect(await verifyState("secreto-de-prueba", token, now)).toEqual(state);
  });
  it("rejects a changed company or person, a wrong secret and junk", async () => {
    const token = await signState("secreto-de-prueba", state);
    const [, sig] = token.split(".");
    const forged = `${btoa(JSON.stringify({ ...state, o: "org-2" })).replace(/=+$/, "")}.${sig}`;
    expect(await verifyState("secreto-de-prueba", forged, now)).toBeNull();
    expect(await verifyState("otro-secreto", token, now)).toBeNull();
    for (const bad of ["", "x", "a.b", "..", "e30.e30"]) expect(await verifyState("secreto-de-prueba", bad, now)).toBeNull();
  });
  it("expires after ten minutes", async () => {
    const token = await signState("secreto-de-prueba", state);
    expect(await verifyState("secreto-de-prueba", token, state.t + 1)).toBeNull();
    expect(await verifyState("secreto-de-prueba", token, state.t)).not.toBeNull();
  });
});

describe("safeReturnPath · never leave the app", () => {
  it("keeps in-app paths and refuses other sites", () => {
    expect(safeReturnPath("/integrations")).toBe("/integrations");
    expect(safeReturnPath("/onboarding?paso=fuentes")).toBe("/onboarding?paso=fuentes");
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "integrations", "", null, 5]) expect(safeReturnPath(bad)).toBe("/integrations");
  });
});
