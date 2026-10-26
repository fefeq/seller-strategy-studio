import { describe, expect, it } from "vitest";
import type { Audit, ConnectionRow, Provider } from "./connections";
import { connectAccount, disconnectAccount, type Checker, type Deps, type Store } from "./connections-core";

// Fictitious provider and credentials: nothing here touches a real service or a real key.
const FAKE: Provider = { id: "fakeprov", name: "Proveedor Prueba", purpose: "Sirve para probar las conexiones.", kind: "key", ownAccount: true, nokkoEnv: [] };
const FAKE_OAUTH: Provider = { ...FAKE, id: "fakeoauth", name: "Google Prueba", kind: "oauth" };
const KEY = "clave-ficticia-123";

function fakeStore(others = 0) {
  const rows = new Map<string, ConnectionRow>();
  const events: { orgId: string; provider: string; audit: Audit; userId: string }[] = [];
  const store: Store = {
    async get(o, p) { return rows.get(`${o}:${p}`) ?? null; },
    async save(o, p, r) { rows.set(`${o}:${p}`, { provider: p, status: "connected", account_label: r.accountLabel, connected_by: r.userId, connected_at: "2026-10-26T10:00:00Z", last_error: null }); },
    async remove(o, p) { rows.delete(`${o}:${p}`); },
    async othersWithAccount() { return others; },
    async event(orgId, provider, audit, userId) { events.push({ orgId, provider, audit, userId }); },
  };
  return { store, rows, events };
}

function setup(check: Checker, over: { others?: number; withVault?: boolean } = {}) {
  const f = fakeStore(over.others ?? 0);
  const sealed: string[] = [];
  const discarded: string[] = [];
  const deps: Deps = {
    store: f.store, providers: [FAKE, FAKE_OAUTH], checkers: { fakeprov: check, fakeoauth: check },
    ...(over.withVault === false ? {} : { storeCredential: async (_o: string, p: string) => { sealed.push(p); }, discardCredential: async (_o: string, p: string) => { discarded.push(p); } }),
  };
  return { ...f, deps, sealed, discarded };
}
const input = (over: Record<string, unknown> = {}) => ({ orgId: "org-a", userId: "user-1", role: "owner" as string | null, provider: "fakeprov", credential: KEY, mode: "save" as const, ...over });
const ok: Checker = async () => ({ ok: true, accountLabel: "ventas@acme.test" });

describe("CA-4 and CA-5 connect: check, then save", () => {
  it("saves the account, keeps the credential only through the vault port and audits it (CA-10)", async () => {
    const t = setup(ok);
    const r = await connectAccount(input(), t.deps);
    expect(r).toEqual({ ok: true, saved: true, accountLabel: "ventas@acme.test", message: "Funciona. Cuenta: ventas@acme.test." });
    expect(t.rows.get("org-a:fakeprov")).toMatchObject({ account_label: "ventas@acme.test", connected_by: "user-1" });
    expect(t.sealed).toEqual(["fakeprov"]);
    expect(t.events).toEqual([{ orgId: "org-a", provider: "fakeprov", audit: { action: "connected", accountLabel: "ventas@acme.test" }, userId: "user-1" }]);
    expect(JSON.stringify([...t.rows.values()])).not.toContain(KEY);
    expect(JSON.stringify(r)).not.toContain(KEY);
  });
  it("only shows the result in check mode, without saving anything", async () => {
    const t = setup(ok);
    const r = await connectAccount(input({ mode: "check" }), t.deps);
    expect(r).toMatchObject({ ok: true, saved: false, accountLabel: "ventas@acme.test", needsConfirmation: false });
    expect(t.rows.size).toBe(0);
    expect(t.sealed).toEqual([]);
    expect(t.events).toEqual([]);
  });
  it("works for the OAuth kind through the same path (any provider, no redesign)", async () => {
    const t = setup(ok);
    expect(await connectAccount(input({ provider: "fakeoauth" }), t.deps)).toMatchObject({ ok: true, saved: true });
  });
});

describe("CA-6 a failed check saves nothing", () => {
  it("explains the reason and keeps no row, credential or connection event", async () => {
    const t = setup(async () => ({ ok: false, reason: "La clave no es válida." }));
    const r = await connectAccount(input(), t.deps);
    expect(r).toMatchObject({ ok: false, message: "La clave no es válida. No hemos guardado la conexión.", retry: false });
    expect(t.rows.size).toBe(0);
    expect(t.sealed).toEqual([]);
    expect(t.events.map((e) => e.audit.action)).toEqual(["check_failed"]);
  });
  it("treats a provider that throws as not answering, and asks to retry", async () => {
    const t = setup(async () => { throw new Error("ECONNRESET"); });
    const r = await connectAccount(input(), t.deps);
    expect(r).toMatchObject({ ok: false, retry: true });
    expect(t.rows.size).toBe(0);
    expect(t.events).toEqual([]);
  });
  it("does not save an account label shaped like a key", async () => {
    const t = setup(async () => ({ ok: true, accountLabel: "sk_test_abcdefghijklmnopqrstuvwx" }));
    expect(await connectAccount(input(), t.deps)).toMatchObject({ ok: false });
    expect(t.rows.size).toBe(0);
  });
});

