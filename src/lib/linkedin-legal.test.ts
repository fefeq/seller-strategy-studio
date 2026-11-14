// Legal pause of robotized LinkedIn extraction (SDD pausa-legal-linkedin-y-gasto, pieza A).
// Pure rules: which actors pass the check, fail-closed reading of the flag, the visible text and the agent's explanation.
import { describe, expect, it } from "vitest";
import { ACTORS } from "@/lib/apify";
import {
  actorNeedsLegalCheck,
  extractionPaused,
  LINKEDIN_FLAG_KEY,
  LINKEDIN_PAUSE_TEXT,
  linkedinPauseExplanation,
  NON_LINKEDIN_ACTOR_IDS,
} from "./linkedin-legal";

describe("actorNeedsLegalCheck", () => {
  it("the three LinkedIn robots pass the legal check", () => {
    expect(actorNeedsLegalCheck(ACTORS.companyPosts.id)).toBe(true);
    expect(actorNeedsLegalCheck(ACTORS.profilePosts.id)).toBe(true);
    expect(actorNeedsLegalCheck(ACTORS.jobs.id)).toBe(true);
  });

  it("G2 is explicitly authorized as non-LinkedIn and never blocked by this pause", () => {
    expect(NON_LINKEDIN_ACTOR_IDS).toContain(ACTORS.g2.id);
    expect(actorNeedsLegalCheck(ACTORS.g2.id)).toBe(false);
  });

  it("an unknown actor is not implicitly authorized: it passes the check too", () => {
    expect(actorNeedsLegalCheck("someone~brand-new-actor")).toBe(true);
  });
});

describe("extractionPaused (A0: only an explicit pause stops it)", () => {
  it("paused when the row says so", () => {
    expect(extractionPaused({ paused: true })).toBe(true);
  });

  it("running when the row says paused = false", () => {
    expect(extractionPaused({ paused: false })).toBe(false);
  });

  it("a missing row (never configured) does not block the extraction", () => {
    expect(extractionPaused(null)).toBe(false);
  });
});

describe("visible texts", () => {
  it("the pause text names the legal review", () => {
    expect(LINKEDIN_PAUSE_TEXT).toContain("En pausa");
    expect(LINKEDIN_PAUSE_TEXT).toContain("revisión legal");
  });

  it("the agent explanation says what is paused, why, and what still works (G2, saved sources)", () => {
    const t = linkedinPauseExplanation();
    expect(t).toContain("revisión legal");
    expect(t).toContain("G2");
    expect(t).toContain("guardadas");
    expect(t).not.toContain("!"); // house style: no exclamation marks
  });

  it("the flag key is stable", () => {
    expect(LINKEDIN_FLAG_KEY).toBe("linkedin_extraction");
  });
});

describe("A0 active notice", () => {
  it("states robots, LinkedIn terms risk and pending legal review", async () => {
    const { LINKEDIN_ACTIVE_NOTICE } = await import("./linkedin-legal");
    expect(LINKEDIN_ACTIVE_NOTICE).toContain("mediante robots");
    expect(LINKEDIN_ACTIVE_NOTICE).toContain("términos de LinkedIn");
    expect(LINKEDIN_ACTIVE_NOTICE).toContain("Revisión legal pendiente");
  });
});
