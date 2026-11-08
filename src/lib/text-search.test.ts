// SDD-20261106-hub-search, U-1 · CA-1, CA-2, CA-3, CA-8: one accent- and case-insensitive fold and a literal document search
// with a fragment cut on grapheme borders. Fictional data.
import { describe, expect, it } from "vitest";
import { foldText, searchDocs } from "./text-search";

type D = { id: string; section: string; title: string; body: string };
const doc = (id: string, title: string, body = "", section = "company"): D => ({
  id,
  section,
  title,
  body,
});
const graphemes = (s: string) =>
  [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].map((x) => x.segment);
const bare = (s: string) => s.replace(/^…/, "").replace(/…$/, "");
const ids = (r: { doc: { id: string } }[]) => r.map((x) => x.doc.id);

describe("foldText (CA-8)", () => {
  it("returns an empty string for null and undefined", () => {
    expect(foldText(null)).toBe("");
    expect(foldText(undefined)).toBe("");
  });
  it("drops accents and case, also from already decomposed text", () => {
    expect(foldText("Decisión")).toBe("decision");
    expect(foldText("Decisio\u0301n")).toBe("decision");
    expect(foldText("ÁÉÍ")).toBe("aei");
  });
  it("keeps today's behaviour for ñ (CA-8, decided 2026-11-06): año folds to ano", () => {
    expect(foldText("Año")).toBe("ano");
  });
});

describe("searchDocs · matching (CA-1)", () => {
  const docs = [
    doc("a", "Decisión de compra", "texto", "playbooks"),
    doc("b", "Otro", "La DECISION final es del comprador", "objections"),
    doc("c", "Sin relación", "nada que ver", "rules"),
  ];
  it("finds in title or content of any section, ignoring case and accents", () => {
    expect(ids(searchDocs(docs, "decision"))).toEqual(["a", "b"]);
    expect(ids(searchDocs(docs, "DECISIÓN"))).toEqual(["a", "b"]);
    expect(ids(searchDocs(docs, "decisio\u0301n"))).toEqual(["a", "b"]);
  });
  it("matches literally, never as a regular expression", () => {
    const d = [
      doc("1", "Guía de C++", ""),
      doc("2", "Guía de C", "sin plus"),
      doc("3", "Notas", "versión (beta) abierta"),
      doc("4", "Notas", "versión beta abierta"),
    ];
    expect(ids(searchDocs(d, "C++"))).toEqual(["1"]);
    expect(ids(searchDocs(d, "(beta)"))).toEqual(["3"]);
    expect(ids(searchDocs(d, ".*"))).toEqual([]);
  });
  it("a blank query is no search", () => {
    expect(searchDocs(docs, "")).toEqual([]);
    expect(searchDocs(docs, "   ")).toEqual([]);
  });
  it("a one-character query searches", () => {
    expect(ids(searchDocs([doc("1", "zeta"), doc("2", "alfa")], "z"))).toEqual(["1"]);
  });
  it("edge spaces of the query are ignored, inner ones count", () => {
    const d = [doc("1", "plan de ventas")];
    expect(ids(searchDocs(d, " plan "))).toEqual(["1"]);
    expect(ids(searchDocs(d, "plan de"))).toEqual(["1"]);
    expect(ids(searchDocs(d, "plan  de"))).toEqual([]);
  });
});

describe("searchDocs · order and section (CA-2, CA-3)", () => {
  it("title matches go before content-only matches; each group keeps the reading order", () => {
    const d = [
      doc("1", "x", "precio"),
      doc("2", "Precio base"),
      doc("3", "y", "el precio"),
      doc("4", "Lista de precios"),
    ];
    const r = searchDocs(d, "precio");
    expect(ids(r)).toEqual(["2", "4", "1", "3"]);
    expect(r.map((x) => x.inTitle)).toEqual([true, true, false, false]);
  });
  it("every result carries its section id; no fragment when the title matches", () => {
    const r = searchDocs(
      [doc("1", "Precio", "precio también aquí", "objections"), doc("2", "z", "precio", "rules")],
      "precio",
    );
    expect(r.map((x) => x.section)).toEqual(["objections", "rules"]);
    expect(r[0]?.snippet).toBeNull();
    expect(r[1]?.snippet).toBe("precio");
  });
});