describe("CA-7 change account", () => {
  it("replaces the connected account and audits it as a change", async () => {
    const t = setup(ok);
    await connectAccount(input(), t.deps);
    const t2 = { ...t, deps: { ...t.deps, checkers: { fakeprov: async () => ({ ok: true as const, accountLabel: "otra@acme.test" }) } } };
    await connectAccount(input(), t2.deps);
    expect(t.rows.get("org-a:fakeprov")!.account_label).toBe("otra@acme.test");
    expect(t.events.map((e) => e.audit.action)).toEqual(["connected", "changed"]);
  });
});

describe("CA-8 disconnect", () => {
  it("drops the credential and the row at once, says the data stays and audits it", async () => {
    const t = setup(ok);
    await connectAccount(input(), t.deps);
    const r = await disconnectAccount({ orgId: "org-a", userId: "user-1", role: "owner", provider: "fakeprov" }, t.deps);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/deja de usar tu cuenta de Proveedor Prueba ahora mismo.*no se borra/);
    expect(t.rows.size).toBe(0);
    expect(t.discarded).toEqual(["fakeprov"]);
    expect(t.events.at(-1)!.audit).toEqual({ action: "disconnected", accountLabel: "ventas@acme.test" });
  });
  it("refuses when there is nothing connected", async () => {
    const t = setup(ok);
    expect((await disconnectAccount({ orgId: "org-a", userId: "user-1", role: "owner", provider: "fakeprov" }, t.deps)).ok).toBe(false);
  });
});

describe("CA-11 roles", () => {
  it.each(["sales_leader", "member", "viewer", null])("%s cannot connect or disconnect", async (role) => {
    const t = setup(ok);
    const c = await connectAccount(input({ role }), t.deps);
    expect(c).toMatchObject({ ok: false, message: expect.stringMatching(/Solo el Owner/) });
    expect((await disconnectAccount({ orgId: "org-a", userId: "user-1", role, provider: "fakeprov" }, t.deps)).message).toMatch(/Solo el Owner/);
    expect(t.rows.size).toBe(0);
  });
});

describe("section 8 edge cases", () => {
  it("asks for confirmation when the account is connected in another company, and saves after it", async () => {
    const t = setup(ok, { others: 1 });
    const first = await connectAccount(input(), t.deps);
    expect(first).toMatchObject({ ok: true, saved: false, needsConfirmation: true, message: expect.stringMatching(/otra empresa/) });
    expect(t.rows.size).toBe(0);
    expect(await connectAccount(input({ confirmShared: true }), t.deps)).toMatchObject({ ok: true, saved: true });
  });
  it("says only NOKKO provides it when own accounts are not available for the provider", async () => {
    const t = setup(ok);
    t.deps.providers = [{ ...FAKE, ownAccount: false }];
    expect(await connectAccount(input(), t.deps)).toMatchObject({ ok: false, message: expect.stringMatching(/solo la proporciona NOKKO/) });
  });
  it("does not keep a connection when there is no credential store yet", async () => {
    const t = setup(ok, { withVault: false });
    const r = await connectAccount(input(), t.deps);
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/almacén cifrado/) });
    expect(t.rows.size).toBe(0);
  });
  it("leaves no row when sealing the credential fails", async () => {
    const t = setup(ok);
    t.deps.storeCredential = async () => { throw new Error("boom"); };
    await expect(connectAccount(input(), t.deps)).rejects.toThrow("boom");
    expect(t.rows.size).toBe(0);
  });
  it("refuses an empty or oversized credential and a panel provider", async () => {
    const t = setup(ok);
    expect(await connectAccount(input({ credential: "   " }), t.deps)).toMatchObject({ ok: false });
    expect(await connectAccount(input({ credential: "x".repeat(5000) }), t.deps)).toMatchObject({ ok: false });
    t.deps.providers = [{ ...FAKE, kind: "panel" }];
    expect(await connectAccount(input(), t.deps)).toMatchObject({ ok: false, message: expect.stringMatching(/propio panel/) });
  });
  it("is isolated by company: another org's connection is not touched", async () => {
    const t = setup(ok);
    await connectAccount(input(), t.deps);
    await connectAccount(input({ orgId: "org-b", userId: "user-2" }), t.deps);
    await disconnectAccount({ orgId: "org-a", userId: "user-1", role: "owner", provider: "fakeprov" }, t.deps);
    expect(t.rows.has("org-b:fakeprov")).toBe(true);
    expect(t.rows.has("org-a:fakeprov")).toBe(false);
  });
});
