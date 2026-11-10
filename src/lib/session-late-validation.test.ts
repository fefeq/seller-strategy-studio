// NK-0135 (CA-1): a validation that finishes after the saved session already belongs to someone else is
// discarded: it must not fire «other user» (which blocks and reloads once too many), must not change the last
// validated user and must not be saved. Fake Supabase client, fictional ids, no network.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Sess = { access_token: string; user: { id: string } };
const h = vi.hoisted(() => ({
  session: null as Sess | null,
  listeners: [] as ((e: string, s: Sess | null) => void)[],
  getUser: [] as string[],
  held: new Map<string, Promise<void>>(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      getUser: async (jwt?: string) => {
        h.getUser.push(String(jwt));
        await h.held.get(String(jwt));
        return { data: { user: { id: String(jwt).split(":")[0] } }, error: null };
      },
      onAuthStateChange: (cb: (e: string, s: Sess | null) => void) => {
        h.listeners.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));

const x = (n: number): Sess => ({ access_token: `user-x:${n}`, user: { id: "user-x" } });
const y: Sess = { access_token: "user-y:1", user: { id: "user-y" } };

let checkSession: typeof import("./session").checkSession;
let lastValidatedUserId: typeof import("./session").lastValidatedUserId;
let onOtherUserValidated: typeof import("./session").onOtherUserValidated;

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  h.getUser = [];
  h.held.clear();
  h.session = x(1);
  ({ checkSession, lastValidatedUserId, onOtherUserValidated } = await import("./session"));
});

/** Hold the server answer for one token until `release()` is called. */
function hold(token: string) {
  let release!: () => void;
  h.held.set(
    token,
    new Promise<void>((r) => {
      release = r;
    }),
  );
  return release;
}
const emit = (event: string, s: Sess | null) => {
  h.session = s;
  h.listeners.forEach((l) => l(event, s));
};
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("a late validation of a token that is no longer the saved session (NK-0135)", () => {
  it("does not fire «other user» nor change the last validated user", async () => {
    expect((await checkSession()).status).toBe("valid"); // X is the last validated user
    const others: string[] = [];
    onOtherUserValidated((id) => others.push(id));

    const releaseX2 = hold("user-x:2");
    h.session = x(2);
    const late = checkSession(); // validating X's refreshed token, the server is slow
    await tick();
    expect(h.getUser).toContain("user-x:2");

    emit("SIGNED_IN", y); // the stored session is Y now
    expect((await checkSession()).status).toBe("valid"); // Y is validated: the one real switch
    expect(others).toEqual(["user-y"]);
    expect(lastValidatedUserId()).toBe("user-y");

    releaseX2();
    await late;
    expect(others, "the late X result is not another user").toEqual(["user-y"]);
    expect(lastValidatedUserId(), "the last validated user stays Y").toBe("user-y");
  });
});

describe("guards that pass on the base and must keep passing (NK-0135)", () => {
  it("a slow validation of the token that is still the saved session does fire «other user»", async () => {
    expect((await checkSession()).status).toBe("valid"); // X
    const others: string[] = [];
    onOtherUserValidated((id) => others.push(id));
    const releaseY = hold(y.access_token);
    h.session = y;
    const slow = checkSession();
    await tick();
    releaseY();
    expect((await slow).status).toBe("valid");
    expect(others).toEqual(["user-y"]);
    expect(lastValidatedUserId()).toBe("user-y");
  });

  it("a slow validation of a refreshed token of the same user still records the user", async () => {
    expect((await checkSession()).status).toBe("valid");
    const releaseX2 = hold("user-x:2");
    h.session = x(2);
    const slow = checkSession();
    await tick();
    emit("TOKEN_REFRESHED", x(2));
    releaseX2();
    expect((await slow).status).toBe("valid");
    expect(lastValidatedUserId()).toBe("user-x");
  });
});
