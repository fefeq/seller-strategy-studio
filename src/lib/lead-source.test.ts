// SDD-20261118-ux-legibilidad-pantallas-diarias · U-2 · CA-3, CA-4, CA-5: one group per lead origin, whatever its
// case or spacing. Pure, fictional data.
import { describe, expect, it } from "vitest";
import { funnelBy, type LeadRow } from "./lead-funnel";
import { NO_SOURCE, normalizeLeadSource, sourceLabeler } from "./lead-source";

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
