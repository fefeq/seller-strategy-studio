import { describe, expect, it } from "vitest";
import { CATALOG, type Play } from "./catalog";
import { canTogglePlays, checkToggle, effectiveState } from "./status";

const play = (id: string): Play => CATALOG.find((p) => p.id === id)!;
const WITH_RULE = play("meeting-form-orchestration"); // partial, already a rule → defaultEnabled true
const NO_RULE = play("closed-lost-revival"); // partial, no rule yet → defaultEnabled false
const PLANNED = play("pain-qualified-segments");
const BLOCKED_LI = play("brand-mentions-monitoring");

describe("who can activate or pause (CA-8, G-3)", () => {
  it("lets only owner and sales_leader, and gives the others a reason", () => {
    expect(canTogglePlays(["owner"]).ok).toBe(true);
    expect(canTogglePlays(["sales_leader"]).ok).toBe(true);
    for (const r of ["ae", "sdr", "marketing", "cs", "se", "deal_desk", "enablement"]) {
      const c = canTogglePlays([r]);
      expect(c.ok, r).toBe(false);
      expect(c.reason, r).toMatch(/Owner o el Sales Leader/);
    }
    expect(canTogglePlays([]).ok).toBe(false);
  });

  it("checkToggle refuses a member without the role before looking at the play", () => {
    const c = checkToggle({ play: WITH_RULE, roles: ["ae"], enable: false });
    expect(c.ok).toBe(false);
  });
});

describe("default state with no row (CA-10, G-3)", () => {
  it("is enabled only for plays that already exist as proactive rules", () => {
    expect(effectiveState(WITH_RULE, null).enabled).toBe(true);
    expect(effectiveState(WITH_RULE, undefined).label).toBe("Activado");
    expect(effectiveState(NO_RULE, null).enabled).toBe(false);
    expect(effectiveState(NO_RULE, null).label).toBe("Pausado");
  });

  it("follows the row when there is one", () => {
    expect(effectiveState(WITH_RULE, { enabled: false }).enabled).toBe(false);
    expect(effectiveState(NO_RULE, { enabled: true }).enabled).toBe(true);
  });

  it("matches defaultEnabled for every play of the catalogue", () => {
    for (const p of CATALOG) {
      if (p.status === "bloqueado" || p.status === "planificado") continue;
      expect(effectiveState(p, null).enabled, p.id).toBe(p.defaultEnabled);
    }
  });
});

describe("blocked and planned plays cannot be enabled (CA-9, G-3)", () => {
  it("shows a blocked play as blocked with the reason and what to decide, never enabled", () => {
    const s = effectiveState(BLOCKED_LI, null);
    expect(s).toMatchObject({ enabled: false, canEnable: false });
    expect(s.label).toBe("Bloqueado: falta una integración con la API oficial de LinkedIn");
    expect(s.reason).toBeTruthy();
  });

  it("covers the four blockers with their own words", () => {
    const label = (id: string) => effectiveState(play(id), null).label;
    expect(label("new-hire-tracking")).toBe(
      "Bloqueado: falta una integración con la API oficial de LinkedIn",
    );
    expect(label("website-visitor-de-anonymization")).toBe(
      "Bloqueado: falta un proveedor de datos",
    );
    expect(label("public-records-signals")).toBe("Bloqueado: falta decidir a qué GTM sirve NOKKO");
    expect(label("funding-signal-scraping")).toMatch(/^Bloqueado: /);
  });

  it("refuses to enable them and explains what blocks them and what to decide", () => {
    for (const p of [BLOCKED_LI, PLANNED]) {
      const c = checkToggle({ play: p, roles: ["owner"], enable: true });
      expect(c.ok, p.id).toBe(false);
      if (c.ok) continue;
      expect(c.error, p.id).toMatch(/^No puedes activar este play todavía: .+\. .+\.$/);
    }
  });

  it("keeps a stored enabled=true from turning a blocked or planned play on (state changed after activation)", () => {
    expect(effectiveState(BLOCKED_LI, { enabled: true }).enabled).toBe(false);
    expect(effectiveState(PLANNED, { enabled: true })).toMatchObject({
      enabled: false,
      canEnable: false,
    });
    expect(effectiveState(PLANNED, null).label).toMatch(/^Planificado/);
  });

  it("lets a leader activate or pause a play that is not blocked", () => {
    expect(checkToggle({ play: NO_RULE, roles: ["sales_leader"], enable: true })).toEqual({
      ok: true,
    });
    expect(checkToggle({ play: WITH_RULE, roles: ["owner"], enable: false })).toEqual({ ok: true });
  });

  it("lets a leader pause a blocked play (pausing is always safe)", () => {
    expect(checkToggle({ play: BLOCKED_LI, roles: ["owner"], enable: false })).toEqual({
      ok: true,
    });
  });
});
