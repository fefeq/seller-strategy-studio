import { readFileSync } from "node:fs";
import path from "node:path";
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
    expect(
      duplicateOf({ name: "Otro nombre", domain: "bancosantander.es" }, accounts)?.item.id,
    ).toBe("2");
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

describe("markKnown", () => {
  it("flags a result whose name is an existing account even without domain, leaves new ones alone", async () => {
    const { markKnown } = await import("./match");
    const out = markKnown<{ name: string; domain: string | null; existingId?: string | null }>(
      [
        { name: "ACME Logistics", domain: null },
        { name: "Nueva Co", domain: "nueva.io" },
      ],
      accounts,
    );
    expect(out[0]?.existingId).toBe("1");
    expect(out[1]?.existingId).toBeUndefined();
  });
});

// SDD-20261106-hub-search, U-1 · CA-8: the fold is shared with Conocimiento; null fields and decomposed text behave.
describe("searchList with null fields and decomposed text (CA-8)", () => {
  const list = [
    { id: "n1", name: "Sin datos", domain: null, sub: null },
    { id: "n2", name: "Decisio\u0301n Group", domain: undefined, sub: undefined },
  ];
  it("null domain and sub never throw and never match", () => {
    expect(searchList("zzz", list).map((a) => a.id)).toEqual([]);
    expect(searchList("sin datos", list)[0]?.id).toBe("n1");
  });
  it("already decomposed names match the plain query", () => {
    expect(searchList("decision", list)[0]?.id).toBe("n2");
    expect(searchList("DECISIÓN", list)[0]?.id).toBe("n2");
  });
});

describe("source guard (CA-8)", () => {
  it("searchList in match.ts folds only through foldText from text-search.ts, with no copy of the normalization", () => {
    const src = readFileSync(path.resolve(__dirname, "match.ts"), "utf8");
    expect(src).toMatch(/import \{[^}]*\bfoldText\b[^}]*\} from "@\/lib\/text-search"/);
    const searchListSrc = src.slice(
      src.indexOf("export function searchList"),
      src.indexOf("export function markKnown"),
    );
    expect(searchListSrc).toContain("foldText(");
    expect(searchListSrc).not.toMatch(/normalize\(/);
  });
});
