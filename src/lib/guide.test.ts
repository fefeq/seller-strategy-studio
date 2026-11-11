import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { currentStep, guideSteps, showGuide } from "@/lib/guide";

const base = { hasCompany: true, onboardingStep: null, searched: false, metricsSeen: false };

describe("guide", () => {
  it("has the four steps in order: company, onboarding, search, metrics", () => {
    expect(guideSteps(base).map((s) => s.id)).toEqual(["company", "onboarding", "search", "metrics"]);
  });

  it("onboarding only counts as done once it reaches the roadmap step", () => {
    expect(guideSteps({ ...base, onboardingStep: "diagnosis" })[1].done).toBe(false);
    expect(guideSteps({ ...base, onboardingStep: "roadmap" })[1].done).toBe(true);
  });

  it("highlights the first step not done, even if later ones are done", () => {
    expect(currentStep(guideSteps({ ...base, searched: true, metricsSeen: true }))?.id).toBe("onboarding");
  });

  it("hides when every step is done or when the person hides it", () => {
    const all = guideSteps({ hasCompany: true, onboardingStep: "roadmap", searched: true, metricsSeen: true });
    expect(currentStep(all)).toBeNull();
    expect(showGuide(all, false)).toBe(false);
    expect(showGuide(guideSteps(base), true)).toBe(false);
    expect(showGuide(guideSteps(base), false)).toBe(true);
  });
});

describe("guide uses the single onboarding definition (NK-0009 CA-2)", () => {
  it("does not compare the step with the roadmap by itself", () => {
    expect(readFileSync("src/lib/guide.ts", "utf8")).not.toContain('=== "roadmap"');
  });
  it("keeps the same result for roadmap, blocks and null", () => {
    expect(guideSteps({ ...base, onboardingStep: "roadmap" })[1].done).toBe(true);
    expect(guideSteps({ ...base, onboardingStep: "blocks" })[1].done).toBe(false);
    expect(guideSteps({ ...base, onboardingStep: null })[1].done).toBe(false);
  });
});
