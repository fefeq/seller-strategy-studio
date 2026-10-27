import { beforeEach, describe, expect, it, vi } from "vitest";

// The framework and the server modules are replaced so the handlers run as plain functions: what is under test is
// the order inside them (who may act, then the action), not TanStack or Supabase.
const h = vi.hoisted(() => ({
  ctx: { userId: "user-1", supabase: null as unknown },
  startConnect: vi.fn(),
  disconnectDrive: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = {
      middleware: () => b,
      inputValidator: (parse: (d: unknown) => unknown) => { b.parse = parse; return b; },
      parse: (d: unknown) => d,
      handler: (fn: (a: { data: unknown; context: unknown }) => unknown) => (arg?: { data?: unknown }) => fn({ data: b.parse(arg?.data), context: h.ctx }),
    };
    return b;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => ({ url: "https://app.ejemplo.test/integrations" }), setCookie: h.setCookie }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { admin: true } }));
vi.mock("@/lib/drive-connection.server", () => ({ startConnect: h.startConnect, disconnectDrive: h.disconnectDrive, oauthConfigured: () => true, nokkoDriveAvailable: () => true }));

import { MANAGE_DENIED } from "./drive-connection";
import { disconnectDriveFn, startDriveConnectFn } from "./drive-connection.functions";

/** A Supabase client that answers the two reads of currentOrg: the profile's company and the caller's role in it. */
const asRole = (role: string | null) => {
  h.ctx.supabase = {
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        single: async () => ({ data: { current_org_id: "org-1" } }),
        maybeSingle: async () => ({ data: role ? { role } : null }),
      };
      return q;
    },
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.startConnect.mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/v2/auth?x=1", nonce: "nonce-de-prueba" });
  h.disconnectDrive.mockResolvedValue({ email: "ana@ejemplo.test", revocation: "revoked", message: "ok" });
});

describe("CA-10 (SDD 5), CA-11 (SDD 10) · only the Owner connects or disconnects, checked in the server functions", () => {
  it.each(["member", "sales_leader", "viewer"])("a %s cannot start the connection: no URL, no cookie, no state made", async (role) => {
    asRole(role);
    await expect(startDriveConnectFn({ data: {} })).rejects.toThrow(MANAGE_DENIED);
    expect(h.startConnect).not.toHaveBeenCalled();
    expect(h.setCookie).not.toHaveBeenCalled();
  });
  it.each(["member", "sales_leader", "viewer"])("a %s cannot disconnect: nothing deleted, nothing revoked", async (role) => {
    asRole(role);
    await expect(disconnectDriveFn()).rejects.toThrow(MANAGE_DENIED);
    expect(h.disconnectDrive).not.toHaveBeenCalled();
  });
  it("someone who is not a member of the company is refused before anything else", async () => {
    asRole(null);
    await expect(startDriveConnectFn({ data: {} })).rejects.toThrow(/No eres miembro/);
    await expect(disconnectDriveFn()).rejects.toThrow(/No eres miembro/);
    expect(h.startConnect).not.toHaveBeenCalled();
    expect(h.disconnectDrive).not.toHaveBeenCalled();
  });
  it("the Owner starts the connection and gets the nonce as an httpOnly cookie", async () => {
    asRole("owner");
    expect(await startDriveConnectFn({ data: { returnTo: "/integrations" } })).toEqual({ url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
    expect(h.startConnect).toHaveBeenCalledWith("org-1", "user-1", "https://app.ejemplo.test", "/integrations");
    expect(h.setCookie).toHaveBeenCalledWith("nokko_oauth_drive", "nonce-de-prueba", expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: true }));
  });
  it("the Owner disconnects their own company with the privileged client", async () => {
    asRole("owner");
    expect(await disconnectDriveFn()).toMatchObject({ email: "ana@ejemplo.test" });
    expect(h.disconnectDrive).toHaveBeenCalledWith({ admin: true }, "org-1", "user-1");
  });
});
