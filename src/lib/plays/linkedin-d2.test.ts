import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { checkToggle, describePlay, effectiveState } from "./status";

describe("NK-0176: D2 closure does not enable LinkedIn plays", () => {
  it("CA-1: every LinkedIn-blocked play ignores a stored enabled row", () => {
    const blocked = CATALOG.filter((play) => play.blockedBy === "linkedin_d2");
    expect(blocked.length).toBeGreaterThan(0);
    for (const play of blocked) {
      for (const row of [null, { enabled: false }, { enabled: true }]) {
        expect(effectiveState(play, row)).toMatchObject({
          enabled: false,
          canEnable: false,
        });
        expect(describePlay(play, row)).toMatchObject({
          enabled: false,
          canEnable: false,
          status: "bloqueado",
          blockedBy: "linkedin_d2",
        });
      }
    }
  });

  it("CA-2: both leaders may pause but cannot activate a LinkedIn-blocked play", () => {
    const play = CATALOG.find((candidate) => candidate.id === "brand-mentions-monitoring");
    if (!play) throw new Error("Missing fixture play");
    for (const role of ["owner", "sales_leader"]) {
      expect(checkToggle({ play, roles: [role], enable: true }).ok).toBe(false);
      expect(checkToggle({ play, roles: [role], enable: false })).toEqual({ ok: true });
    }
    expect(checkToggle({ play, roles: ["ae"], enable: false }).ok).toBe(false);
  });

  it("CA-3: other blockers and planned plays still reject activation", () => {
    const others = CATALOG.filter(
      (play) =>
        (play.status === "bloqueado" && play.blockedBy !== "linkedin_d2") ||
        play.status === "planificado",
    );
    expect(others.length).toBeGreaterThan(0);
    for (const play of others) {
      expect(effectiveState(play, { enabled: true })).toMatchObject({
        enabled: false,
        canEnable: false,
      });
      expect(checkToggle({ play, roles: ["owner"], enable: true }).ok).toBe(false);
    }
  });
});
