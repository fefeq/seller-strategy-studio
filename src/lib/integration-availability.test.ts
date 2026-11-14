// Ola 0.7: CRM cards without a native connection are marked «Próximamente», never removed.
import { describe, expect, it } from "vitest";
import { comingSoon } from "./integration-availability";

describe("comingSoon", () => {
  it("marks CRMs without native connection", () => {
    for (const n of ["HubSpot", "Pipedrive", "Attio", "Salesforce", "hubspot"]) expect(comingSoon(n)).toBe(true);
  });
  it("leaves the rest alone", () => {
    for (const n of ["Google Calendar", "Apollo", "Clay", "Gong"]) expect(comingSoon(n)).toBe(false);
  });
});
