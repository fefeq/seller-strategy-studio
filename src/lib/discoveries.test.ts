import { describe, expect, it } from "vitest";
import { appendCompetitor, dedupeKey, discoveryDue, dismissMemory, knownCompetitors, parseCompetitors } from "./discoveries";

describe("Descubiertos", () => {
  it("recognises the same company by domain or by name without legal suffixes", () => {
    expect(dedupeKey("company", { name: "Acme S.L.", domain: "https://www.acme.com/about" })).toBe("company:acme.com");
    expect(dedupeKey("company", { name: "Acme S.L." })).toBe(dedupeKey("company", { name: "ACME" }));
    expect(dedupeKey("competitor", { name: "HubSpot, Inc." })).toBe("competitor:hubspot");
  });
  it("runs once a week", () => {
    const now = new Date("2026-10-24T10:00:00Z");
    expect(discoveryDue(null, now)).toBe(true);
    expect(discoveryDue("2026-10-20T10:00:00Z", now)).toBe(false);
    expect(discoveryDue("2026-10-17T10:00:00Z", now)).toBe(true);
  });
  it("never proposes a competitor the company already lists, nor itself", () => {
    const known = knownCompetitors("HubSpot, Pipedrive (CRM ligero); Salesforce");
    const raw = JSON.stringify({ competitors: [
      { name: "HubSpot", url: null, why: "x" }, { name: "Nokko", url: null, why: "x" },
      { name: "Attio", url: "https://attio.com", why: "CRM moderno" }, { name: "attio", url: null, why: "dup" },
    ] });
    expect(parseCompetitors(raw, known, "Nokko").map((c) => c.name)).toEqual(["Attio"]);
    expect(parseCompetitors("no json", known, "Nokko")).toEqual([]);
  });
  it("adds an accepted competitor to the positioning once", () => {
    expect(appendCompetitor("HubSpot", "Attio")).toBe("HubSpot, Attio");
    expect(appendCompetitor("HubSpot, Attio", "attio")).toBe("HubSpot, Attio");
    expect(appendCompetitor(null, "Attio")).toBe("Attio");
  });
  it("remembers why something was dismissed", () => {
    expect(dismissMemory("company", "Acme", "No encaja con el ICP").content).toBe("Descartado en Descubiertos (empresa): Acme. Motivo: No encaja con el ICP.");
  });
});
