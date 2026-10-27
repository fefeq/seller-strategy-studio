import { describe, expect, it } from "vitest";
import { buildAuthUrl, canManageConnections, checkGrant, driveConnectionState, DRIVE_SCOPE, failureStatus, oauthErrorText, PERMISSIONS_TEXT, PURPOSE_TEXT, revocationText, revokeSkipReason, STATE_LABEL, type ConnectionRow } from "./drive-connection";

const row = (status: ConnectionRow["status"]): ConnectionRow => ({ status, google_email: "ana@ejemplo.test", connected_by: null, connected_at: "2026-10-26T10:00:00Z", last_error: null });

describe("CA-1 (SDD 10) · one state per provider", () => {
  it("the company's account wins; else NOKKO's when configured; else not connected", () => {
    expect(driveConnectionState(row("active"), true)).toBe("own");
    expect(driveConnectionState(null, true)).toBe("nokko");
    expect(driveConnectionState(null, false)).toBe("none");
    expect(driveConnectionState(row("error"), true)).toBe("error");
  });
  it("a provider that does not answer is never shown as disconnected", () => {
    expect(driveConnectionState(row("no_response"), false)).toBe("no_response");
    expect(STATE_LABEL.no_response).toBe("Sin respuesta");
    expect(Object.values(STATE_LABEL)).toEqual(["Cuenta propia", "Proporcionada por NOKKO", "Sin conectar", "Error", "Sin respuesta"]);
  });
});

describe("CA-1 / CA-2 (SDD 5) · the consent request", () => {
  const u = new URL(buildAuthUrl({ clientId: "cid.apps.googleusercontent.com", redirectUri: "https://app.ejemplo.test/api/public/drive/callback", state: "abc" }));
  it("lets the person choose the Google account even if one is already signed in (CA-1)", () => {
    expect(u.searchParams.get("prompt")).toContain("select_account");
  });
  it("asks only for drive.file and never for broader access (CA-2)", () => {
    expect(u.searchParams.get("scope")).toBe(DRIVE_SCOPE);
    expect(u.searchParams.get("include_granted_scopes")).toBe("false");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.toString()).not.toMatch(/readonly|auth\/drive(&|$)/);
  });
  it("explains what NOKKO can read and save before continuing (CA-2)", () => {
    expect(PERMISSIONS_TEXT.reads).toMatch(/Solo podrá leer lo que NOKKO haya guardado/);
    expect(PERMISSIONS_TEXT.saves).toMatch(/Nokko/);
    expect(PERMISSIONS_TEXT.revoke).toMatch(/desconectarla/);
  });
  it("does not promise to read documents the person already has: drive.file cannot, and there is no picker yet (CA-2)", () => {
    for (const t of [PERMISSIONS_TEXT.reads, PURPOSE_TEXT]) {
      expect(t).toMatch(/Todavía no/);
      expect(t).toMatch(/selector de Google/);
      expect(t).not.toMatch(/que elijas|importar al hub/);
    }
    expect(DRIVE_SCOPE).toBe("https://www.googleapis.com/auth/drive.file");
  });
});

describe("CA-3 (SDD 5), CA-5 and CA-6 (SDD 10) · check before saving", () => {
  const token = { scope: `${DRIVE_SCOPE}`, refresh_token: "r" };
  it("shows the connected account's email (CA-3)", () => {
    expect(checkGrant(token, { user: { emailAddress: " Ana@Ejemplo.test " } })).toEqual({ ok: true, email: "ana@ejemplo.test" });
  });
  it("never saves when something is missing, and says why (CA-6 of SDD 10)", () => {
    const bad = [
      checkGrant(null, null),
      checkGrant({ scope: "openid", refresh_token: "r" }, { user: { emailAddress: "a@b.test" } }),
      checkGrant({ scope: DRIVE_SCOPE }, { user: { emailAddress: "a@b.test" } }),
      checkGrant(token, { user: {} }),
    ];
    for (const r of bad) { expect(r.ok).toBe(false); expect(r.ok === false && r.error.length > 10).toBe(true); }
  });
});

describe("edge cases (SDD 5 §8) · Google errors and revoked access", () => {
  it("a cancelled consent returns without changes", () => {
    expect(oauthErrorText("access_denied")).toMatch(/No se ha cambiado nada/);
  });
  it("a Workspace administrator restriction and unknown reasons are explained", () => {
    expect(oauthErrorText("admin_policy_enforced")).toMatch(/administrador/);
    expect(oauthErrorText("x", "motivo de Google")).toContain("motivo de Google");
    expect(oauthErrorText("x")).toMatch(/Vuelve a intentarlo/);
  });
  it("revoked or expired access is «error»; a provider outage keeps the connection (§8 of SDD 5)", () => {
    expect(failureStatus(401)?.status).toBe("error");
    expect(failureStatus(400)?.status).toBe("error");
    expect(failureStatus(503)?.status).toBe("no_response");
    expect(failureStatus(null)?.status).toBe("no_response");
  });
  it("a file we may not touch (403, 404) says nothing about the account", () => {
    expect(failureStatus(403)).toBeNull();
    expect(failureStatus(404)).toBeNull();
  });
});

describe("CA-10 (SDD 5) / CA-11 (SDD 10) · who manages", () => {
  it("only the Owner", () => {
    expect(canManageConnections("owner")).toBe(true);
    for (const r of ["sales_leader", "member", "viewer", "", null, undefined]) expect(canManageConnections(r)).toBe(false);
  });
});

describe("CA-8 (SDD 10) · when the old access is left alone, and what the screen says", () => {
  it("skips the revocation for the same account or an account another company uses", () => {
    expect(revokeSkipReason({ oldEmail: "a@x.test", newEmail: "a@x.test", usedElsewhere: false })).toBe("same_account");
    expect(revokeSkipReason({ oldEmail: "a@x.test", newEmail: "b@x.test", usedElsewhere: true })).toBe("shared");
    expect(revokeSkipReason({ oldEmail: "a@x.test", newEmail: null, usedElsewhere: true })).toBe("shared");
    expect(revokeSkipReason({ oldEmail: "a@x.test", newEmail: "b@x.test", usedElsewhere: false })).toBeNull();
    expect(revokeSkipReason({ oldEmail: "a@x.test", newEmail: null, usedElsewhere: false })).toBeNull();
  });
  it("only «revoked» says Google confirmed; the other outcomes never claim it", () => {
    expect(revocationText("revoked", "a@x.test")).toMatch(/Google confirmó/);
    for (const o of ["failed", "unreadable", "same_account", "shared"] as const) expect(revocationText(o, "a@x.test")).not.toMatch(/confirmó|se revocó el acceso de NOKKO/);
    expect(revocationText("failed", "a@x.test")).toMatch(/myaccount\.google\.com\/permissions/);
  });
});
