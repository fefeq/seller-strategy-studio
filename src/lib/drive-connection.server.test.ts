import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { DRIVE_SCOPE } from "./drive-connection";
import { completeConnect, disconnectDrive, driveAuthFor, ownDriveAuth, startConnect } from "./drive-connection.server";
import { DriveError, nokkoAuth } from "./google-drive";
import { hashNonce, newNonce, signState, STATE_TTL_MS, verifyState } from "./oauth-state";
import { seal } from "./secret-box.server";

type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>, opts: { failDelete?: boolean } = {}) {
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
        if (op === "delete" && opts.failDelete) return res({ error: { message: "boom" } });
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
let calls: { url: string; body: string; signal?: AbortSignal | null }[];
let route: (url: string, body: string) => Response | Promise<Response>;

beforeEach(() => {
  process.env["INTEGRATION_KEYS_SECRET"] = SECRET;
  process.env["GOOGLE_OAUTH_CLIENT_ID"] = "cid.apps.googleusercontent.com";
  process.env["GOOGLE_OAUTH_CLIENT_SECRET"] = "csecret-de-prueba";
  calls = [];
  route = () => ok({});
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const body = init?.body ? String(init.body) : "";
    calls.push({ url, body, signal: init?.signal });
    return route(url, body);
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

const goodGoogle = (over: { scope?: string; refresh?: string | null; email?: string | null } = {}) => (url: string) => {
  if (url.includes("oauth2.googleapis.com/token")) return ok({ access_token: "acc", expires_in: 3600, scope: over.scope ?? DRIVE_SCOPE, ...(over.refresh === null ? {} : { refresh_token: over.refresh ?? "refresh-secreto" }) });
  if (url.includes("/drive/v3/about")) return ok(over.email === null ? { user: {} } : { user: { emailAddress: over.email ?? "Ana@Ejemplo.test" } });
  return ok({});
};
/** A state as startConnect makes it: it carries the hash of `n`, the nonce that only the cookie holds. */
const state = async (over: Partial<{ o: string; u: string; t: number; n: string }> = {}) => {
  const { n = newNonce(), ...rest } = over;
  return signState(SECRET, { p: "drive", o: ORG, u: USER, r: "/integrations", t: Date.now() + STATE_TTL_MS, h: await hashNonce(SECRET, n), ...rest });
};
/** What the callback receives for a flow started in this browser: a signed state and the cookie holding its nonce. */
const input = async (over: Partial<{ code: string | null; state: string | null; error: string | null; errorDescription: string | null; nonce: string | null }> = {}) => {
  const n = newNonce();
  return { code: "c", state: await state({ n }), error: null, errorDescription: null, nonce: n, ...over };
};
const owner = (extra: Record<string, Row[]> = {}, opts: { failDelete?: boolean } = {}) => fakeDb({ org_members: [{ org_id: ORG, user_id: USER, role: "owner" }], drive_connections: [], connection_events: [], ...extra }, opts);

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

describe("CA-3 (SDD 5), CA-6 (SDD 10) and the checking half of CA-5 (SDD 10; the result is shown after saving, not before) · check before saving", () => {
  it("saves the checked account sealed, lowercase, with who and when, and logs it (CA-3 of SDD 5; CA-2, CA-10 of SDD 10)", async () => {
    route = goodGoogle();
    const { db, tables, log } = owner();
    const r = await completeConnect(db, await input(), "https://app.ejemplo.test");
    expect(r).toMatchObject({ ok: true, returnTo: "/integrations" });
    expect(r).toMatchObject({ code: "ok", message: "Drive conectado." });
    const row = tables["drive_connections"]![0]!;
    expect(row).toMatchObject({ org_id: ORG, google_email: "ana@ejemplo.test", status: "active", connected_by: USER });
    expect(String(row["refresh_token_enc"])).toMatch(/^v1:/);
    expect(JSON.stringify(row)).not.toContain("refresh-secreto");
    expect(log.find((l) => l.table === "connection_events")?.row).toMatchObject({ provider: "drive", action: "connected", actor: USER, detail: "ana@ejemplo.test" });
  });

  it("does not save when Google granted less than asked, explains why, and revokes the token (CA-6 of SDD 10)", async () => {
    route = goodGoogle({ scope: "openid" });
    const { db, tables } = owner();
    const r = await completeConnect(db, await input(), "https://app.ejemplo.test");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/permiso de Drive/);
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls.some((c) => c.url.includes("/revoke"))).toBe(true);
  });

  describe("a token from an incomplete consent is revoked only when that cannot cut an account in use (CA-6 and CA-8 of SDD 10)", () => {
    const row = async (org: string, email: string) => ({ org_id: org, google_email: email, refresh_token_enc: await seal("refresh-guardado"), status: "active" });
    const revoked = () => calls.filter((c) => c.url.includes("/revoke"));
    const OTHER = "44444444-4444-4444-4444-444444444444";

    it("another account than the saved one and unused elsewhere: revoked", async () => {
      route = goodGoogle({ scope: "openid", email: "nueva@ejemplo.test" });
      const { db, tables } = owner({ drive_connections: [await row(ORG, "vieja@ejemplo.test")] });
      expect((await completeConnect(db, await input(), "https://app.ejemplo.test")).ok).toBe(false);
      expect(revoked()).toHaveLength(1);
      expect(revoked()[0]!.body).toContain("refresh-secreto");
      expect(tables["drive_connections"]![0]!["google_email"]).toBe("vieja@ejemplo.test");
    });
    it("the same account this company already has saved: not revoked (it would cut the saved connection)", async () => {
      route = goodGoogle({ scope: "openid", email: "ana@ejemplo.test" });
      const { db, tables } = owner({ drive_connections: [await row(ORG, "ana@ejemplo.test")] });
      expect((await completeConnect(db, await input(), "https://app.ejemplo.test")).ok).toBe(false);
      expect(revoked()).toHaveLength(0);
      expect(tables["drive_connections"]).toHaveLength(1);
    });
    it("an account another company uses: not revoked", async () => {
      route = goodGoogle({ scope: "openid", email: "compartida@ejemplo.test" });
      const { db } = owner({ drive_connections: [await row(OTHER, "compartida@ejemplo.test")] });
      expect((await completeConnect(db, await input(), "https://app.ejemplo.test")).ok).toBe(false);
      expect(revoked()).toHaveLength(0);
    });
    it("an account whose email is unknown: not revoked, and the log says so without the token", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      route = goodGoogle({ scope: "openid", email: null });
      const { db } = owner();
      expect((await completeConnect(db, await input(), "https://app.ejemplo.test")).ok).toBe(false);
      expect(revoked()).toHaveLength(0);
      expect(warn.mock.calls.map(String).join("\n")).toMatch(/account unknown/);
      expect(warn.mock.calls.map(String).join("\n")).not.toContain("refresh-secreto");
      warn.mockRestore();
    });
  });

  it("does not save when the account cannot be checked (CA-5 of SDD 10)", async () => {
    route = goodGoogle({ email: null });
    const { db, tables } = owner();
    const r = await completeConnect(db, await input(), "https://app.ejemplo.test");
    expect(r.ok).toBe(false);
    expect(tables["drive_connections"]).toHaveLength(0);
  });

  it("returns without changes when the person cancels at Google (§8)", async () => {
    const { db, tables } = owner();
    const r = await completeConnect(db, await input({ code: null, error: "access_denied" }), "https://app.ejemplo.test");
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
    const r = await completeConnect(db, await input(), "https://app.ejemplo.test");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Solo el Owner/);
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
  it("an expired or forged state saves nothing and never calls Google", async () => {
    const { db, tables } = owner();
    for (const bad of [await state({ t: Date.now() - 1 }), "forjado.forjado", ""]) {
      const r = await completeConnect(db, await input({ state: bad }), "https://app.ejemplo.test");
      expect(r.ok).toBe(false);
    }
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe("CA-17 (SDD 10) · the callback only finishes in the browser that started it, once", () => {
  it("startConnect puts only the hash of the nonce in the signed state and hands the nonce back for the cookie", async () => {
    const { url, nonce } = await startConnect(ORG, USER, "https://app.ejemplo.test", "/");
    const token = new URL(url).searchParams.get("state")!;
    const st = await verifyState(SECRET, token);
    expect(nonce.length).toBeGreaterThanOrEqual(32);
    expect(st?.h).toBe(await hashNonce(SECRET, nonce));
    expect(st?.h).not.toBe(nonce);
    expect(token).not.toContain(nonce);
    expect(JSON.stringify(st)).not.toContain(nonce);
  });
  it("a leaked state does not bind to another browser: a cookie built from what the state shows is rejected, the real one works", async () => {
    route = goodGoogle();
    const { url, nonce } = await startConnect(ORG, USER, "https://app.ejemplo.test", "/");
    const leaked = new URL(url).searchParams.get("state")!;
    // The attacker reads everything the signed state shows (it is signed, not encrypted) and tries each value as the cookie.
    const shown = (await verifyState(SECRET, leaked))!;
    const body = JSON.parse(atob(leaked.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    for (const forged of [shown.h, ...Object.values(body).map(String)]) {
      const { db, tables } = owner();
      const r = await completeConnect(db, { code: "c", state: leaked, error: null, errorDescription: null, nonce: forged }, "https://app.ejemplo.test");
      expect(r).toMatchObject({ ok: false, code: "wrong_browser" });
      expect(tables["drive_connections"]).toHaveLength(0);
    }
    expect(calls).toHaveLength(0);
    // Rejections do not spend the state: the browser that started it still finishes.
    const { db, tables } = owner();
    expect((await completeConnect(db, { code: "c", state: leaked, error: null, errorDescription: null, nonce }, "https://app.ejemplo.test")).ok).toBe(true);
    expect(tables["drive_connections"]).toHaveLength(1);
  });
  it("a valid state without the right cookie is rejected: nothing saved, Google never called", async () => {
    route = goodGoogle();
    for (const nonce of [null, "", newNonce()]) {
      const { db, tables } = owner();
      const r = await completeConnect(db, await input({ nonce }), "https://app.ejemplo.test");
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/en este navegador/);
      expect(tables["drive_connections"]).toHaveLength(0);
    }
    expect(calls).toHaveLength(0);
  });
  it("a state that was already used is rejected even with the same cookie", async () => {
    route = goodGoogle();
    const { db, tables } = owner();
    const again = await input();
    expect((await completeConnect(db, again, "https://app.ejemplo.test")).ok).toBe(true);
    const callsAfterFirst = calls.length;
    tables["drive_connections"] = [];
    const r = await completeConnect(db, again, "https://app.ejemplo.test");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/ya se usó/);
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls).toHaveLength(callsAfterFirst);
  });
  it("a cancelled flow also spends the nonce", async () => {
    const { db } = owner();
    const cancelled = await input({ code: null, error: "access_denied" });
    expect((await completeConnect(db, cancelled, "https://app.ejemplo.test")).message).toMatch(/Cancelaste/);
    expect((await completeConnect(db, cancelled, "https://app.ejemplo.test")).message).toMatch(/ya se usó/);
  });
});

describe("CA-7 (SDD 10) · changing account", () => {
  it("replaces the account, logs «changed», revokes the old token and keeps one row", async () => {
    route = goodGoogle({ email: "nueva@ejemplo.test" });
    const old = await seal("refresh-antiguo");
    const { db, tables, log } = owner({ drive_connections: [{ org_id: ORG, google_email: "vieja@ejemplo.test", refresh_token_enc: old, status: "active" }] });
    const r = await completeConnect(db, await input(), "https://app.ejemplo.test");
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
    expect(await disconnectDrive(db, ORG, USER)).toMatchObject({ email: "ana@ejemplo.test", revocation: "revoked" });
    expect(tables["drive_connections"]).toHaveLength(0);
    expect(calls.some((c) => c.url.includes("/revoke") && c.body.includes("refresh-secreto"))).toBe(true);
    expect(log.find((l) => l.table === "connection_events")?.row).toMatchObject({ action: "disconnected", actor: USER });
    expect(await ownDriveAuth(db, ORG)).toBeNull();
    expect(await driveAuthFor(db, ORG)).toBe(nokkoAuth);
  });
});

describe("CA-8 (SDD 10) and CA-4 (SDD 5) · the screen says what really happened at Google", () => {
  const row = async (org: string, email: string, token = "refresh-secreto") => ({ org_id: org, google_email: email, refresh_token_enc: await seal(token), status: "active" });
  const OTHER = "44444444-4444-4444-4444-444444444444";
  const revoked = () => calls.filter((c) => c.url.includes("/revoke"));

  it("changing to the same account revokes nothing (the new token shares the old one's grant)", async () => {
    route = goodGoogle({ email: "ana@ejemplo.test" });
    const { db } = owner({ drive_connections: [await row(ORG, "ana@ejemplo.test", "refresh-antiguo")] });
    const r = await completeConnect(db, await input(), "https://app.ejemplo.test");
    expect(r.ok).toBe(true);
    expect(revoked()).toHaveLength(0);
    expect(r.message).toMatch(/misma cuenta/);
  });
  it("changing away from an account another company also uses revokes nothing and says why", async () => {
    route = goodGoogle({ email: "nueva@ejemplo.test" });
    const { db, tables } = owner({ drive_connections: [await row(ORG, "compartida@ejemplo.test", "refresh-antiguo"), await row(OTHER, "compartida@ejemplo.test", "refresh-otra")] });
    const r = await completeConnect(db, await input(), "https://app.ejemplo.test");
    expect(r.ok).toBe(true);
    expect(revoked()).toHaveLength(0);
    expect(r.message).toMatch(/sigue conectada en otra empresa/);
    expect(tables["drive_connections"]!.find((x) => x["org_id"] === OTHER)).toBeTruthy();
  });
  it("a refused or unanswered revocation is reported as not done, never as revoked", async () => {
    route = (url) => (url.includes("/revoke") ? ok({ error: "invalid_token" }, 400) : goodGoogle({ email: "nueva@ejemplo.test" })(url));
    const a = owner({ drive_connections: [await row(ORG, "vieja@ejemplo.test")] });
    const r = await completeConnect(a.db, await input(), "https://app.ejemplo.test");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/No pudimos revocar el acceso en Google/);
    expect(r.message).not.toMatch(/confirmó/);

    const b = owner({ drive_connections: [await row(ORG, "ana@ejemplo.test")] });
    route = () => { throw new Error("red caída"); };
    const d = await disconnectDrive(b.db, ORG, USER);
    expect(d.revocation).toBe("failed");
    expect(d.message).toMatch(/No pudimos revocar/);
    expect(b.tables["drive_connections"]).toHaveLength(0);
  });
  it("disconnecting confirms the revocation only when Google answered 2xx, and logs the result", async () => {
    const { db, log } = owner({ drive_connections: [await row(ORG, "ana@ejemplo.test")] });
    const d = await disconnectDrive(db, ORG, USER);
    expect(d).toMatchObject({ revocation: "revoked" });
    expect(d.message).toMatch(/Google confirmó/);
    expect(String(log.find((l) => l.table === "connection_events")?.row?.["detail"])).toMatch(/Google confirmó/);
  });
  it("disconnecting an account another company also uses leaves Google's access alone", async () => {
    const { db, tables } = owner({ drive_connections: [await row(ORG, "compartida@ejemplo.test"), await row(OTHER, "compartida@ejemplo.test", "refresh-otra")] });
    const d = await disconnectDrive(db, ORG, USER);
    expect(d.revocation).toBe("shared");
    expect(revoked()).toHaveLength(0);
    expect(tables["drive_connections"]!.map((x) => x["org_id"])).toEqual([OTHER]);
  });
  it("the row is deleted before Google is called, and the revoke call carries a timeout (CA-8 of SDD 10)", async () => {
    const { db, tables } = owner({ drive_connections: [await row(ORG, "ana@ejemplo.test")] });
    let rowsWhenRevoking = -1;
    route = (url) => { if (url.includes("/revoke")) rowsWhenRevoking = tables["drive_connections"]!.length; return ok({}); };
    expect((await disconnectDrive(db, ORG, USER)).revocation).toBe("revoked");
    expect(rowsWhenRevoking).toBe(0);
    expect(revoked()[0]!.signal).toBeInstanceOf(AbortSignal);
  });
  it("a revoke that does not answer in time is reported as not done, and the account is already disconnected", async () => {
    const { db, tables } = owner({ drive_connections: [await row(ORG, "ana@ejemplo.test")] });
    route = () => { throw new DOMException("The operation timed out.", "TimeoutError"); };
    const d = await disconnectDrive(db, ORG, USER);
    expect(d.revocation).toBe("failed");
    expect(d.message).toMatch(/No pudimos revocar/);
    expect(tables["drive_connections"]).toHaveLength(0);
  });
  it("when the row cannot be deleted nothing is revoked and the person is told", async () => {
    const { db, tables } = owner({ drive_connections: [await row(ORG, "ana@ejemplo.test")] }, { failDelete: true });
    await expect(disconnectDrive(db, ORG, USER)).rejects.toThrow(/No se pudo desconectar/);
    expect(revoked()).toHaveLength(0);
    expect(tables["drive_connections"]).toHaveLength(1);
  });
  it("an unreadable saved token cannot be revoked and says so", async () => {
    const { db } = owner({ drive_connections: [{ org_id: ORG, google_email: "ana@ejemplo.test", refresh_token_enc: "v1:basura", status: "active" }] });
    expect((await disconnectDrive(db, ORG, USER)).revocation).toBe("unreadable");
    expect(revoked()).toHaveLength(0);
  });
});

describe("CA-8 (SDD 10) and CA-4 (SDD 5) · no instance keeps using an account that was changed or disconnected", () => {
  const ORG3 = "55555555-5555-5555-5555-555555555555";
  const refreshRoute = () => {
    let n = 0;
    route = (url, body) => (url.includes("/token") ? ok({ access_token: `acceso-${++n}:${new URLSearchParams(body).get("refresh_token")}`, expires_in: 3600 }) : ok({}));
  };
  it("another instance's cached access token is not reused once the saved account is a different one", async () => {
    refreshRoute();
    const t = { org_id: ORG3, google_email: "vieja@ejemplo.test", refresh_token_enc: await seal("refresh-viejo"), status: "active" };
    const { db, tables } = owner({ drive_connections: [t] });
    const first = await (await ownDriveAuth(db, ORG3))!.headers();
    expect(first["Authorization"]).toContain("refresh-viejo");
    // another instance replaces the account; this instance's map was never told
    tables["drive_connections"] = [{ ...t, google_email: "nueva@ejemplo.test", refresh_token_enc: await seal("refresh-nuevo") }];
    const second = await (await ownDriveAuth(db, ORG3))!.headers();
    expect(second["Authorization"]).toContain("refresh-nuevo");
    expect(second["Authorization"]).not.toContain("refresh-viejo");
  });
  it("the same auth object does not refresh with a token that was replaced or deleted on this instance (CA-8 of SDD 10, CA-4 of SDD 5)", async () => {
    let n = 0;
    route = (url, body) => {
      const p = new URLSearchParams(body);
      if (url.includes("/token")) return p.get("grant_type") === "authorization_code"
        ? ok({ access_token: "acc", expires_in: 3600, scope: DRIVE_SCOPE, refresh_token: "refresh-nuevo" })
        : ok({ access_token: `acceso-${++n}:${p.get("refresh_token")}`, expires_in: 3600 });
      if (url.includes("/drive/v3/about")) return ok({ user: { emailAddress: "nueva@ejemplo.test" } });
      return ok({});
    };
    const { db } = owner({ drive_connections: [{ org_id: ORG, google_email: "vieja@ejemplo.test", refresh_token_enc: await seal("refresh-viejo"), status: "active" }] });
    const auth = (await ownDriveAuth(db, ORG))!;
    expect((await auth.headers())["Authorization"]).toContain("refresh-viejo");
    // The company changes account on this instance: the row is replaced and the cached access token forgotten.
    expect((await completeConnect(db, await input(), "https://app.ejemplo.test")).ok).toBe(true);
    const changed = await auth.headers();
    expect(changed["Authorization"]).toContain("refresh-nuevo");
    expect(changed["Authorization"]).not.toContain("refresh-viejo");
    // Then it disconnects: the old object must not bring the account back from the token it was made with.
    await disconnectDrive(db, ORG, USER);
    const refreshes = () => calls.filter((c) => c.url.includes("/token") && c.body.includes("refresh_token=")).length;
    const before = refreshes();
    await expect(auth.headers()).rejects.toMatchObject({ status: 401 });
    expect(refreshes()).toBe(before);
  });
  it("a cached access token is reused for the same saved account, but only for five minutes", async () => {
    refreshRoute();
    const { db } = owner({ drive_connections: [{ org_id: ORG3, google_email: "ana@ejemplo.test", refresh_token_enc: await seal("refresh-uno"), status: "active" }] });
    vi.useFakeTimers();
    try {
      const auth = (await ownDriveAuth(db, ORG3))!;
      await auth.headers(); await auth.headers();
      expect(calls.filter((c) => c.url.includes("/token"))).toHaveLength(1);
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
      await auth.headers();
      expect(calls.filter((c) => c.url.includes("/token"))).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });
  it("a failed revocation is not swallowed: it is logged (without the token) and shown to the person", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    route = () => ok({ error: "invalid_token" }, 400);
    const { db } = owner({ drive_connections: [{ org_id: ORG3, google_email: "ana@ejemplo.test", refresh_token_enc: await seal("refresh-secreto"), status: "active" }] });
    const d = await disconnectDrive(db, ORG3, USER);
    expect(d.message).toMatch(/No pudimos revocar/);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).not.toContain("refresh-secreto");
    warn.mockRestore();
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
