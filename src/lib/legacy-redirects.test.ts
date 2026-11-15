import { describe, expect, it } from "vitest";
import { hubRedirect, setupRedirect } from "./legacy-redirects";

describe("B1 /setup", () => {
  it("goes to Onboarding › Completar", () => {
    expect(setupRedirect()).toEqual({ to: "/onboarding/completar" });
  });
});
describe("B2 old Conocimiento rules/voice", () => {
  it("rules → Estrategia tab", () => {
    expect(hubRedirect({ seccion: "rules" })).toEqual({ to: "/strategy", search: { tab: "rules" } });
  });
  it("voice keeps its section and the opened doc", () => {
    expect(hubRedirect({ seccion: "voice", doc: "d1" })).toEqual({ to: "/strategy", search: { tab: "rules", seccion: "voice", doc: "d1" } });
  });
  it("other sections stay in Conocimiento", () => {
    expect(hubRedirect({ seccion: "playbooks" })).toBeNull();
    expect(hubRedirect({})).toBeNull();
  });
});
