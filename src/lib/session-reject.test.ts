// NK-0098 round 3: a token the server refuses for good (401 bad_jwt) must not loop /home <-> /auth.
// Fake auth client, fictional tokens, no network.
import { describe, expect, it, vi } from "vitest";
import { createSessionCheck, type SessionAuth } from "./session-check";

type Sess = { access_token: string; user: { id: string } };

function fakeAuth(reply: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>) {
  let session: Sess | null = { access_token: "user-ana:1", user: { id: "user-ana" } };
  const listeners: ((e: string, s: Sess | null) => void)[] = [];
  const calls = { getUser: 0, signOut: 0 };
  const auth: SessionAuth = {
    async getSession() {
      return { data: { session } };
    },
    async getUser() {
      calls.getUser++;
      return reply();
    },
    async signOut(options) {
      calls.signOut++;
      expect(options).toEqual({ scope: "local" });
      session = null;
      listeners.forEach((l) => l("SIGNED_OUT", null));
    },
    onAuthStateChange(cb) {
      listeners.push(cb);
    },
  };
  return { auth, calls, hasSession: () => session !== null };
}

const rejected = (status: number, code: string) => async () => ({
  data: { user: null },
  error: Object.assign(new Error(code), { status }),
});

/** What /auth does on mount: a local session sends the user back to the app. */
async function authPageBouncesBack(f: ReturnType<typeof fakeAuth>) {
  const { data } = await f.auth.getSession();
  return data.session !== null;
}

describe("definitive rejection of the stored token (NK-0098 round 3)", () => {
  for (const [status, code] of [
    [401, "bad_jwt"],
    [403, "session_not_found"],
  ] as const) {
    it(`${status} ${code}: one call, stays on /auth, local session discarded (no /home <-> /auth loop)`, async () => {
      const f = fakeAuth(rejected(status, code));
      const check = createSessionCheck(f.auth);
      let navigations = 0;
      // Guard redirects to /auth; /auth sends back to /home while it still sees a local session.
      while ((await check()) === false && (await authPageBouncesBack(f)) && navigations < 50)
        navigations++;
      expect(navigations).toBe(0);
      expect(f.calls.getUser).toBe(1);
      expect(f.hasSession()).toBe(false);
      expect(await check()).toBe(false);
      expect(f.calls.getUser).toBe(1);
    });
  }

  it("a network failure or a 5xx never signs the user out", async () => {
    for (const reply of [
      rejected(503, "unexpected_failure"),
      rejected(0, "AuthRetryableFetchError"),
      async () => {
        throw new TypeError("Failed to fetch");
      },
    ]) {
      const f = fakeAuth(reply);
      const check = createSessionCheck(f.auth);
      expect(await check()).toBe(false);
      expect(f.calls.signOut).toBe(0);
      expect(f.hasSession()).toBe(true);
      // Not cached: the next navigation asks again.
      await check();
      expect(f.calls.getUser).toBe(2);
    }
  });
});

describe("rejected token that is no longer the stored one (NK-0098 round 4)", () => {
  it("a 403 for X's old token arriving after Y signed in (other tab) keeps Y's session", async () => {
    const y: Sess = { access_token: "user-bea:1", user: { id: "user-bea" } };
    let answer!: (v: { data: { user: null }; error: unknown }) => void;
    let stored: Sess | null = { access_token: "user-ana:1", user: { id: "user-ana" } };
    let signOuts = 0;
    const auth: SessionAuth = {
      async getSession() {
        return { data: { session: stored } };
      },
      getUser: () => new Promise((r) => (answer = r)),
      async signOut() {
        signOuts++;
        stored = null;
      },
      onAuthStateChange() {},
    };
    const pending = createSessionCheck(auth)();
    await vi.waitFor(() => expect(answer).toBeDefined());
    stored = y;
    answer({
      data: { user: null },
      error: Object.assign(new Error("session_not_found"), { status: 403 }),
    });
    expect(await pending).toBe(false);
    expect(signOuts).toBe(0);
    expect(stored).toBe(y);
  });
});
