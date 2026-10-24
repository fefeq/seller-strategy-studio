import { describe, expect, it } from "vitest";
import { logoUrl } from "./logos";

describe("logoUrl", () => {
  it("builds a greyscale logo URL from a domain, URL or work email", () => {
    expect(logoUrl("https://www.typeform.com/x", { token: "pk_1", size: 20 })).toBe("https://img.logo.dev/typeform.com?token=pk_1&size=40&format=png&greyscale=true&fallback=404");
    expect(logoUrl("ana@acme.com", { token: "pk_1", size: 16, dark: true })).toBe("https://img.logo.dev/acme.com?token=pk_1&size=32&format=png&greyscale=true&fallback=404&theme=dark");
  });
  it("returns nothing without a company domain or key", () => {
    expect(logoUrl("ana@gmail.com", { token: "pk_1" })).toBeNull();
    expect(logoUrl("", { token: "pk_1" })).toBeNull();
    expect(logoUrl("Acme", { token: "pk_1" })).toBeNull();
    expect(logoUrl("acme.com", { token: undefined })).toBeNull();
  });
});
