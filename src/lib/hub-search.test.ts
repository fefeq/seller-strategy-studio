// SDD-20261106-hub-search, U-2 · CA-4, CA-6, CA-7, CA-9: the pure rules of the Conocimiento search box. Fictional data.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanQuery,
  emptySearchText,
  nextSearch,
  sectionCounts,
  truncatedNotice,
} from "./hub-search";
import { searchDocs } from "./text-search";

const SECTIONS = ["company", "objections", "playbooks"] as const;
const doc = (id: string, section: string, title: string, body = "") => ({
  id,
  section,
  title,
  body,
});

describe("cleanQuery (CA-6)", () => {
  it("drops an empty or blank q and anything that is not text", () => {
    expect(cleanQuery("")).toBeUndefined();
    expect(cleanQuery("   ")).toBeUndefined();
    expect(cleanQuery(undefined)).toBeUndefined();
    expect(cleanQuery(42)).toBeUndefined();
    expect(cleanQuery(["a"])).toBeUndefined();
  });
  it("never trims a q that has text, so «foo » and «decision ventas» can be typed", () => {
    expect(cleanQuery("foo ")).toBe("foo ");
    expect(cleanQuery(" foo")).toBe(" foo");
    expect(cleanQuery("decision ventas")).toBe("decision ventas");
  });
});

describe("nextSearch (CA-6, CA-7)", () => {
  it("sets q and keeps doc and seccion", () => {
    expect(nextSearch({ doc: "d1", seccion: "rules" }, "precio")).toEqual({
      doc: "d1",
      seccion: "rules",
      q: "precio",
    });
  });
  it("replaces an older q", () => {
    expect(nextSearch({ doc: "d1", q: "ant" }, "nuevo")).toEqual({ doc: "d1", q: "nuevo" });
  });
  it("clearing removes q without touching doc (CA-7)", () => {
    const next = nextSearch({ doc: "d1", q: "ant" }, "");
    expect(next).toEqual({ doc: "d1" });
    expect("q" in next).toBe(false);
  });
  it("a blank text also removes q", () => {
    expect("q" in nextSearch({ q: "x" }, "  ")).toBe(false);
  });
  it("does not mutate the previous search", () => {
    const prev = { doc: "d1", q: "x" };
    nextSearch(prev, "");
    expect(prev).toEqual({ doc: "d1", q: "x" });
  });
});

describe("sectionCounts (CA-4)", () => {
  const docs = [
    doc("1", "company", "Decisión"),
    doc("2", "company", "Otro"),
    doc("3", "objections", "x", "la decision"),
    doc("4", "playbooks", "Nada"),
  ];
  it("without a search it is the total of documents per section", () => {
    expect(sectionCounts(SECTIONS, docs, null)).toEqual({
      company: 2,
      objections: 1,
      playbooks: 1,
    });
  });
  it("with a search it is the matches per section, zero where none", () => {
    expect(sectionCounts(SECTIONS, docs, searchDocs(docs, "decision"))).toEqual({
      company: 1,
      objections: 1,
      playbooks: 0,
    });
  });
  it("a search with no results counts zero everywhere", () => {
    expect(sectionCounts(SECTIONS, docs, searchDocs(docs, "zzz"))).toEqual({
      company: 0,
      objections: 0,
      playbooks: 0,
    });
  });
  it("documents of an unknown section are not counted", () => {
    expect(sectionCounts(SECTIONS, [doc("9", "otra", "t")], null)).toEqual({
      company: 0,
      objections: 0,
      playbooks: 0,
    });
  });
});

describe("texts (CA-5, CA-9)", () => {
  it("truncation notice", () => {
    expect(truncatedNotice(20000)).toBe(
      "Se muestran los primeros 20000 documentos; la búsqueda no incluye el resto.",
    );
  });
  it("empty search", () => {
    expect(emptySearchText("precio")).toBe(
      "Nada coincide con «precio». Prueba con otra palabra o crea un documento con «+ Nuevo».",
    );
    expect(emptySearchText(" precio ")).toBe(
      "Nada coincide con «precio». Prueba con otra palabra o crea un documento con «+ Nuevo».",
    );
  });
});

describe("route stays thin (CA-0, CA-6)", () => {
  const route = readFileSync(path.resolve(__dirname, "../routes/_authenticated/hub.tsx"), "utf8");
  it("only holds validateSearch, head and component: HubScreen, and drops a blank q through cleanQuery", () => {
    expect(route).toContain("component: HubScreen");
    expect(route).toContain("validateSearch");
    expect(route).toContain("cleanQuery(s.q)");
    expect(route).not.toMatch(/useQuery|supabase|useState/);
  });
});
