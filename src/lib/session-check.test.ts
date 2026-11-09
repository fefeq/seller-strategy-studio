// NK-0098: one GET /auth/v1/user per page load and per session change, not one per navigation.
// The Supabase auth client is a fake that counts calls. Fictional tokens and ids, no network.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSessionCheck, type SessionAuth } from "./session-check";

type FakeSession = { access_token: string; user: { id: string } };
type Listener = (event: string, session: FakeSession | null) => void;

function fakeAuth(start: FakeSession | null) {
  let session = start;
  const listeners: Listener[] = [];
  // Tokens the server rejects (revoked session) and whether the network is down.
  const revoked = new Set<string>();
  let offline = false;
  const calls = { getSession: 0, getUser: 0, getUserJwt: [] as (string | undefined)[] };
  const auth: SessionAuth = {
    async getSession() {
      calls.getSession++;
      return { data: { session } };
    },
    async getUser(jwt?: string) {
      calls.getUser++;
      calls.getUserJwt.push(jwt);
      await Promise.resolve();
      if (offline) throw new TypeError("Failed to fetch");
      const token = jwt ?? session?.access_token;
      if (!token || revoked.has(token)) {
        return { data: { user: null }, error: new Error("session_not_found") };
      }
      const owner = token.split(":")[0];
      return { data: { user: { id: owner } }, error: null };
    },
    onAuthStateChange(cb: Listener) {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe() {} } } };
    },
  };
  return {
    auth,
    calls,
    setSession: (s: FakeSession | null) => (session = s),
    emit: (event: string, s: FakeSession | null = session) => listeners.forEach((l) => l(event, s)),
    revoke: (token: string) => revoked.add(token),
    setOffline: (v: boolean) => (offline = v),
  };
}

// Token "<user id>:<n>" so the fake server knows whose it is.
const ana1: FakeSession = { access_token: "user-ana:1", user: { id: "user-ana" } };
const ana2: FakeSession = { access_token: "user-ana:2", user: { id: "user-ana" } };
const leo1: FakeSession = { access_token: "user-leo:1", user: { id: "user-leo" } };

describe("createSessionCheck (NK-0098)", () => {
  it("navigating N times with the same session asks the server once", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    for (let i = 0; i < 25; i++) expect(await check()).toBe(true);
    expect(f.calls.getUser).toBe(1);
    // It validates exactly the token it caches.
    expect(f.calls.getUserJwt).toEqual(["user-ana:1"]);
  });

  it("concurrent checks on page load (preload + navigation) share one request", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    const results = await Promise.all([check(), check(), check()]);
    expect(results).toEqual([true, true, true]);
    expect(f.calls.getUser).toBe(1);
  });

  it("without a session it says no, without asking the server (redirect to login as today)", async () => {
    const f = fakeAuth(null);
    const check = createSessionCheck(f.auth);
    expect(await check()).toBe(false);
    expect(await check()).toBe(false);
    expect(f.calls.getUser).toBe(0);
  });

  it("a refreshed token is validated once more, then cached again", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    await check();
    await check();
    f.setSession(ana2);
    f.emit("TOKEN_REFRESHED");
    expect(await check()).toBe(true);
    expect(await check()).toBe(true);
    expect(f.calls.getUser).toBe(2);
    expect(f.calls.getUserJwt).toEqual(["user-ana:1", "user-ana:2"]);
  });

  it("a token change is re-validated even if no event arrived", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    await check();
    f.setSession(ana2);
    await check();
    expect(f.calls.getUser).toBe(2);
  });

  it("another user in the same browser invalidates the saved check", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    await check();
    f.setSession(leo1);
    f.emit("SIGNED_IN");
    expect(await check()).toBe(true);
    expect(f.calls.getUser).toBe(2);
    expect(f.calls.getUserJwt[1]).toBe("user-leo:1");
  });

  it("signing out in another tab invalidates the saved check and the next navigation redirects", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    expect(await check()).toBe(true);
    f.setSession(null);
    f.emit("SIGNED_OUT", null);
    expect(await check()).toBe(false);
  });

  it("SIGNED_OUT drops the saved check even if a stale session is still readable", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    await check();
    f.emit("SIGNED_OUT", null);
    await check();
    expect(f.calls.getUser).toBe(2);
  });

  it("USER_UPDATED re-validates once", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    await check();
    f.emit("USER_UPDATED");
    await check();
    await check();
    expect(f.calls.getUser).toBe(2);
  });

  it("SIGNED_IN with the same token (tab regains focus) does not ask again", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    await check();
    f.emit("SIGNED_IN");
    f.emit("INITIAL_SESSION");
    await check();
    expect(f.calls.getUser).toBe(1);
  });

  it("a revoked session is refused on the first check and a refusal is never cached", async () => {
    const f = fakeAuth(ana1);
    f.revoke("user-ana:1");
    const check = createSessionCheck(f.auth);
    expect(await check()).toBe(false);
    expect(await check()).toBe(false);
    // Each attempt asks again: an invalid session never navigates on a saved answer.
    expect(f.calls.getUser).toBe(2);
  });

  it("a session revoked after a refresh is caught when the new token is checked", async () => {
    const f = fakeAuth(ana1);
    const check = createSessionCheck(f.auth);
    expect(await check()).toBe(true);
    f.revoke("user-ana:2");
    f.setSession(ana2);
    f.emit("TOKEN_REFRESHED");
    expect(await check()).toBe(false);
  });

  it("a server answer for a different user than the local session is refused", async () => {
    const f = fakeAuth({ access_token: "user-leo:9", user: { id: "user-ana" } });
    const check = createSessionCheck(f.auth);
    expect(await check()).toBe(false);
  });

  it("a network failure refuses (as today) and is retried on the next navigation", async () => {
    const f = fakeAuth(ana1);
    f.setOffline(true);
    const check = createSessionCheck(f.auth);
    expect(await check()).toBe(false);
    f.setOffline(false);
    expect(await check()).toBe(true);
    expect(await check()).toBe(true);
    expect(f.calls.getUser).toBe(2);
  });

  it("any error from the server refuses, even if a user object came back", async () => {
    const f = fakeAuth(ana1);
    const auth: SessionAuth = {
      ...f.auth,
      getUser: async () => ({ data: { user: { id: "user-ana" } }, error: new Error("bad_jwt") }),
    };
    expect(await createSessionCheck(auth)()).toBe(false);
  });
});

describe("/_authenticated beforeLoad uses the cached check (source guard)", () => {
  const src = readFileSync(path.resolve(__dirname, "../routes/_authenticated/route.tsx"), "utf8");
  it("never calls supabase.auth.getUser() on each navigation", () => {
    expect(src).not.toMatch(/auth\.getUser\(/);
  });
  it("redirects to /auth when the cached check says no", () => {
    expect(src).toMatch(/createSessionCheck\(supabase\.auth\)/);
    expect(src).toMatch(/if \(!\(await \w+\(\)\)\) throw redirect\(\{ to: "\/auth" \}\)/);
  });
});
