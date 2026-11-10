// NK-0119 (CA-1): a navigation validates Y before Y's SIGNED_IN reaches this tab, and there is no `me` in cache.
// The validator itself must notice that the validated user is not the last validated one, and apply the same
// rule as D-S3-3 (block + reload when something is mounted, otherwise just empty the cache). The later
// SIGNED_IN must not trigger a second reload. Fake Supabase client, fictional ids, no network.
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Sess = { access_token: string; user: { id: string } };
const h = vi.hoisted(() => ({
  session: null as Sess | null,
  listeners: [] as ((e: string, s: Sess | null) => void)[],
  getUser: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      getUser: async (jwt?: string) => {
        h.getUser++;
        return { data: { user: { id: String(jwt).split(":")[0] } }, error: null };
      },
      onAuthStateChange: (cb: (e: string, s: Sess | null) => void) => {
        h.listeners.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));

const x = (n = 1): Sess => ({ access_token: `user-x:${n}`, user: { id: "user-x" } });
const y: Sess = { access_token: "user-y:1", user: { id: "user-y" } };
const KEY = ["gx-private"];

let handleAuthEvent: typeof import("./session-cache").handleAuthEvent;
let handleOtherUserValidated: typeof import("./session-cache").handleOtherUserValidated;
let checkSession: typeof import("./session").checkSession;
let lastValidatedUserId: typeof import("./session").lastValidatedUserId;
let onOtherUserValidated: typeof import("./session").onOtherUserValidated;
let AccountSwitchGate: typeof import("@/components/account-switch-gate").AccountSwitchGate;
let accountSwitch: typeof import("./account-switch").accountSwitch;
let isSwitchingAccount: typeof import("./account-switch").isSwitchingAccount;
let resetAccountSwitch: typeof import("./account-switch").resetAccountSwitch;

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  h.getUser = 0;
  h.session = x();
  ({ handleAuthEvent, handleOtherUserValidated } = await import("./session-cache"));
  ({ checkSession, lastValidatedUserId, onOtherUserValidated } = await import("./session"));
  ({ AccountSwitchGate } = await import("@/components/account-switch-gate"));
  ({ accountSwitch, isSwitchingAccount, resetAccountSwitch } = await import("./account-switch"));
});
afterEach(() => {
  cleanup();
  resetAccountSwitch();
});

/** Like __root: the validator tells the cache when it validates another user, and every auth event reaches both. */
function wire(qc: QueryClient) {
  const reload = vi.fn();
  accountSwitch.reload = reload;
  onOtherUserValidated(() => handleOtherUserValidated(qc));
  const emit = async (event: string, s: Sess | null) => {
    h.session = s;
    await act(async () => {
      h.listeners.forEach((l) => l(event, s));
      handleAuthEvent(qc, event, s, lastValidatedUserId());
    });
  };
  return { reload, emit };
}

/** Another tab wrote Y's session; this tab navigates (the guard asks the validator) before the event arrives. */
async function navigateAsY() {
  h.session = y;
  await act(async () => {
    expect((await checkSession()).status).toBe("valid");
  });
}

