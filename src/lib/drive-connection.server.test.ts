import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { DRIVE_SCOPE } from "./drive-connection";
import { completeConnect, disconnectDrive, driveAuthFor, ownDriveAuth, startConnect } from "./drive-connection.server";
import { DriveError, nokkoAuth } from "./google-drive";
import { signState, STATE_TTL_MS } from "./oauth-state";
import { seal } from "./secret-box.server";

type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>) {
  const log: { table: string; op: string; row?: Row }[] = [];
  const from = (table: string) => {
    const filters: [string, "eq" | "neq", unknown][] = [];
    let op = "select"; let payload: Row = {}; let head = false;
    const rows = () => (tables[table] ??= []).filter((r) => filters.every(([k, o, v]) => (o === "eq" ? r[k] === v : r[k] !== v)));
    const q = {
      select(_c?: string, opts?: { head?: boolean }) { if (op === "select") head = !!opts?.head; return q; },
      eq(k: string, v: unknown) { filters.push([k, "eq", v]); return q; },
      neq(k: string, v: unknown) { filters.push([k, "neq", v]); return q; },
      insert(row: Row) { op = "insert"; log.push({ table, op, row }); (tables[table] ??= []).push(row); return q; },
      upsert(row: Row) { op = "upsert"; log.push({ table, op, row }); tables[table] = [...(tables[table] ?? []).filter((r) => r["org_id"] !== row["org_id"]), row]; return q; },
      update(p: Row) { op = "update"; payload = p; return q; },
      delete() { op = "delete"; return q; },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then(res: (v: unknown) => unknown) {
        if (op === "update") { const hit = rows(); hit.forEach((r) => Object.assign(r, payload)); log.push({ table, op, row: payload }); return res({ error: null }); }
        if (op === "delete") { const hit = rows(); tables[table] = (tables[table] ?? []).filter((r) => !hit.includes(r)); log.push({ table, op }); return res({ error: null }); }
        if (op === "insert" || op === "upsert") return res({ error: null });
        return res(head ? { count: rows().length, error: null } : { data: rows(), error: null });
      },
    };
    return q;
  };
  return { db: { from } as unknown as SupabaseClient<Database>, tables, log };
}

const SECRET = "secreto-de-prueba";
const ORG = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let calls: { url: string; body: string }[];
let route: (url: string, body: string) => Response | Promise<Response>;

