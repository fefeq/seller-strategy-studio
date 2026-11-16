import { describe, expect, it } from "vitest";
import type { Finding } from "./onboarding";
import {
  canRestore,
  confirmFinding,
  discardFinding,
  editFinding,
  findingsDependingOn,
  mergeFiles,
  removeFileText,
  removeSource,
  restoreFinding,
  sourceCore,
} from "./onboarding-sources";

const f = (name: string) => ({ filename: name, dataUrl: `data:${name}` });
const finding = (text: string, source: string | null): Finding => ({
  at: "2026-10-26T10:00:00Z",
  text,
  source,
});

describe("onboarding sources", () => {
  it("CA-12: adding files keeps the ones already listed", () => {
    const first = mergeFiles([], [f("plan.pdf"), f("pyl.pdf")]);
    const second = mergeFiles(first.files, [f("deck.pdf")]);
    expect(second.files.map((x) => x.filename)).toEqual(["plan.pdf", "pyl.pdf", "deck.pdf"]);
    expect(second.dropped).toEqual([]);
  });

  it("CA-12: a file with the same name replaces the older one; the cap says what it left out", () => {
    const a = mergeFiles([f("a.pdf")], [{ filename: "a.pdf", dataUrl: "new" }]);
    expect(a.files).toEqual([{ filename: "a.pdf", dataUrl: "new" }]);
    const full = mergeFiles([f("1"), f("2")], [f("3"), f("4")], 3);
    expect(full.files.map((x) => x.filename)).toEqual(["1", "2", "3"]);
    expect(full.dropped).toEqual(["4"]);
  });

  it("removing a text file takes out its block and nothing else", () => {
    const text = "intro\n\n--- a.md ---\nuno\n\n--- b.md ---\ndos";
    expect(removeFileText(text, "a.md")).toBe("intro\n\n--- b.md ---\ndos");
    expect(removeFileText(text, "b.md")).toBe("intro\n\n--- a.md ---\nuno");
    expect(removeFileText(text, "b.md (Drive)")).toBe("intro\n\n--- a.md ---\nuno");
    expect(removeFileText(text, "c.md")).toBe(text);
  });

  it("the core of a source is what a finding would mention", () => {
    expect(sourceCore("Web · https://www.acme.com/")).toBe("acme.com");
    expect(sourceCore("Plan.pdf (Drive)")).toBe("plan.pdf");
    expect(sourceCore("Texto pegado")).toBe("texto pegado");
  });

  it("CA-11: it says which findings depend on a source; a generic source depends on none", () => {
    const xs = [
      finding("Categoría: CRM", "acme.com"),
      finding("ICP", "Plan.pdf"),
      finding("Cuota", "Tus fuentes"),
      finding("Otro", null),
    ];
    expect(findingsDependingOn("Web · https://acme.com", xs)).toEqual([0]);
    expect(findingsDependingOn("Plan.pdf", xs)).toEqual([1]);
    expect(findingsDependingOn("Tus fuentes", xs)).toEqual([2]);
    expect(findingsDependingOn("   ", xs)).toEqual([]);
  });

  it("CA-11: removing a source keeps its findings marked, or discards them", () => {
    const state = {
      sources: ["Web · https://acme.com", "Plan.pdf"],
      findings: [finding("A", "acme.com"), finding("B", "Plan.pdf")],
    };
    const keep = removeSource(state, "Web · https://acme.com", "keep", "2026-10-26T11:00:00Z");
    expect(keep.sources).toEqual(["Plan.pdf"]);
    expect(keep.findings[0]).toMatchObject({ text: "A", sourceRemoved: true });
    expect(keep.findings[0]!.discardedAt).toBeUndefined();
    const drop = removeSource(state, "Web · https://acme.com", "discard", "2026-10-26T11:00:00Z");
    expect(drop.findings[0]!.discardedAt).toBe("2026-10-26T11:00:00Z");
    expect(drop.findings[1]).toEqual(state.findings[1]);
  });

  it("CA-8: confirming a finding records who and when", () => {
    const out = confirmFinding([finding("A", null)], 0, "u1", "2026-10-26T11:00:00Z");
    expect(out[0]).toMatchObject({ confirmedBy: "u1", confirmedAt: "2026-10-26T11:00:00Z" });
  });

  it("CA-1, CA-2: editing a finding saves it as confirmed by the person; an empty text is refused", () => {
    const out = editFinding(
      [finding("A", "x")],
      0,
      "  Categoría: ventas ",
      "u1",
      "2026-10-26T11:00:00Z",
    )!;
    expect(out[0]).toMatchObject({
      text: "Categoría: ventas",
      edited: true,
      confirmedBy: "u1",
      source: "x",
    });
    expect(editFinding([finding("A", null)], 0, "   ", "u1", "x")).toBeNull();
  });

  it("CA-5: a discarded finding can come back for 24 hours, then not", () => {
    const gone = discardFinding([finding("A", null)], 0, "2026-10-26T10:00:00Z")[0]!;
    expect(canRestore(gone, new Date("2026-10-27T09:59:00Z"))).toBe(true);
    expect(canRestore(gone, new Date("2026-10-27T10:01:00Z"))).toBe(false);
    expect(canRestore(finding("B", null), new Date())).toBe(false);
    expect(restoreFinding([gone], 0)[0]!.discardedAt).toBeUndefined();
  });
});
