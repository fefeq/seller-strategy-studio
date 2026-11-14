import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "./nav";
import { paletteItems } from "./palette";

describe("CA-2/4 catálogo completo de ⌘K", () => {
  it("incluye avanzado y asistentes una vez, conservando roles", () => {
    const items = NAV_GROUPS.flatMap(g => paletteItems(g, true));
    expect(items).toHaveLength(26);
    expect(new Set(items.map(i => i.to)).size).toBe(26);
    for (const to of ["/cycle", "/debates", "/theory-u", "/connect", "/replies", "/onboarding"])
      expect(items.filter(i => i.to === to)).toHaveLength(1);
    const member = NAV_GROUPS.flatMap(g => paletteItems(g, false));
    expect(member).toHaveLength(25);
    expect(member.some(i => i.to === "/advisor")).toBe(false);
  });
});