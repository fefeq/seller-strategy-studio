import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkProposal, type Proposal } from "./propose";
import { annexFingerprints, hashFingerprints } from "./fingerprints";
import { ANNEX_FINGERPRINTS } from "./fingerprints.data";
import { getTool } from "@/lib/agent/tools";
import { TITLES } from "@/lib/mcp/tools/agent-tools";

const good: Proposal = {
  name: "Cuentas que estrenan sede en una ciudad nueva",
  trigger: "Nota de prensa con la apertura de una sede",
  window: { backDays: 30, forwardDays: 90 },
  steps: [
    {
      n: 1,
      source: "news",
      question: "¿Qué cuenta anuncia una sede y cuándo?",
      returns: ["event_date"],
    },
    { n: 2, source: "people", question: "¿Quién lleva operaciones allí?", returns: ["seniority"] },
  ],
  message: {
    claims: [{ text: "La cuenta abre sede con fecha", step: 1 }],
    built: "Un plan de arranque",
    ask: "¿Lo vemos?",
  },
  test: { n: 20, k: 2, base: 20 },
  verifiedOnly: false,
};

describe("SDD 3: proposal rules", () => {
  it("accepts a well-formed play", () => {
    expect(checkProposal(good)).toEqual({ ok: true });
  });
  it("rejects a missing freshness window", () => {
    expect(checkProposal({ ...good, window: { backDays: 0, forwardDays: 0 } }).ok).toBe(false);
  });
  it("rejects a claim that cites a missing step", () => {
    const r = checkProposal({
      ...good,
      message: { ...good.message, claims: [{ text: "x", step: 9 }] },
    });
    expect(r.ok).toBe(false);
  });
  it("rejects an unknown source", () => {
    const r = checkProposal({
      ...good,
      steps: [{ ...good.steps[0]!, source: "linkedin" as never }],
    });
    expect(r.ok).toBe(false);
  });
  it("rejects a bad test design", () => {
    expect(checkProposal({ ...good, test: { n: 10, k: 0, base: 10 } }).ok).toBe(false);
  });
  it("rejects a name that copies an annex slug (production fingerprint list)", () => {
    const annex = readFileSync("docs/prd/annex/glider-plays-analysis-20261112.md", "utf8");
    const slug = annex.match(/\|\s*\d+\s*\|\s*([a-z0-9]+(?:-[a-z0-9]+){2,})\s*\|/)![1]!;
    const r = checkProposal({ ...good, name: slug.replace(/-/g, " ") });
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("copia") });
  });
});

describe("SDD 3: fingerprint list in the repo matches the annex", () => {
  it("stores hashes only, equal to the annex fragments", () => {
    const annex = readFileSync("docs/prd/annex/glider-plays-analysis-20261112.md", "utf8");
    expect(ANNEX_FINGERPRINTS).toEqual(hashFingerprints(annexFingerprints(annex)));
    expect(JSON.stringify(ANNEX_FINGERPRINTS)).not.toMatch(/[a-z]{4,} [a-z]{4,}/);
  });
});

describe("SDD 3: assistant tool", () => {
  it("propose_custom_play is a write tool for owner and sales_leader with a title", () => {
    const t = getTool("propose_custom_play")!;
    expect(t.kind).toBe("write");
    expect(t.roles).toEqual(["owner", "sales_leader"]);
    expect(TITLES.propose_custom_play).toBeTruthy();
  });
});
