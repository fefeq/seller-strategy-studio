import { describe, expect, it } from "vitest";
import { logoUrl } from "./logos";

describe("logoUrl", () => {
  it("builds a colour logo URL (dark variant on the dark theme) from a domain, URL or work email", () => {
    expect(logoUrl("https://www.typeform.com/x", { token: "pk_1", size: 20 })).toBe(
      "https://img.logo.dev/typeform.com?token=pk_1&size=64&format=png&fallback=404&theme=light",
    );
    expect(logoUrl("ana@acme.com", { token: "pk_1", size: 40, dark: true })).toBe(
      "https://img.logo.dev/acme.com?token=pk_1&size=128&format=png&fallback=404&theme=dark",
    );
  });
  it("never asks for greyscale", () => {
    expect(logoUrl("acme.com", { token: "pk_1" })).not.toContain("greyscale");
  });
  it("returns nothing without a company domain or key", () => {
    expect(logoUrl("ana@gmail.com", { token: "pk_1" })).toBeNull();
    expect(logoUrl("", { token: "pk_1" })).toBeNull();
    expect(logoUrl("Acme", { token: "pk_1" })).toBeNull();
    expect(logoUrl("acme.com", { token: undefined })).toBeNull();
  });
});