describe("Y validated by a navigation before its SIGNED_IN, nothing mounted, no me (NK-0119)", () => {
  async function seeded() {
    const qc = new QueryClient();
    expect((await checkSession()).status).toBe("valid"); // X is the last validated user
    qc.setQueryData(KEY, { owner: "user-x", secret: "X-ONLY" });
    return qc;
  }

  it("no data of X is left in cache once Y is validated, and nothing was blocked", async () => {
    const qc = await seeded();
    wire(qc);
    await navigateAsY();
    expect(qc.getQueryData(KEY)).toBeUndefined();
    expect(qc.getQueryCache().getAll()).toEqual([]);
    expect(isSwitchingAccount()).toBe(false);
  });

  it("the SIGNED_IN of Y that follows is a plain login: no switch screen, no reload, still no X", async () => {
    const qc = await seeded();
    const { reload, emit } = wire(qc);
    await navigateAsY();
    await emit("SIGNED_IN", y);
    expect(isSwitchingAccount()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(qc.getQueryData(KEY)).toBeUndefined();
  });
});

describe("Y validated by a navigation before its SIGNED_IN, something mounted (NK-0119)", () => {
  function Screen() {
    const q = useQuery({ queryKey: KEY, queryFn: async () => ({ secret: "X-ONLY" }) });
    return <p data-testid="data">{q.data ? q.data.secret : "empty"}</p>;
  }

  it("blocks and reloads once, never a second time when the SIGNED_IN arrives", async () => {
    const qc = new QueryClient();
    expect((await checkSession()).status).toBe("valid");
    const { reload, emit } = wire(qc);
    render(
      <QueryClientProvider client={qc}>
        <AccountSwitchGate>
          <Screen />
        </AccountSwitchGate>
      </QueryClientProvider>,
    );
    await screen.findByText("X-ONLY");

    await navigateAsY();
    expect(isSwitchingAccount()).toBe(true);
    expect(await screen.findByText("Cambiando de cuenta…")).toBeTruthy();
    expect(screen.queryByText("X-ONLY")).toBeNull();
    expect(qc.getQueryData(KEY)).toBeUndefined();
    expect(reload).toHaveBeenCalledTimes(1);

    await emit("SIGNED_IN", y);
    await emit("SIGNED_IN", y);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(KEY)).toBeUndefined();
  });
});

describe("guards: when the validator must NOT treat it as another user (NK-0119)", () => {
  async function seeded() {
    const qc = new QueryClient();
    qc.setQueryData(KEY, { owner: "user-x" });
    return qc;
  }

  it("the same user after a refreshed token keeps the cache", async () => {
    const qc = await seeded();
    expect((await checkSession()).status).toBe("valid");
    wire(qc);
    h.session = x(2); // TOKEN_REFRESHED: another token, same user
    h.listeners.forEach((l) => l("TOKEN_REFRESHED", h.session));
    await act(async () => {
      await checkSession();
    });
    expect(qc.getQueryData(KEY)).toEqual({ owner: "user-x" });
    expect(isSwitchingAccount()).toBe(false);
  });

  it("the first validation of the page (nobody validated yet) keeps what loaders already put in cache", async () => {
    const qc = await seeded();
    wire(qc);
    expect(lastValidatedUserId()).toBeNull();
    await act(async () => {
      await checkSession();
    });
    expect(qc.getQueryData(KEY)).toEqual({ owner: "user-x" });
    expect(isSwitchingAccount()).toBe(false);
  });

  it("sign-out of X then sign-in as Y in this tab is a normal login (nothing to purge twice, no switch)", async () => {
    const qc = await seeded();
    const { reload, emit } = wire(qc);
    expect((await checkSession()).status).toBe("valid");
    await emit("SIGNED_OUT", null);
    await emit("SIGNED_IN", y);
    await act(async () => {
      expect((await checkSession()).status).toBe("valid");
    });
    expect(isSwitchingAccount()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("a validation of Y that was already blocked by Y's SIGNED_IN does not block twice", async () => {
    const qc = await seeded();
    const { reload, emit } = wire(qc);
    expect((await checkSession()).status).toBe("valid");
    await emit("SIGNED_IN", y); // the event wins the race: D-S3-3 as before
    expect(isSwitchingAccount()).toBe(true);
    const gate = render(<AccountSwitchGate>{null}</AccountSwitchGate>);
    await act(async () => {
      await checkSession();
    });
    expect(reload).toHaveBeenCalledTimes(1);
    gate.unmount();
  });
});

describe("source guard (NK-0119)", () => {
  it("__root subscribes the cache to the validator's other-user signal", () => {
    const src = readFileSync(path.resolve(__dirname, "../routes/__root.tsx"), "utf8");
    expect(src).toMatch(
      /onOtherUserValidated\(\s*\(\)\s*=>\s*handleOtherUserValidated\(queryClient\)\s*\)/,
    );
  });
});
