import { describe, expect, it } from "vitest";
import { autoWriteDecision, originOf, personEdit, quoteFound, readSources, sourceText, stampSources } from "./provenance";

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

  it("CA-7: older marks read as a source, unconfirmed; no mark is «sin dato»", () => {
    expect(originOf({ source: "apollo", at: "x" })).toEqual({ kind: "fuente", confirmed: false, detail: "apollo" });
    expect(originOf({ source: "ia", at: "x" })).toMatchObject({ kind: "ia", confirmed: false });
    expect(originOf({ source: "x", at: "x", kind: "bogus" as never })).toMatchObject({ kind: "fuente" });
    expect(originOf(undefined)).toBeNull();
    expect(sourceText(undefined)).toBeNull();
  });

  it("CA-7: the label says who wrote it and whether it is confirmed", () => {
    const at = "2026-10-24T10:00:00Z";
    expect(sourceText({ source: "persona", at })).toMatch(/^Escrito por ti · Confirmado · 24/);
    expect(sourceText({ source: "ia", at })).toMatch(/^Deducido · 24/);
    expect(sourceText({ source: "supuesto", at })).toMatch(/^Supuesto · 24/);
    expect(sourceText({ source: "clay", at, confirmed: true })).toMatch(/^Automático · Clay · Confirmado · 24/);
  });

  it("CA-8: a person's edit marks the value as theirs and confirmed, over an automatic mark", () => {
    const prev = { size: { source: "clay", at: "2026-10-01T00:00:00Z" }, industry: { source: "apollo", at: "2026-10-01T00:00:00Z" } };
    const out = personEdit(prev, { size: "51–200 empleados" }, "2026-10-24T10:00:00Z");
    expect(out.size).toEqual({ source: "persona", kind: "persona", confirmed: true, at: "2026-10-24T10:00:00Z" });
    expect(out.industry?.source).toBe("apollo");
    expect(originOf(out.size)).toMatchObject({ kind: "persona", confirmed: true });
  });

  it("CA-8: a cleared value loses its mark instead of being marked as written by a person", () => {
    const out = personEdit({ size: { source: "clay", at: "x" } }, { size: "  ", country: null }, "2026-10-24T10:00:00Z");
    expect(out).toEqual({});
  });

  it("CA-8, CA-9: an automatic process writes only an empty field and otherwise only proposes", () => {
    expect(autoWriteDecision(null, "Fintech")).toBe("write");
    expect(autoWriteDecision("  ", "Fintech")).toBe("write");
    expect(autoWriteDecision("Logística", "Fintech")).toBe("propose");
    expect(autoWriteDecision("fintech", " Fintech ")).toBe("same");
    expect(autoWriteDecision("Logística", null)).toBe("none");
    expect(autoWriteDecision("Logística", "  ")).toBe("none");
  });
});
