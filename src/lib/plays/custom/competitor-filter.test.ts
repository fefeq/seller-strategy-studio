import { describe, expect, it } from "vitest";
import { competitorQuery, namesCompetitor } from "./library";

describe("R-1 only counts signals that name a declared competitor", () => {
  it("rejects generic end-of-support news (Talpio false positive, 14-11-2026)", () => {
    expect(namesCompetitor({ title: "Microsoft cierra el soporte de Windows 11 23H2", snippet: "fin de soporte", url: "https://geekzilla.tech/x" }, ["Talpio"])).toBe(false);
    expect(namesCompetitor({ title: "LibreOffice 26.2 pierde soporte", url: "https://www.linuxadictos.com/y" }, ["Talpio"])).toBe(false);
  });
  it("accepts a signal naming the competitor in title, snippet or URL, ignoring case and accents", () => {
    expect(namesCompetitor({ title: "TALPIO retira su plan Basic" }, ["Talpio"])).toBe(true);
    expect(namesCompetitor({ snippet: "según Tálpio, el producto…" }, ["Talpio"])).toBe(true);
    expect(namesCompetitor({ url: "https://talpio.com/changelog" }, ["Talpio"])).toBe(true);
  });
  it("needs a whole word, not a substring", () => {
    expect(namesCompetitor({ title: "Talpiontech lanza algo" }, ["Talpio"])).toBe(false);
  });
  it("puts the competitor names in quotes in the query", () => {
    expect(competitorQuery("fin de soporte", ["Talpio", "Acme"])).toBe('"Talpio" OR "Acme" fin de soporte');
    expect(competitorQuery("fin de soporte", [])).toBe("fin de soporte");
  });
});