beforeEach(() => {
  process.env["INTEGRATION_KEYS_SECRET"] = SECRET;
  process.env["GOOGLE_OAUTH_CLIENT_ID"] = "cid.apps.googleusercontent.com";
  process.env["GOOGLE_OAUTH_CLIENT_SECRET"] = "csecret-de-prueba";
  calls = [];
  route = () => ok({});
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const body = init?.body ? String(init.body) : "";
    calls.push({ url, body });
    return route(url, body);
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

const goodGoogle = (over: { scope?: string; refresh?: string | null; email?: string | null } = {}) => (url: string) => {
  if (url.includes("oauth2.googleapis.com/token")) return ok({ access_token: "acc", expires_in: 3600, scope: over.scope ?? DRIVE_SCOPE, ...(over.refresh === null ? {} : { refresh_token: over.refresh ?? "refresh-secreto" }) });
  if (url.includes("/drive/v3/about")) return ok(over.email === null ? { user: {} } : { user: { emailAddress: over.email ?? "Ana@Ejemplo.test" } });
  return ok({});
};
const state = (over: Partial<{ o: string; u: string; t: number }> = {}) => signState(SECRET, { p: "drive", o: ORG, u: USER, r: "/integrations", t: Date.now() + STATE_TTL_MS, ...over });
const owner = (extra: Record<string, Row[]> = {}) => fakeDb({ org_members: [{ org_id: ORG, user_id: USER, role: "owner" }], drive_connections: [], connection_events: [], ...extra });

describe("CA-1, CA-2 (SDD 5) · the consent starts only for a configured server", () => {
  it("builds Google's URL with a signed state, and refuses when the server has no OAuth client", async () => {
    const { url } = await startConnect(ORG, USER, "https://app.ejemplo.test", "/onboarding");
    const u = new URL(url);
    expect(u.searchParams.get("scope")).toBe(DRIVE_SCOPE);
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.ejemplo.test/api/public/drive/callback");
    delete process.env["GOOGLE_OAUTH_CLIENT_ID"];
    await expect(startConnect(ORG, USER, "https://app.ejemplo.test", "/")).rejects.toThrow(/configurar/);
  });
});

describe("CA-3, CA-5, CA-6 (SDD 5) · check before saving", () => {
  it("saves the checked account sealed, lowercase, with who and when, and logs it (CA-3; CA-10 of SDD 10)", async () => {
    route = goodGoogle();
    const { db, tables, log } = owner();
    const r = await completeConnect(db, { code: "c", state: await state(), error: null, errorDescription: null }, "https://app.ejemplo.test");
    expect(r).toMatchObject({ ok: true, returnTo: "/integrations" });
    expect(r.message).toContain("ana@ejemplo.test");
    const row = tables["drive_connections"]![0]!;
    expect(row).toMatchObject({ org_id: ORG, google_email: "ana@ejemplo.test", status: "active", connected_by: USER });
    expect(String(row["refresh_token_enc"])).toMatch(/^v1:/);
    expect(JSON.stringify(row)).not.toContain("refresh-secreto");
    expect(log.find((l) => l.table === "connection_events")?.row).toMatchObject({ provider: "drive", action: "connected", actor: USER, detail: "ana@ejemplo.test" });
  });

  it("does not save when Google granted less than asked, explains why, and revokes the token (CA-6)", async () => {
    route = goodGoogle({ scope: "openid" });
    const { db, tables } = owner();
    const r = await completeConnect(db, { code: "c", state: await state(), error: null, errorDescription: null }, "https://app.ejemplo.test");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/permiso de Drive/);
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls.some((c) => c.url.includes("/revoke"))).toBe(true);
  });

  it("does not save when the account cannot be checked (CA-5)", async () => {
    route = goodGoogle({ email: null });
    const { db, tables } = owner();
    const r = await completeConnect(db, { code: "c", state: await state(), error: null, errorDescription: null }, "https://app.ejemplo.test");
    expect(r.ok).toBe(false);
    expect(tables["drive_connections"]).toHaveLength(0);
  });

  it("returns without changes when the person cancels at Google (§8)", async () => {
    const { db, tables } = owner();
    const r = await completeConnect(db, { code: null, state: await state(), error: "access_denied", errorDescription: null }, "https://app.ejemplo.test");
    expect(r).toMatchObject({ ok: false, returnTo: "/integrations" });
    expect(r.message).toMatch(/No se ha cambiado nada/);
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe("CA-10 (SDD 5) · only the Owner, and only with a valid state", () => {
  it("a member who is not Owner cannot finish a connection", async () => {
    route = goodGoogle();
    const { db, tables } = fakeDb({ org_members: [{ org_id: ORG, user_id: USER, role: "member" }], drive_connections: [], connection_events: [] });
    const r = await completeConnect(db, { code: "c", state: await state(), error: null, errorDescription: null }, "https://app.ejemplo.test");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Solo el Owner/);
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
  it("an expired or forged state saves nothing and never calls Google", async () => {
    const { db, tables } = owner();
    for (const bad of [await state({ t: Date.now() - 1 }), "forjado.forjado", ""]) {
      const r = await completeConnect(db, { code: "c", state: bad, error: null, errorDescription: null }, "https://app.ejemplo.test");
      expect(r.ok).toBe(false);
    }
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe("CA-7 (SDD 5) · changing account", () => {
  it("replaces the account, logs «changed», revokes the old token and keeps one row", async () => {
    route = goodGoogle({ email: "nueva@ejemplo.test" });
    const old = await seal("refresh-antiguo");
    const { db, tables, log } = owner({ drive_connections: [{ org_id: ORG, google_email: "vieja@ejemplo.test", refresh_token_enc: old, status: "active" }] });
    const r = await completeConnect(db, { code: "c", state: await state(), error: null, errorDescription: null }, "https://app.ejemplo.test");
    expect(r.ok).toBe(true);
    expect(tables["drive_connections"]).toHaveLength(1);
    expect(tables["drive_connections"]![0]!["google_email"]).toBe("nueva@ejemplo.test");
    expect(log.find((l) => l.table === "connection_events")?.row?.["action"]).toBe("changed");
    expect(calls.some((c) => c.url.includes("/revoke") && c.body.includes("refresh-antiguo"))).toBe(true);
  });
});

describe("CA-4 (SDD 5) · disconnecting stops the use at once", () => {
  it("revokes at Google, deletes the token, logs it, and the company falls back to NOKKO's account", async () => {
    const { db, tables, log } = owner({ drive_connections: [{ org_id: ORG, google_email: "ana@ejemplo.test", refresh_token_enc: await seal("refresh-secreto"), status: "active" }] });
    expect(await ownDriveAuth(db, ORG)).not.toBeNull();
    expect(await disconnectDrive(db, ORG, USER)).toEqual({ email: "ana@ejemplo.test" });
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls.some((c) => c.url.includes("/revoke") && c.body.includes("refresh-secreto"))).toBe(true);
    expect(log.find((l) => l.table === "connection_events")?.row).toMatchObject({ action: "disconnected", actor: USER });
    expect(await ownDriveAuth(db, ORG)).toBeNull();
    expect(await driveAuthFor(db, ORG)).toBe(nokkoAuth);
  });
});

describe("§8 (SDD 5) · access revoked at Google, provider down", () => {
  const connected = async () => owner({ drive_connections: [{ org_id: "33333333-3333-3333-3333-333333333333", google_email: "ana@ejemplo.test", refresh_token_enc: await seal("refresh-secreto"), status: "active" }] });
  const ORG2 = "33333333-3333-3333-3333-333333333333";

  it("a refused refresh marks the connection «error», keeps it, and never borrows NOKKO's account", async () => {
    route = (url) => (url.includes("/token") ? ok({ error: "invalid_grant" }, 400) : ok({}));
    const { db, tables, log } = await connected();
    const auth = await driveAuthFor(db, ORG2);
    expect(auth).not.toBe(nokkoAuth);
    await expect(auth.headers()).rejects.toBeInstanceOf(DriveError);
    expect(tables["drive_connections"]).toHaveLength(1);
    expect(tables["drive_connections"]![0]!["status"]).toBe("error");
    expect(log.filter((l) => l.table === "connection_events" && l.row?.["action"] === "failed")).toHaveLength(1);
  });

  it("Google being down is «no_response», not a disconnection", async () => {
    route = (url) => (url.includes("/token") ? ok({}, 503) : ok({}));
    const { db, tables } = await connected();
    const auth = (await ownDriveAuth(db, ORG2))!;
    await expect(auth.headers()).rejects.toMatchObject({ status: 503 });
    expect(tables["drive_connections"]![0]!["status"]).toBe("no_response");
  });
});
