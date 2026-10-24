import { describe, expect, it } from "vitest";
import { similarOrg } from "./org-match";

const mine = [
  { org_id: "1", name: "POSTIN", website: null },
  { org_id: "2", name: "Veta-i", website: "https://veta-i.com" },
  { org_id: "3", name: "Cliente Beta", website: null, archived: true },
];

describe("Empresa parecida al crear", () => {
  it("finds the same company by name regardless of case and suffix", () => {
    expect(similarOrg({ name: "Postin S.L." }, mine)?.org.org_id).toBe("1");
  });
  it("finds it by web too", () => {
    expect(similarOrg({ name: "Otra", website: "www.veta-i.com" }, mine)?.org.org_id).toBe("2");
  });
  it("includes archived companies", () => {
    expect(similarOrg({ name: "cliente beta" }, mine)?.org.org_id).toBe("3");
  });
  it("says nothing for a new name", () => {
    expect(similarOrg({ name: "Acme Logistics" }, mine)).toBeNull();
  });
});
