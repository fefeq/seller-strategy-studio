import { describe, expect, it } from "vitest";
import { consumeNonce, newNonce, nonceCookieOptions, readCookie, safeReturnPath, sameNonce, signState, STATE_TTL_MS, verifyState, type OAuthState } from "./oauth-state";

const now = 1_800_000_000_000;
const state: OAuthState = { p: "drive", o: "org-1", u: "user-1", r: "/integrations", t: now + STATE_TTL_MS, n: "nonce-de-prueba-0123456789" };

describe("state signature (CA-17 of SDD 10 · a state cannot be forged, changed or kept past its time)", () => {
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

describe("browser binding (CA-17 of SDD 10 · the state alone is not enough)", () => {
  it("refuses a signed state without a nonce", async () => {
    const { n: _n, ...noNonce } = state;
    const token = await signState("secreto-de-prueba", noNonce as OAuthState);
    expect(await verifyState("secreto-de-prueba", token, now)).toBeNull();
  });
  it("makes unpredictable nonces and compares them whole", () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(sameNonce("abc", "abc")).toBe(true);
    for (const [a, b] of [["abc", "abd"], ["abc", "ab"], ["", "a"]]) expect(sameNonce(a, b)).toBe(false);
  });
  it("a nonce is consumed once and forgotten after its time", () => {
    const n = newNonce();
    expect(consumeNonce(n, now + 1000, now)).toBe(true);
    expect(consumeNonce(n, now + 1000, now)).toBe(false);
    expect(consumeNonce(newNonce(), now + 1000, now + 5000)).toBe(true);
  });
  it("reads only its own cookie, and the cookie is httpOnly, Lax and limited to the provider's callback", () => {
    expect(readCookie("a=1; nokko_oauth_drive=xyz; b=2", "nokko_oauth_drive")).toBe("xyz");
    for (const h of [null, "", "a=1", "nokko_oauth_drive=", "xnokko_oauth_drive=1"]) expect(readCookie(h, "nokko_oauth_drive")).toBeNull();
    expect(nonceCookieOptions("drive", true)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/api/public/drive", maxAge: 600 });
  });
});

describe("safeReturnPath · never leave the app", () => {
  it("keeps in-app paths and refuses other sites", () => {
    expect(safeReturnPath("/integrations")).toBe("/integrations");
    expect(safeReturnPath("/onboarding?paso=fuentes")).toBe("/onboarding?paso=fuentes");
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "integrations", "", null, 5]) expect(safeReturnPath(bad)).toBe("/integrations");
  });
});
