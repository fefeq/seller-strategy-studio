// NK-0098: one GET /auth/v1/user per page load and per session change, not one per navigation.
// The Supabase auth client is a fake that counts calls. Fictional tokens and ids, no network.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createSessionCheck,
  createLastValidatedUserId,
  createSessionState,
  createSessionUser,
  type SessionAuth,
} from "./session-check";

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

describe("checkSession: three states (NK-0112)", () => {
  const failing = (status: number | undefined, f = fakeAuth(ana1)) => {
    let fail = true;
    const auth: SessionAuth = {
      ...f.auth,
      getUser: async (jwt?: string) => {
        f.calls.getUser++;
        await Promise.resolve();
        if (fail) {
          const e = new Error("boom");
          return {
            data: { user: null },
            error: status === undefined ? e : Object.assign(e, { status }),
          };
        }
        return { data: { user: { id: (jwt ?? "").split(":")[0] } }, error: null };
      },
    };
    return { f, auth, heal: () => (fail = false) };
  };

  it("valid carries the user the server validated", async () => {
    const f = fakeAuth(ana1);
    expect(await createSessionState(f.auth)()).toEqual({
      status: "valid",
      user: { id: "user-ana" },
    });
  });

  it("none without a local session", async () => {
    const f = fakeAuth(null);
    expect(await createSessionState(f.auth)()).toEqual({ status: "none" });
  });

  it("none when the server answers with another user", async () => {
    const f = fakeAuth({ access_token: "user-leo:9", user: { id: "user-ana" } });
    expect(await createSessionState(f.auth)()).toEqual({ status: "none" });
  });

  for (const status of [401, 403]) {
    it(`none on ${status}, and the local session is closed`, async () => {
      const { f, auth } = failing(status);
      let signOut = 0;
      const withSignOut: SessionAuth = { ...auth, signOut: async () => void signOut++ };
      expect(await createSessionState(withSignOut)()).toEqual({ status: "none" });
      expect(signOut).toBe(1);
      expect(f.calls.getUser).toBe(1);
    });
  }

  for (const status of [0, 500, 503, 429, undefined]) {
    it(`unverified on ${status ?? "an error without status"}, never signs out`, async () => {
      const { auth } = failing(status);
      let signOut = 0;
      const withSignOut: SessionAuth = { ...auth, signOut: async () => void signOut++ };
      expect(await createSessionState(withSignOut)()).toEqual({ status: "unverified" });
      expect(signOut).toBe(0);
    });
  }

  it("unverified when the request throws", async () => {
    const f = fakeAuth(ana1);
    f.setOffline(true);
    expect(await createSessionState(f.auth)()).toEqual({ status: "unverified" });
  });

  it("unverified is never saved: the next call asks again and can succeed", async () => {
    const { f, auth, heal } = failing(503);
    const check = createSessionState(auth);
    expect((await check()).status).toBe("unverified");
    expect((await check()).status).toBe("unverified");
    expect(f.calls.getUser).toBe(2);
    heal();
    expect((await check()).status).toBe("valid");
    expect((await check()).status).toBe("valid");
    expect(f.calls.getUser).toBe(3);
  });

  it("shares the saved answer and the in-flight request with createSessionUser and createSessionCheck", async () => {
    const f = fakeAuth(ana1);
    const [a, b, c] = await Promise.all([
      createSessionState(f.auth)(),
      createSessionUser(f.auth)(),
      createSessionCheck(f.auth)(),
    ]);
    expect(a.status).toBe("valid");
    expect(b).toEqual({ id: "user-ana" });
    expect(c).toBe(true);
    await createSessionState(f.auth)();
    expect(f.calls.getUser).toBe(1);
  });
});

describe("lastValidatedUserId (NK-0110, NK-0111)", () => {
  it("is null until a user has been validated, and a failed check does not set it", async () => {
    const f = fakeAuth(ana1);
    const last = createLastValidatedUserId(f.auth);
    expect(last()).toBeNull();
    f.setOffline(true);
    await createSessionUser(f.auth)();
    expect(last()).toBeNull();
  });

  it("is the user the shared validator validated last", async () => {
    const f = fakeAuth(ana1);
    const last = createLastValidatedUserId(f.auth);
    await createSessionUser(f.auth)();
    expect(last()).toBe("user-ana");
  });

  it("survives TOKEN_REFRESHED and a failing check of the next token, and is replaced only by another validated user", async () => {
    const f = fakeAuth(ana1);
    const last = createLastValidatedUserId(f.auth);
    const check = createSessionState(f.auth);
    await check();
    f.setSession(ana2);
    f.emit("TOKEN_REFRESHED", ana2);
    expect(last()).toBe("user-ana");
    f.setOffline(true);
    expect((await check()).status).toBe("unverified");
    expect(last()).toBe("user-ana");
    f.setOffline(false);
    f.setSession(leo1);
    f.emit("SIGNED_IN", leo1);
    expect(last(), "not replaced before the other user is validated").toBe("user-ana");
    await check();
    expect(last()).toBe("user-leo");
  });

  it("is forgotten on SIGNED_OUT, so the next user of this tab is not «another user»", async () => {
    const f = fakeAuth(ana1);
    const last = createLastValidatedUserId(f.auth);
    await createSessionUser(f.auth)();
    expect(last()).toBe("user-ana");
    f.setSession(null);
    f.emit("SIGNED_OUT", null);
    expect(last()).toBeNull();
  });

  it("a validation that finishes after SIGNED_OUT does not bring the user back", async () => {
    const f = fakeAuth(ana1);
    const last = createLastValidatedUserId(f.auth);
    const pending = createSessionUser(f.auth)();
    f.emit("SIGNED_OUT", null);
    await pending;
    expect(last()).toBeNull();
  });
});

describe("/_authenticated beforeLoad uses the cached check (source guard)", () => {
  const src = readFileSync(path.resolve(__dirname, "../routes/_authenticated/route.tsx"), "utf8");
  it("never calls supabase.auth.getUser() on each navigation", () => {
    expect(src).not.toMatch(/auth\.getUser\(/);
  });
  it("redirects to /auth only when the check says none", () => {
    expect(src).toMatch(/checkSession\(\)/);
    expect(src).toMatch(/status === "none"\)\s*throw redirect\(\{ to: "\/auth" \}\)/);
    expect(src.match(/redirect\(\{ to: "\/auth" \}\)/g)).toHaveLength(1);
    expect(src).toMatch(/status === "unverified"\)\s*throw new SessionUnverifiedError\(\)/);
  });
});
