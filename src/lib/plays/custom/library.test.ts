import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LIBRARY, ORIGIN_LABEL, splitCompetitors, accountsForCompetitor, recipeSources } from "./library";
import { shingles, overlap, FINGERPRINT_MIN_OVERLAP, copiesAnnex, annexFingerprints } from "./fingerprints";
import { validateTestDesign, checkSources, SOURCE_REGISTRY } from "./model";
import { CAPABILITIES, NEED_KEYS } from "@/lib/orchestrator/planner";

describe("P-7 origin labels", () => {
  it("are «De NOKKO» and «Creado para tu empresa»", () => {
    expect(ORIGIN_LABEL.biblioteca).toBe("De NOKKO");
    expect(ORIGIN_LABEL.a_medida).toBe("Creado para tu empresa");
  });
});

describe("6.4 the three recipes", () => {
  it("are exactly R-1, R-2 and R-3, read-only", () => {
    expect(LIBRARY.map((r) => r.id)).toEqual(["nokko:r1", "nokko:r2", "nokko:r3"]);
    expect(Object.isFrozen(LIBRARY)).toBe(true);
  });
  it("each has a valid test design and a positive freshness window", () => {
    for (const r of LIBRARY) {
      expect(validateTestDesign(r.test)).toEqual({ ok: true });
      expect(r.window.backDays).toBeGreaterThan(0);
    }
  });
  it("R-2 reads reviews through Apify only and is blocked without it", () => {
    expect(CAPABILITIES.reviews.options.map((o) => o.service)).toEqual(["apify"]);
    expect(NEED_KEYS.reviews).toBeNull();
    const r2 = LIBRARY[1]!;
    expect(recipeSources(r2)).toContain("reviews");
    expect(checkSources(recipeSources(r2), { services: ["firecrawl", "perplexity"], posthog: false, driveFolder: false }).ok).toBe(false);
    expect(SOURCE_REGISTRY.reviews.need).toBe("reviews");
  });
  it("no recipe uses Drive, PostHog or LinkedIn people", () => {
    for (const r of LIBRARY) for (const s of recipeSources(r)) expect(["drive", "posthog"]).not.toContain(s);
  });
  it("R-2 never contacts the review author", () => {
    expect(LIBRARY[1]!.contactsAuthor).toBe(false);
    expect(LIBRARY[2]!.contactsAuthor).toBe(false);
  });
});

describe("6.4 account selection from declared competitors", () => {
  it("splits free text into competitor names", () => {
    expect(splitCompetitors("HubSpot, Pipedrive; Attio y Salesforce\nZoho")).toEqual(["HubSpot", "Pipedrive", "Attio", "Salesforce", "Zoho"]);
    expect(splitCompetitors(null)).toEqual([]);
  });
  it("picks accounts whose plan or lost deal names the competitor (match.ts rules)", () => {
    const out = accountsForCompetitor("HubSpot Inc.", {
      plans: [{ account_id: "a1", competitors: "Hubspot, Salesforce" }, { account_id: "a2", competitors: "Pipedrive" }],
      lostDeals: [{ account_id: "a3", lost_competitor: "HUBSPOT" }, { account_id: null, lost_competitor: "HubSpot" }],
    });
    expect(out.sort()).toEqual(["a1", "a3"]);
  });
  it("returns nothing instead of inventing when no account names it", () => {
    expect(accountsForCompetitor("HubSpot", { plans: [], lostDeals: [] })).toEqual([]);
  });
});

describe("7 fingerprints by fragments", () => {
  it("normalises case and accents", () => {
    expect([...shingles("Ésta Es UNA prueba")]).toEqual([...shingles("esta es una prueba")]);
  });
  it("overlap is 1 for the same text and 0 for unrelated", () => {
    expect(overlap(shingles("uno dos tres cuatro"), shingles("uno dos tres cuatro"))).toBe(1);
    expect(overlap(shingles("uno dos tres cuatro"), shingles("cinco seis siete ocho"))).toBe(0);
  });
  it("flags a candidate that reuses a fingerprinted fragment", () => {
    const fp = [shingles("alpha beta gamma delta epsilon")];
    expect(copiesAnnex("alpha beta gamma delta", fp)).toBe(true);
    expect(copiesAnnex("zeta eta theta iota", fp)).toBe(false);
    expect(FINGERPRINT_MIN_OVERLAP).toBeGreaterThan(0);
  });
});

describe("7 anti-copy: library vs annex (read at run time)", () => {
  const annex = readFileSync("docs/prd/annex/glider-plays-analysis-20261112.md", "utf8");
  const fps = annexFingerprints(annex);
  it("the annex yields slugs and hooks to compare", () => {
    expect(fps.length).toBeGreaterThan(50);
  });
  it("no recipe title, hook, message or id copies the annex", () => {
    for (const r of LIBRARY)
      for (const text of [r.title, r.hook, r.message.built, r.message.ask, r.id, ...r.message.claims.map((c) => c.text)])
        expect(copiesAnnex(text, fps), text).toBe(false);
  });
});
