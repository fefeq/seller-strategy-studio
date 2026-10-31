import { describe, expect, it } from "vitest";
import { currentStep, guideSteps, showGuide } from "@/lib/guide";

const base = { onboardingStep: null, searched: false, metricsSeen: false };

describe("guide", () => {
  it("has the three steps in order: onboarding, search, metrics", () => {
    expect(guideSteps(base).map((s) => s.id)).toEqual(["onboarding", "search", "metrics"]);
  });

  it("onboarding only counts as done once it reaches the roadmap step", () => {
    expect(guideSteps({ ...base, onboardingStep: "diagnosis" })[0].done).toBe(false);
    expect(guideSteps({ ...base, onboardingStep: "roadmap" })[0].done).toBe(true);
  });

  it("highlights the first step not done, even if later ones are done", () => {
    expect(currentStep(guideSteps({ ...base, searched: true, metricsSeen: true }))?.id).toBe("onboarding");
  });

  it("hides when every step is done or when the person hides it", () => {
    const all = guideSteps({ onboardingStep: "roadmap", searched: true, metricsSeen: true });
    expect(currentStep(all)).toBeNull();
    expect(showGuide(all, false)).toBe(false);
    expect(showGuide(guideSteps(base), true)).toBe(false);
    expect(showGuide(guideSteps(base), false)).toBe(true);
  });
});
