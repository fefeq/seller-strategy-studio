import { describe, expect, it } from "vitest";
import { formatSpanishDate, parseSpanishDate } from "./dates";

describe("parseSpanishDate", () => {
  it("reads day/month/year, never month/day", () => {
    expect(parseSpanishDate("22/10/2026")).toEqual({ ok: true, iso: "2026-10-22" });
    expect(parseSpanishDate("1-2-2027")).toEqual({ ok: true, iso: "2027-02-01" });
    expect(parseSpanishDate("22.10.26")).toEqual({ ok: true, iso: "2026-10-22" });
    expect(parseSpanishDate("2026-10-22")).toEqual({ ok: true, iso: "2026-10-22" });
  });
  it("empty is no date", () => expect(parseSpanishDate(" ")).toEqual({ ok: true, iso: null }));
  it("refuses impossible dates and years like 22026", () => {
    expect(parseSpanishDate("31/02/2026").ok).toBe(false);
    expect(parseSpanishDate("10/02/22026").ok).toBe(false);
    expect(parseSpanishDate("10/13/2026").ok).toBe(false);
    expect(parseSpanishDate("mañana").ok).toBe(false);
  });
});

describe("formatSpanishDate", () => {
  it("shows ISO dates in Spanish order", () => {
    expect(formatSpanishDate("2026-10-22")).toBe("22/10/2026");
    expect(formatSpanishDate(null)).toBe("");
  });
});
