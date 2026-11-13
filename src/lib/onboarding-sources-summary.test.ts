// NK-0156 CA-5, CA-6: summarizeSources shares the rule of findingsDependingOn; a web source carries no count.
import { describe, expect, it } from "vitest";
import type { Finding } from "./onboarding";
import { findingsDependingOn, removeSource, summarizeSources } from "./onboarding-sources";

const finding = (text: string, source: string | null, extra: Partial<Finding> = {}): Finding => ({
  at: "2026-11-12T10:00:00Z",
  text,
  source,
  ...extra,
});

describe("summarizeSources agrees with findingsDependingOn", () => {
  it("returns one entry per source, in order, with the same indexes as the shared rule", () => {
    const sources = ["data.md", "a.md", "Texto pegado", "Web · https://acme.test"];
    const findings = [
      finding("Uno", "a.md"),
      finding("Dos", "data.md"),
      finding("Tres", null),
      finding("Cuatro", "Texto pegado", { discardedAt: "2026-11-12T11:00:00Z" }),
      finding("Cinco", "Web · acme.test"),
    ];
    const out = summarizeSources(sources, findings);
    expect(out.map((x) => x.source)).toEqual(sources);
    for (const x of out) expect(x.indexes).toEqual(findingsDependingOn(x.source, findings));
    expect(out.map((x) => x.indexes)).toEqual([[1], [0, 1], [], [4]]);
    expect(out.map((x) => x.count)).toEqual([1, 2, 0, null]);
  });

  it("a non-web source with an empty core counts 0", () => {
    expect(summarizeSources(["   "], [finding("Uno", "a.md")])).toEqual([
      { source: "   ", indexes: [], count: 0 },
    ]);
  });

  it("a web source with an empty URL has no count (the web rule wins over the empty core)", () => {
    expect(summarizeSources(["Web ·   "], [finding("Uno", "a.md")])).toEqual([
      { source: "Web ·   ", indexes: [], count: null },
    ]);
  });

  it("a finding kept with sourceRemoved still counts for another source that matches", () => {
    const findings = [finding("Uno", "a.md", { sourceRemoved: true })];
    const [x] = summarizeSources(["a.md"], findings);
    expect(x).toEqual({ source: "a.md", indexes: [0], count: 1 });
  });

  it("a.md also counts the finding of data.md, and removing a.md marks both as sourceRemoved", () => {
    const findings = [finding("Uno", "a.md"), finding("Dos", "data.md")];
    const out = summarizeSources(["a.md", "data.md"], findings);
    expect(out.map((x) => x.indexes)).toEqual([[0, 1], [1]]);
    const next = removeSource({ sources: ["a.md", "data.md"], findings }, "a.md", "keep", "now");
    expect(next.findings.map((f) => f.sourceRemoved)).toEqual([true, true]);
  });
});

describe("summarizeSources cases", () => {
  it("a web source matches the finding that names the host, and has no count", () => {
    const [x] = summarizeSources(["Web · https://acme.test"], [finding("Uno", "Web · acme.test")]);
    expect(x).toEqual({ source: "Web · https://acme.test", indexes: [0], count: null });
  });

  it("the three web shapes all return count null though the indexes differ", () => {
    const out = summarizeSources(
      [
        "Web · https://acme.test",
        "Web · https://acme.test/precios",
        "Web · https://www.linkedin.com/company/ejemplo",
      ],
      [finding("Uno", "Web · acme.test")],
    );
    expect(out.map((x) => x.indexes)).toEqual([[0], [], []]);
    expect(out.map((x) => x.count)).toEqual([null, null, null]);
  });

  it("a finding whose source is «Web · precios» counts for no web source", () => {
    const out = summarizeSources(
      ["Web · https://acme.test", "Web · https://acme.test/precios"],
      [finding("Uno", "Web · precios")],
    );
    expect(out.map((x) => x.indexes)).toEqual([[], []]);
  });

  it("«plan.pdf (Drive)» counts «Plan.pdf»", () => {
    const [x] = summarizeSources(["plan.pdf (Drive)"], [finding("Uno", "Plan.pdf")]);
    expect(x).toEqual({ source: "plan.pdf (Drive)", indexes: [0], count: 1 });
  });

  it("a discarded finding does not count", () => {
    const [x] = summarizeSources(
      ["a.md"],
      [finding("Uno", "a.md", { discardedAt: "2026-11-12T11:00:00Z" })],
    );
    expect(x).toEqual({ source: "a.md", indexes: [], count: 0 });
  });

  it("«Tus fuentes» and «Supuesto de Nokko» count for no concrete source", () => {
    const out = summarizeSources(
      ["a.md", "Texto pegado"],
      [finding("Uno", "Tus fuentes"), finding("Dos", "Supuesto de Nokko")],
    );
    expect(out.map((x) => x.indexes)).toEqual([[], []]);
  });

  it("a free source that mentions two sources counts for both", () => {
    const out = summarizeSources(["a.md", "plan.md"], [finding("Uno", "a.md y plan.md")]);
    expect(out.map((x) => x.indexes)).toEqual([[0], [0]]);
  });

  it("the substring goes one way: a.md counts data.md's finding, data.md does not count a.md's", () => {
    const findings = [finding("Uno", "a.md"), finding("Dos", "data.md")];
    expect(findingsDependingOn("a.md", findings)).toEqual([0, 1]);
    expect(findingsDependingOn("data.md", findings)).toEqual([1]);
    expect(summarizeSources(["data.md"], findings)[0]!.indexes).toEqual([1]);
  });

  it("«Texto pegado» counts the «Texto pegado» finding", () => {
    const [x] = summarizeSources(["Texto pegado"], [finding("Uno", "Texto pegado")]);
    expect(x).toEqual({ source: "Texto pegado", indexes: [0], count: 1 });
  });

  it("«Leído: plan.md» with source «plan.md» counts for plan.md", () => {
    const [x] = summarizeSources(["plan.md"], [finding("Leído: plan.md", "plan.md")]);
    expect(x).toEqual({ source: "plan.md", indexes: [0], count: 1 });
  });
});
