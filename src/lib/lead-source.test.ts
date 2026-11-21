// SDD-20261118-ux-legibilidad-pantallas-diarias · U-2 · CA-3, CA-4, CA-5: one group per lead origin, whatever its
// case or spacing. Pure, fictional data.
import { describe, expect, it } from "vitest";
import { funnelBy, type LeadRow } from "./lead-funnel";
import { NO_SOURCE, funnelBySource, normalizeLeadSource, sourceLabeler } from "./lead-source";

const L = (
  id: string,
  source: string | null | undefined,
  over: Partial<LeadRow> = {},
): LeadRow => ({
  id,
  stage: "new",
  created_at: "2026-11-02T10:00:00Z",
  stage_entered_at: "2026-11-02T10:00:00Z",
  contacted_at: null,
  mql_at: null,
  sql_at: null,
  opportunity_at: null,
  next_step_at: null,
  deal_id: null,
  source,
  ...over,
});

describe("CA-3 normalizeLeadSource", () => {
  it("«manual», «Manual» and « manual » share one key", () => {
    const keys = ["manual", "Manual", " manual ", "MANUAL"].map((s) => normalizeLeadSource(s).key);
    expect(new Set(keys).size).toBe(1);
  });
  it("collapses inner whitespace", () => {
    expect(normalizeLeadSource("Origen   A").key).toBe(normalizeLeadSource("origen a").key);
  });
  it("empty, blank or null is «Sin origen»", () => {
    for (const raw of ["", "   ", null, undefined]) {
      expect(normalizeLeadSource(raw).label).toBe(NO_SOURCE);
    }
    expect(normalizeLeadSource("").key).toBe(normalizeLeadSource(null).key);
  });
  it("composed and decomposed accents are the same origin (NFC)", () => {
    expect(normalizeLeadSource("Reunio\u0301n").key).toBe(normalizeLeadSource("Reunión").key);
    expect(normalizeLeadSource("Reunio\u0301n").label).toBe("Reunión");
  });
  it("a non-breaking space folds like a space", () => {
    expect(normalizeLeadSource("Origen\u00a0A").key).toBe(normalizeLeadSource("origen a").key);
  });
  it("zero-width characters do not make a different origin", () => {
    expect(normalizeLeadSource("manual\u200b").key).toBe(normalizeLeadSource("manual").key);
    expect(normalizeLeadSource("\ufeffmanual").key).toBe(normalizeLeadSource("manual").key);
  });
  it("an accent makes a different origin: «Reunión» and «Reunion» stay apart", () => {
    expect(normalizeLeadSource("Reunión").key).not.toBe(normalizeLeadSource("Reunion").key);
  });
});

describe("CA-4 one row per origin with the summed leads", () => {
  const leads = [
    L("1", "manual"),
    L("2", "Manual", { stage: "sql", sql_at: "2026-11-03T10:00:00Z" }),
    L("3", " manual "),
    L("4", "Origen A"),
    L("5", null),
    L("6", ""),
  ];
  const groups = funnelBy(leads, [], sourceLabeler(leads));

  it("«manual» in three spellings is one group of three", () => {
    const manual = groups.filter((g) => g.key.toLowerCase().trim() === "manual");
    expect(manual).toHaveLength(1);
    expect(manual[0]!.total).toBe(3);
    expect(manual[0]!.counts.sql).toBe(1);
  });
  it("null and empty origin share «Sin origen»", () => {
    expect(groups.find((g) => g.key === NO_SOURCE)?.total).toBe(2);
  });
  it("the label is the most frequent spelling", () => {
    const ls = [L("a", "Linkedin"), L("b", "LinkedIn"), L("c", "LinkedIn")];
    expect(funnelBy(ls, [], sourceLabeler(ls)).map((g) => g.key)).toEqual(["LinkedIn"]);
  });
  it("on a tie the spelling with a capital letter wins, then alphabetical order", () => {
    const ls = [L("a", "manual"), L("b", "Manual")];
    expect(funnelBy(ls, [], sourceLabeler(ls)).map((g) => g.key)).toEqual(["Manual"]);
    const same = [L("a", "Beta"), L("b", "BETA")];
    expect(funnelBy(same, [], sourceLabeler(same)).map((g) => g.key)).toEqual(["BETA"]);
  });
});

describe("CA-5 stored data is not changed", () => {
  it("the leads keep their own source text", () => {
    const leads = [L("1", "manual"), L("2", "Manual")];
    const copy = JSON.parse(JSON.stringify(leads));
    funnelBy(leads, [], sourceLabeler(leads));
    expect(leads).toEqual(copy);
  });
});

describe("funnelBySource is what both screens call", () => {
  it("groups spellings of one origin and keeps «Sin origen»", () => {
    const leads = [L("1", "manual"), L("2", "Manual"), L("3", null), L("4", "Origen A")];
    const g = funnelBySource(leads, []);
    expect(g.map((x) => [x.key, x.total]).sort()).toEqual(
      [
        ["Manual", 2],
        [NO_SOURCE, 1],
        ["Origen A", 1],
      ].sort(),
    );
  });
  it("many origins: every lead lands in exactly one group", () => {
    const leads = Array.from({ length: 40 }, (_, i) =>
      L(String(i), i % 2 ? `Origen ${i % 7}` : `origen ${i % 7}`),
    );
    const g = funnelBySource(leads, []);
    expect(g).toHaveLength(7);
    expect(g.reduce((n, x) => n + x.total, 0)).toBe(40);
  });
  it("an empty cohort gives no groups", () => {
    expect(funnelBySource([], [])).toEqual([]);
  });
});

describe("«Sin origen» keeps its own label", () => {
  it("a literal «sin origen» (lower case) shares the group and does not rename it", () => {
    const ls = [L("a", "sin origen"), L("b", "sin origen"), L("c", null)];
    expect(funnelBySource(ls, []).map((g) => [g.key, g.total])).toEqual([[NO_SOURCE, 3]]);
  });
});
