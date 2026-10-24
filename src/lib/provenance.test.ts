import { describe, expect, it } from "vitest";
import { quoteFound, readSources, sourceText, stampSources } from "./provenance";

describe("provenance", () => {
  it("stamps filled fields and keeps the other marks", () => {
    const out = stampSources({ size: { source: "clay", at: "2026-10-01T00:00:00Z" } }, [{ field: "industry", source: "apollo" }], "2026-10-24T10:00:00Z");
    expect(out.industry).toEqual({ source: "apollo", at: "2026-10-24T10:00:00Z" });
    expect(out.size?.source).toBe("clay");
  });
  it("ignores malformed rows", () => {
    expect(readSources({ a: 1, b: { source: "web", at: "x" } })).toEqual({ b: { source: "web", at: "x" } });
    expect(readSources(null)).toEqual({});
  });
  it("labels the web source", () => {
    expect(sourceText({ source: "web", at: "2026-10-24T10:00:00Z" })).toMatch(/^Automático · Web de la empresa · 24/);
    expect(sourceText(undefined)).toBeNull();
  });
  it("accepts a web value only with a literal quote", () => {
    const page = "Somos una fintech con sede en Madrid y más de 200 empleados.";
    expect(quoteFound("con sede en madrid", page)).toBe(true);
    expect(quoteFound("con sede en Barcelona", page)).toBe(false);
    expect(quoteFound("", page)).toBe(false);
    expect(quoteFound("Madrid", page)).toBe(false); // too short to prove anything
  });
});
