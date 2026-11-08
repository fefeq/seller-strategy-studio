// SDD-20261106-ux-core-screens-pattern, U-4 · CA-3: section ids of Conocimiento and Theory U in the URL, how an id is validated,
// and the search after a person changes section (doc out, q kept, the default section is not written).
import { describe, expect, it } from "vitest";
import {
  HUB_DEFAULT_SECTION,
  HUB_SECTIONS,
  THEORY_U_DEFAULT_SECTION,
  THEORY_U_SECTIONS,
  nextSearchOnSectionChange,
  searchWithSection,
  sectionOf,
  validSection,
} from "@/lib/screen-sections";

describe("ids (SDD §7 CA-3)", () => {
  it("Conocimiento: the section values of knowledge_docs plus drive", () => {
    expect([...HUB_SECTIONS]).toEqual([
      "company",
      "objections",
      "playbooks",
      "methodology",
      "campaigns",
      "skills",
      "rules",
      "drive",
    ]);
    expect(HUB_DEFAULT_SECTION).toBe("company");
  });
  it("Theory U: the five tab values", () => {
    expect([...THEORY_U_SECTIONS]).toEqual([
      "journey",
      "sensing",
      "listening",
      "clinic",
      "prototypes",
    ]);
    expect(THEORY_U_DEFAULT_SECTION).toBe("journey");
  });
});

describe("validSection / sectionOf", () => {
  it("accepts a known id", () => {
    expect(validSection(HUB_SECTIONS, "rules")).toBe("rules");
    expect(validSection(THEORY_U_SECTIONS, "clinic")).toBe("clinic");
  });
  it("drops an unknown id, another screen's id, a non-string and nothing", () => {
    expect(validSection(HUB_SECTIONS, "nope")).toBeUndefined();
    expect(validSection(HUB_SECTIONS, "journey")).toBeUndefined();
    expect(validSection(HUB_SECTIONS, 3)).toBeUndefined();
    expect(validSection(HUB_SECTIONS, undefined)).toBeUndefined();
  });
  it("opens the default for an unknown or missing id", () => {
    expect(sectionOf(HUB_SECTIONS, HUB_DEFAULT_SECTION, "nope")).toBe("company");
    expect(sectionOf(HUB_SECTIONS, HUB_DEFAULT_SECTION, undefined)).toBe("company");
    expect(sectionOf(THEORY_U_SECTIONS, THEORY_U_DEFAULT_SECTION, "nope")).toBe("journey");
    expect(sectionOf(THEORY_U_SECTIONS, THEORY_U_DEFAULT_SECTION, "listening")).toBe("listening");
  });
});

describe("next search", () => {
  it("a manual change drops doc, keeps q and writes the section", () => {
    expect(
      nextSearchOnSectionChange(
        { doc: "d1", q: "precio", seccion: "rules" },
        "playbooks",
        "company",
      ),
    ).toEqual({
      q: "precio",
      seccion: "playbooks",
    });
  });
  it("going to the default section removes seccion (and doc), keeps q", () => {
    expect(
      nextSearchOnSectionChange({ doc: "d1", q: "precio", seccion: "rules" }, "company", "company"),
    ).toEqual({
      q: "precio",
    });
    expect(nextSearchOnSectionChange({ seccion: "sensing" }, "journey", "journey")).toEqual({});
  });
  it("opening a document keeps doc and q and sets the section of that document", () => {
    expect(searchWithSection({ doc: "d4", q: "x" }, "objections", "company")).toEqual({
      doc: "d4",
      q: "x",
      seccion: "objections",
    });
    expect(searchWithSection({ doc: "d4", seccion: "rules" }, "company", "company")).toEqual({
      doc: "d4",
    });
  });
  it("does not mutate the previous search", () => {
    const prev = { doc: "d1", seccion: "rules" };
    nextSearchOnSectionChange(prev, "skills", "company");
    expect(prev).toEqual({ doc: "d1", seccion: "rules" });
  });
});
