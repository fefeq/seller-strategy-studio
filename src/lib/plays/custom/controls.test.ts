import { describe, expect, it } from "vitest";
import { checkCustomControl, resultPatch, activationPatch } from "./controls";

describe("NK-0171 U-5", () => {
  it("CA-2 only Owner and Sales Leader can change a play", () => {
    for (const role of ["owner", "sales_leader"]) expect(checkCustomControl([role], "aprobado", null, false).ok).toBe(true);
    expect(checkCustomControl(["ae"], "aprobado", null, false).ok).toBe(false);
  });
  it("CA-3 archived and safety-paused plays cannot activate, but may pause", () => {
    expect(checkCustomControl(["owner"], "archivado", null, true).ok).toBe(false);
    expect(checkCustomControl(["owner"], "pausado", "provider_denied", true).ok).toBe(false);
    expect(checkCustomControl(["owner"], "pausado", "uncertain", false).ok).toBe(true);
  });
  it("CA-3 first activation is preserved", () => {
    expect(activationPatch(true, null, "2026-11-14T00:00:00Z").first_activated_at).toBe("2026-11-14T00:00:00Z");
    expect(activationPatch(true, "2026-11-13T00:00:00Z", "2026-11-14T00:00:00Z").first_activated_at).toBe("2026-11-13T00:00:00Z");
    expect(activationPatch(false, null, "2026-11-14T00:00:00Z").status).toBe("pausado");
  });
  it("CA-4 observed successes may be zero, never exceed sample or be fractional", () => {
    expect(resultPatch(20, 0, "2026-11-14T00:00:00Z")).toMatchObject({ test_sample: 20, test_successes: 0, test_recorded_at: "2026-11-14T00:00:00Z" });
    for (const [n, k] of [[0, 0], [20, 21], [20, -1], [2.5, 1], [20, 1.5]]) expect(() => resultPatch(n, k, "now")).toThrow();
  });
});