import { describe, expect, it } from "vitest";
import {
  autoWriteDecision,
  dropSources,
  originOf,
  personEdit,
  quoteFound,
  readSources,
  sourceText,
  stampConfirmed,
  stampSources,
  stampUnconfirmed,
  keepUnreadable,
} from "./provenance";

describe("provenance", () => {
  it("stamps filled fields and keeps the other marks", () => {
    const out = stampSources(
      { size: { source: "clay", at: "2026-10-01T00:00:00Z" } },
      [{ field: "industry", source: "apollo" }],
      "2026-10-24T10:00:00Z",
    );
    expect(out.industry).toEqual({ source: "apollo", at: "2026-10-24T10:00:00Z" });
    expect(out.size?.source).toBe("clay");
  });
  it("ignores malformed rows", () => {
    expect(readSources({ a: 1, b: { source: "web", at: "x" } })).toEqual({
      b: { source: "web", at: "x" },
    });
    expect(readSources(null)).toEqual({});
  });
  it("labels the web source", () => {
    expect(sourceText({ source: "web", at: "2026-10-24T10:00:00Z" })).toMatch(
      /^Automático · Web de la empresa · 24/,
    );
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
    expect(originOf({ source: "apollo", at: "x" })).toEqual({
      kind: "fuente",
      confirmed: false,
      detail: "apollo",
    });
    expect(originOf({ source: "ia", at: "x" })).toMatchObject({ kind: "ia", confirmed: false });
    expect(originOf({ source: "x", at: "x", kind: "bogus" as never })).toMatchObject({
      kind: "fuente",
    });
    expect(originOf(undefined)).toBeNull();
    expect(sourceText(undefined)).toBeNull();
  });

  it("CA-7: the label says who wrote it and whether it is confirmed", () => {
    const at = "2026-10-24T10:00:00Z";
    expect(sourceText({ source: "persona", at })).toMatch(/^Escrito por ti · Confirmado · 24/);
    expect(sourceText({ source: "ia", at })).toMatch(/^Deducido · 24/);
    expect(sourceText({ source: "supuesto", at })).toMatch(/^Supuesto · 24/);
    expect(sourceText({ source: "clay", at, confirmed: true })).toMatch(
      /^Automático · Clay · Confirmado · 24/,
    );
  });

  it("CA-8: a person's edit marks the value as theirs and confirmed, over an automatic mark", () => {
    const prev = {
      size: { source: "clay", at: "2026-10-01T00:00:00Z" },
      industry: { source: "apollo", at: "2026-10-01T00:00:00Z" },
    };
    const out = personEdit(prev, { size: "51–200 empleados" }, "2026-10-24T10:00:00Z");
    expect(out.size).toEqual({
      source: "persona",
      kind: "persona",
      confirmed: true,
      at: "2026-10-24T10:00:00Z",
    });
    expect(out.industry?.source).toBe("apollo");
    expect(originOf(out.size)).toMatchObject({ kind: "persona", confirmed: true });
  });

  it("CA-8: a cleared value loses its mark instead of being marked as written by a person", () => {
    const out = personEdit(
      { size: { source: "clay", at: "x" } },
      { size: "  ", country: null },
      "2026-10-24T10:00:00Z",
    );
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

  describe("U-1 writer marks (NK-0022, CA-3, CA-10)", () => {
    const prev = {
      industry: {
        source: "persona",
        kind: "persona",
        confirmed: true,
        confirmedBy: "u0",
        at: "2026-10-01T00:00:00Z",
        confirmedAt: "2026-10-01T00:00:00Z",
      },
      size: { source: "clay", at: "2026-10-02T00:00:00Z" },
    } as const;
    const AT = "2026-10-28T10:00:00Z";

    it("stampConfirmed keeps the origin and adds who confirmed and when; the other marks stay", () => {
      const out = stampConfirmed(prev, [{ field: "country", source: "apollo" }], "u1", AT);
      expect(out.country).toEqual({
        source: "apollo",
        kind: "fuente",
        at: AT,
        confirmed: true,
        confirmedBy: "u1",
        confirmedAt: AT,
      });
      expect(out.industry).toEqual(prev.industry);
      expect(out.size).toEqual(prev.size);
    });
    it("a changed field never keeps the old mark and the result differs from the previous one", () => {
      const out = stampConfirmed(prev, [{ field: "industry", source: "ia" }], "u1", AT);
      expect(out.industry).toMatchObject({
        source: "ia",
        kind: "ia",
        confirmed: true,
        confirmedBy: "u1",
        at: AT,
      });
      expect(out).not.toEqual(readSources(prev));
    });
    it("never produces a person mark from a provider or from AI", () => {
      for (const source of ["ia", "apollo", "clay", "parallel", "web"]) {
        const m = stampConfirmed({}, [{ field: "notes", source }], "u1", AT).notes;
        expect(originOf(m)?.kind).not.toBe("persona");
        expect(m?.source).toBe(source);
      }
    });
    it("stampUnconfirmed marks the origin as not confirmed, with no confirmer", () => {
      const out = stampUnconfirmed(prev, [{ field: "country", source: "web" }], AT);
      expect(out.country).toEqual({ source: "web", kind: "fuente", at: AT, confirmed: false });
      expect(out.country).not.toHaveProperty("confirmedBy");
      expect(out.industry).toEqual(prev.industry);
    });
    it("an unconfirmed Parallel mark on a field with no mark makes field_sources differ from the previous one (what U-2 relies on for «notes» alone)", () => {
      const out = stampUnconfirmed({}, [{ field: "notes", source: "parallel" }], AT);
      expect(out).not.toEqual({});
      expect(out.notes).toEqual({ source: "parallel", kind: "fuente", at: AT, confirmed: false });
      expect(sourceText(out.notes)).toMatch(/^Automático · Parallel/);
    });
    it("dropSources removes only the cleared fields and starts from what was read", () => {
      const out = dropSources(prev, ["industry", "country"]);
      expect(out).toEqual({ size: prev.size });
      expect(dropSources(null, ["industry"])).toEqual({});
    });
    it("labels Parallel", () => {
      expect(sourceText({ source: "parallel", at: AT })).toMatch(/^Automático · Parallel · 28/);
    });
    it("keepUnreadable keeps what readSources would drop and removes cleared fields", () => {
      const prev = {
        industry: { source: "apollo" },
        size: { source: "clay", at: AT },
        notes: "text",
        country: { source: "web", at: AT },
      };
      const out = keepUnreadable(
        prev,
        stampConfirmed(prev, [{ field: "size", source: "ia" }], "u1", AT),
        ["country"],
      );
      expect(out.industry).toEqual({ source: "apollo" });
      expect(out.notes).toBe("text");
      expect(out.size).toMatchObject({ source: "ia", confirmedBy: "u1" });
      expect(out).not.toHaveProperty("country");
      expect(keepUnreadable(null, {})).toEqual({});
    });
  });
});
