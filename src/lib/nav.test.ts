import { describe, expect, it } from "vitest";
import { NAV_GROUPS, groupOpen, visibleItems } from "./nav";

const g = (k: string) => NAV_GROUPS.find((x) => x.key === k)!;

describe("Menú", () => {
  it("shows at most 10 daily entries without opening anything", () => {
    expect(visibleItems(g("daily"), false).length).toBeLessThanOrEqual(10);
  });
  it("hides Asesor GTM from non-leaders", () => {
    expect(visibleItems(g("more"), false).some((i) => i.to === "/advisor")).toBe(false);
    expect(visibleItems(g("more"), true).some((i) => i.to === "/advisor")).toBe(true);
  });
  it("opens a collapsed group when you are on one of its pages", () => {
    expect(groupOpen(g("more"), "/debates", false)).toBe(true);
    expect(groupOpen(g("settings"), "/home", false)).toBe(false);
  });
});
