import { describe, expect, it } from "vitest";
import { NAV, NAV_GROUPS, visibleItems } from "./nav";

describe("Ola 1: agrupación y avanzado", () => {
  it("CA-1 conserva cinco grupos y los destinos exactos en orden", () => {
    expect(NAV_GROUPS.map(g => g.title)).toEqual(["Hoy", "Diseñar", "Ejecutar", "Medir y aprender", "Ajustes"]);
    expect(NAV_GROUPS.map(g => g.items.map(i => i.to))).toEqual([
      ["/home", "/inbox", "/approvals", "/replies"],
      ["/onboarding", "/setup", "/strategy", "/products", "/hub"],
      ["/accounts", "/leads", "/people", "/deals", "/plays", "/abm", "/discoveries"],
      ["/metrics", "/advisor", "/cycle", "/debates", "/theory-u"],
      ["/company", "/team", "/integrations", "/memory"],
    ]);
    expect(NAV_GROUPS[0]?.collapsible).toBe(false);
  });
  it("CA-3 oculta solo tres destinos avanzados, no los elimina del catálogo", () => {
    const group = NAV_GROUPS.find(g => g.title === "Medir y aprender");
    if (!group) throw new Error("Falta el grupo");
    expect(visibleItems(group, true).map(i => i.to)).toEqual(["/metrics", "/advisor"]);
    expect(visibleItems(group, true, true).map(i => i.to)).toEqual(["/metrics", "/advisor", "/cycle", "/debates", "/theory-u"]);
    expect(visibleItems(group, false, true).some(i => i.to === "/advisor")).toBe(false);
    expect(NAV.map(i => i.to)).toContain("/connect");
    expect(new Set(NAV.map(i => i.to)).size).toBe(26);
  });
});