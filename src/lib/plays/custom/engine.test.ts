import { describe, expect, it } from "vitest";
import { mergeTagged, signalDate, runPlay, type TaggedItem } from "./engine";
import type { Step } from "./model";

const NOW = new Date("2026-11-13T00:00:00Z");
const item = (p: Partial<TaggedItem>): TaggedItem => ({
  title: "t",
  url: "https://a.com/1",
  snippet: "s",
  date: null,
  source: "a.com",
  provider: "firecrawl",
  ...p,
});

describe("q-6: every result keeps its real provider", () => {
  it("merges without duplicates and keeps the first provider of a url", () => {
    const out = mergeTagged(
      [
        [item({ provider: "firecrawl" })],
        [item({ provider: "perplexity" }), item({ url: "https://b.com", provider: "parallel" })],
      ],
      10,
    );
    expect(out.map((i) => [i.url, i.provider])).toEqual([
      ["https://a.com/1", "firecrawl"],
      ["https://b.com", "parallel"],
    ]);
  });
});

describe("6.1 event date checked against the source", () => {
  it("uses the structured date first", () => {
    expect(signalDate(item({ date: "2026-11-01" }))).toEqual({
      eventDate: "2026-11-01",
      from: "structured",
    });
  });
  it("falls back to a literal date in the quote", () => {
    expect(
      signalDate(item({ snippet: "Anunciado el 3 de noviembre de 2026 por la empresa" })),
    ).toEqual({ eventDate: "2026-11-03", from: "literal" });
  });
  it("ambiguous or missing dates are unknown", () => {
    expect(signalDate(item({ snippet: "el 03/04/2026" }))).toEqual({
      eventDate: null,
      from: "unknown",
    });
  });
});

const steps: Step[] = [{ n: 1, source: "news", question: "q", returns: ["event_date"] }];
const base = {
  steps,
  signalStep: 1,
  window: { backDays: 30, forwardDays: 0 },
  verifiedOnly: false,
  now: NOW,
};

describe("SDD 4: a run turns signals into suggestions", () => {
  it("drops stale or undated signals with the reason", () => {
    const r = runPlay({
      ...base,
      signals: [item({ date: "2024-01-01" }), item({ url: "https://c.com" })],
      targets: [],
    });
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      expect.stringContaining("30 días"),
      expect.stringContaining("desconocida"),
    ]);
  });
  it("drops a signal whose quote carries contact data", () => {
    const r = runPlay({
      ...base,
      signals: [item({ date: "2026-11-10", snippet: "escribe a ana@x.com" })],
      targets: [],
    });
    expect(r.rejected[0]!.reason).toMatch(/contacto/);
  });
  it("without accounts the signal is a company suggestion with contact «sin dato»", () => {
    const r = runPlay({ ...base, signals: [item({ date: "2026-11-10" })], targets: [] });
    expect(r.suggestions).toEqual([
      expect.objectContaining({ accountId: null, contact: "sin dato" }),
    ]);
  });
  it("applies the graduated email rule and the optional verified-only gate", () => {
    const targets = [
      { accountId: "a1", personId: "p1", emailStatus: "invalid" as const },
      { accountId: "a2", personId: "p2", emailStatus: "unverified" as const },
      { accountId: "a3", personId: "p3", emailStatus: "verified" as const },
    ];
    const r = runPlay({ ...base, signals: [item({ date: "2026-11-10" })], targets });
    expect(r.suggestions.map((s) => [s.accountId, s.contact, s.mark])).toEqual([
      ["a1", "bloqueado", null],
      ["a2", "p2", "email sin verificar"],
      ["a3", "p3", null],
    ]);
    const v = runPlay({
      ...base,
      verifiedOnly: true,
      signals: [item({ date: "2026-11-10" })],
      targets,
    });
    expect(v.suggestions.filter((s) => s.contact !== "bloqueado").map((s) => s.accountId)).toEqual([
      "a3",
    ]);
  });
  it("evidence keeps the real provider and a quote of at most 280 chars", () => {
    const r = runPlay({
      ...base,
      signals: [item({ date: "2026-11-10", provider: "parallel", snippet: "x ".repeat(400) })],
      targets: [],
    });
    expect(r.accepted[0]!.provider).toBe("parallel");
    expect(r.accepted[0]!.evidence.quote.length).toBeLessThanOrEqual(280);
  });
});
