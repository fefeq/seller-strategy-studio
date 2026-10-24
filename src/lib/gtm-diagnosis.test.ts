import { describe, expect, it } from "vitest";
import { archetypeOf, diagnose } from "@/lib/gtm-diagnosis";

describe("archetypeOf", () => {
  it("marketplace is E and B2C is D whatever the ticket", () => {
    expect(archetypeOf({ model: "marketplace", acv: 100_000, friction: "committee", stage: "scale" })).toBe("E");
    expect(archetypeOf({ model: "b2c", acv: 60, friction: "self_serve", stage: "early" })).toBe("D");
  });
  it("B2B self-serve under 5K is PLG (A)", () => {
    expect(archetypeOf({ model: "b2b", acv: 1_200, friction: "self_serve", stage: "early" })).toBe("A");
  });
  it("B2B between 5K and 50K is hybrid (B)", () => {
    expect(archetypeOf({ model: "b2b", acv: 12_000, friction: "self_serve", stage: "early" })).toBe("B");
  });
  it("B2B at 50K or more is Enterprise (C)", () => {
    expect(archetypeOf({ model: "b2b", acv: 50_000, friction: "self_serve", stage: "scale" })).toBe("C");
  });
  it("a committee sale from 25K is Enterprise", () => {
    expect(archetypeOf({ model: "b2b", acv: 30_000, friction: "committee", stage: "scale" })).toBe("C");
  });
});

describe("stage filter", () => {
  it("idea blocks scale frameworks and forces The Mom Test", () => {
    const d = diagnose({ model: "b2b", acv: 1_000, friction: "self_serve", stage: "idea" });
    expect(d.active).not.toContain("Growth loops");
    expect(d.discarded.map((x) => x.framework)).toContain("Growth loops");
    expect(d.forced).toContain("The Mom Test");
  });
  it("early stage activates Van Westendorp", () => {
    expect(diagnose({ model: "b2b", acv: 10_000, friction: "committee", stage: "early" }).forced).toContain("Van Westendorp para el primer precio");
  });
  it("scale keeps ABM for Enterprise", () => {
    expect(diagnose({ model: "b2b", acv: 80_000, friction: "committee", stage: "scale" }).active).toContain("ABM");
  });
  it("low ticket discards a sales team with a reason", () => {
    const d = diagnose({ model: "b2b", acv: 300, friction: "self_serve", stage: "scale" }, (n) => `${n} €`);
    expect(d.discarded[0].reason).toContain("300 €");
  });
});
