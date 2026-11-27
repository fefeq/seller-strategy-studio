import { describe, expect, it } from "vitest";
import {
  assistantSectionTarget,
  canApproveStrategy,
  hasSavedContent,
  hiddenStrategySections,
  mergeStrategyWithoutClearing,
  visibleStrategySections,
  type StrategySectionInfo,
} from "./strategy-sections-view";

const sections: StrategySectionInfo[] = [
  { key: "icp", hasContent: false },
  { key: "segments", hasContent: false },
  { key: "positioning", hasContent: false },
  { key: "messaging", hasContent: false },
  { key: "sales_models", hasContent: false },
  { key: "aarrr", hasContent: false },
  { key: "budget", hasContent: false },
  { key: "brief", hasContent: false },
];

describe("strategy sections view", () => {
  it("a new team sees only five sections", () => {
    expect(visibleStrategySections(sections, "core")).toHaveLength(5);
    expect(hiddenStrategySections(sections, "core")).toEqual(["aarrr", "budget", "brief"]);
  });

  it("show all reveals every section in order", () => {
    expect(visibleStrategySections(sections, "all")).toEqual(sections.map((s) => s.key));
  });

  it("a non-core section with saved content stays visible", () => {
    const withData = sections.map((s) => (s.key === "budget" ? { ...s, hasContent: true } : s));
    expect(visibleStrategySections(withData, "core")).toContain("budget");
  });

  it("detects saved content", () => {
    expect(hasSavedContent("")).toBe(false);
    expect(hasSavedContent("  ")).toBe(false);
    expect(hasSavedContent({ a: "", b: "texto" })).toBe(true);
    expect(hasSavedContent([])).toBe(false);
  });

  it("approving never clears hidden sections", () => {
    const saved = { icp: "viejo", budget: "presupuesto guardado" };
    const merged = mergeStrategyWithoutClearing(saved, { icp: "nuevo", budget: undefined });
    expect(merged).toEqual({ icp: "nuevo", budget: "presupuesto guardado" });
  });

  it("assistant notice opens a hidden section without applying changes", () => {
    const target = assistantSectionTarget("brief", "core", sections);
    expect(target).toEqual({ focusSection: "brief", mode: "all", applyChanges: false });
  });

  it("only a manager of the same company can approve", () => {
    expect(canApproveStrategy({ role: "owner", memberOrgId: "a", strategyOrgId: "a" })).toBe(true);
    expect(canApproveStrategy({ role: "sales_leader", memberOrgId: "a", strategyOrgId: "a" })).toBe(true);
    expect(canApproveStrategy({ role: "ae", memberOrgId: "a", strategyOrgId: "a" })).toBe(false);
    expect(canApproveStrategy({ role: "owner", memberOrgId: "a", strategyOrgId: "b" })).toBe(false);
    expect(canApproveStrategy({ role: null, memberOrgId: "a", strategyOrgId: "a" })).toBe(false);
  });
});
