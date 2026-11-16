import { describe, expect, it } from "vitest";
import { looksLikeSecret } from "./secret-guard";

describe("looksLikeSecret (E3: no secrets in chat)", () => {
  it("flags provider keys and tokens", () => {
    expect(looksLikeSecret("mi clave es sk-proj-abcdefghijklmnopqrstuvwx123")).toBe(true);
    expect(looksLikeSecret("sk_live_51HabcdefghijklmnopQRST")).toBe(true);
    expect(looksLikeSecret("AIzaSyA1234567890abcdefghijklmnopqrstu")).toBe(true);
    expect(
      looksLikeSecret("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop"),
    ).toBe(true);
    expect(looksLikeSecret("password: SuperSecreta2026!")).toBe(true);
  });
  it("lets normal onboarding messages through", () => {
    expect(looksLikeSecret("Nuestra web es https://postinapp.com, empieza el onboarding")).toBe(
      false,
    );
    expect(looksLikeSecret("Aprueba el bloque de ICP")).toBe(false);
    expect(looksLikeSecret("La contraseña la gestiona IT")).toBe(false);
  });
});
