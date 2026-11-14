import { describe, expect, it } from "vitest";
import { NAV, NAV_GROUPS, groupOpen, visibleItems } from "./nav";

const g = (k: string) => NAV_GROUPS.find((x) => x.key === k)!;

describe("Menú", () => {
  it("shows at most 8 daily entries without opening anything", () => {
    expect(visibleItems(g("daily"), false).length).toBeLessThanOrEqual(8);
  });
  it("hides Asesor GTM from non-leaders", () => {
    expect(visibleItems(g("measure"), false).some((i) => i.to === "/advisor")).toBe(false);
    expect(visibleItems(g("measure"), true).some((i) => i.to === "/advisor")).toBe(true);
  });
  it("lists Plays GTM in Ejecutar for every member, and the ⌘K palette reads the same list (CA-7)", async () => {
    const item = g("execute").items.find((i) => i.to === "/plays");
    expect(item?.label).toBe("Plays GTM");
    expect(item?.leadersOnly).toBeFalsy();
    expect(visibleItems(g("execute"), false).some((i) => i.to === "/plays")).toBe(true);
    expect(NAV.some((i) => i.to === "/plays")).toBe(true);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/components/command-palette.tsx", "utf8")).toMatch(/NAV_GROUPS\.map/);
  });
  it("finds Plays GTM in ⌘K when you type «equipos» (SDD play-teams CA-12)", () => {
    const item = g("execute").items.find((i) => i.to === "/plays");
    expect(item?.keywords?.split(/\s+/)).toContain("equipos");
  });
  it("opens a collapsed group when you are on one of its pages", () => {
    expect(groupOpen(g("measure"), "/debates", false)).toBe(true);
    expect(groupOpen(g("settings"), "/home", false)).toBe(false);
  });
});
