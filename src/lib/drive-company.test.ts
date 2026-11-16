import { describe, expect, it } from "vitest";
import { canManageDrive, driveCompanyState, DRIVE_SCOPES } from "./drive-company";

describe("Drive por empresa (C2)", () => {
  it("sin credenciales de Google de NOKKO queda «por preparar»", () => {
    expect(driveCompanyState(false, null)).toEqual({ kind: "setup_needed" });
  });
  it("con credenciales y sin cuenta conectada sigue en la carpeta compartida (transición)", () => {
    expect(driveCompanyState(true, null)).toEqual({ kind: "shared" });
  });
  it("muestra el email, quién y cuándo (CA-3, CA-9)", () => {
    expect(
      driveCompanyState(true, {
        account_email: "a@b.com",
        connected_at: "2026-11-15",
        status: "active",
        by: "Fede",
      }),
    ).toEqual({ kind: "connected", email: "a@b.com", by: "Fede", at: "2026-11-15" });
  });
  it("un acceso caducado pide reconectar", () => {
    expect(
      driveCompanyState(true, {
        account_email: null,
        connected_at: "x",
        status: "reconnect",
        by: null,
      }).kind,
    ).toBe("reconnect");
  });
  it("solo el Owner gestiona la cuenta (CA-10)", () => {
    expect(canManageDrive(["owner"])).toBe(true);
    expect(canManageDrive(["sales_leader", "member"])).toBe(false);
  });
  it("pide permisos mínimos, sin acceso completo a Drive (CA-2)", () => {
    expect(DRIVE_SCOPES).not.toContain("https://www.googleapis.com/auth/drive");
  });
});