describe("searchDocs · fragment (CA-3)", () => {
  it("returns the original text, not the folded one, even when the source is decomposed", () => {
    const r = searchDocs([doc("1", "t", "Decisio\u0301n")], "decision");
    expect(r[0]?.snippet).toBe("Decisio\u0301n");
  });
  it("cuts at most 120 graphemes around the match, with an ellipsis on each cut end that is not counted", () => {
    const body = `${"a".repeat(200)} NEEDLE ${"b".repeat(200)}`;
    const s = searchDocs([doc("1", "t", body)], "needle")[0]?.snippet ?? "";
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(graphemes(bare(s)).length).toBe(120);
    expect(s).toContain("NEEDLE");
  });
  it("no ellipsis where the text is not cut: match at the start and at the very end", () => {
    const start =
      searchDocs([doc("1", "t", `needle ${"b".repeat(300)}`)], "needle")[0]?.snippet ?? "";
    expect(start.startsWith("…")).toBe(false);
    expect(start.endsWith("…")).toBe(true);
    expect(graphemes(bare(start)).length).toBe(120);
    const end =
      searchDocs([doc("1", "t", `${"b".repeat(300)} needle`)], "needle")[0]?.snippet ?? "";
    expect(end.startsWith("…")).toBe(true);
    expect(end.endsWith("…")).toBe(false);
    expect(end.endsWith("needle")).toBe(true);
    expect(graphemes(bare(end)).length).toBe(120);
  });
  it("a short text comes back whole", () => {
    expect(searchDocs([doc("1", "t", "uno dos tres")], "dos")[0]?.snippet).toBe("uno dos tres");
  });
  it("Hangul: finds and cuts the original syllables", () => {
    const body = `${"가".repeat(150)}한국어${"나".repeat(150)}`;
    const s = searchDocs([doc("1", "t", body)], "한국어")[0]?.snippet ?? "";
    expect(s).toContain("한국어");
    expect(graphemes(bare(s)).length).toBe(120);
    expect(s).not.toMatch(/[\u1100-\u11ff]/); // original syllables, never jamo
  });
  it("a partial Hangul match keeps the whole syllable", () => {
    const s = searchDocs([doc("1", "t", "안녕 한국")], "\u1112\u1161")[0]?.snippet; // jamo for «하»
    expect(s).toBe("안녕 한국");
  });
  it("never splits a ZWJ emoji at the border: whole inside or whole outside", () => {
    const emoji = "👩‍💻";
    let inside = 0;
    let outside = 0;
    for (let gap = 50; gap < 70; gap++) {
      const body = `${"b".repeat(100)}${emoji}${"b".repeat(gap)}X${"c".repeat(100)}`;
      const s = bare(searchDocs([doc("1", "t", body)], "x")[0]?.snippet ?? "");
      expect(graphemes(s).length).toBeLessThanOrEqual(120);
      const rest = s.split(emoji).join("");
      expect(rest).not.toMatch(/[\u{1F469}\u{1F4BB}‍]/u);
      if (s.includes(emoji)) inside++;
      else outside++;
    }
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
  });
  it("never splits a letter from its combining mark at the border", () => {
    const e = "e\u0301";
    let inside = 0;
    let outside = 0;
    for (let gap = 50; gap < 70; gap++) {
      const body = `${"b".repeat(100)}${e}${"b".repeat(gap)}X${"c".repeat(100)}`;
      const s = bare(searchDocs([doc("1", "t", body)], "x")[0]?.snippet ?? "");
      expect(s.split(e).join("")).not.toMatch(/\u0301/);
      if (s.includes(e)) inside++;
      else outside++;
    }
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
  });
  it("a match that is part of a grapheme widens to the whole grapheme", () => {
    const s = searchDocs([doc("1", "t", "xx e\u0301 yy")], "e")[0]?.snippet;
    expect(s).toBe("xx e\u0301 yy");
  });
  it("a match longer than the limit is cut to 120 graphemes", () => {
    const q = "w".repeat(150);
    const s = searchDocs([doc("1", "t", `${q}z`)], q)[0]?.snippet ?? "";
    expect(graphemes(bare(s)).length).toBe(120);
  });
});
