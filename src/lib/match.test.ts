import { describe, expect, it } from "vitest";
import { duplicateOf, findMatches, normName, searchList } from "./match";

const accounts = [
  { id: "1", name: "Acme Logistics S.L.", domain: "acme.com" },
  { id: "2", name: "Banco Santander", domain: "https://www.bancosantander.es/" },
  { id: "3", name: "Típica Cía", domain: null },
];

describe("match", () => {
  it("normalizes accents, case and legal suffixes", () => {
    expect(normName("Acme Logistics, S.L.")).toBe(normName("acme logistics"));
    expect(normName("Típica")).toBe("tipica");
  });
  it("the same domain with or without www counts as the same account", () => {
    expect(duplicateOf({ name: "Otro nombre", domain: "bancosantander.es" }, accounts)?.item.id).toBe("2");
  });
  it("«S.L.» or not, it is the same company", () => {
    expect(duplicateOf({ name: "ACME LOGISTICS" }, accounts)?.kind).toBe("same");
  });
  it("the domain's first word matches the typed name", () => {
    expect(duplicateOf({ name: "Acme" }, accounts)?.item.id).toBe("1");
  });
  it("a small typo is similar, a different company is nothing", () => {
    expect(findMatches({ name: "Banco Santandr" }, accounts)[0]?.kind).toBe("similar");
    expect(duplicateOf({ name: "Telefónica" }, accounts)).toBeNull();
  });
  it("search finds by part of the name or the domain, accent-insensitive", () => {
    expect(searchList("tipica", accounts).map((a) => a.id)).toEqual(["3"]);
    expect(searchList("santander", accounts)[0]?.id).toBe("2");
  });
});
