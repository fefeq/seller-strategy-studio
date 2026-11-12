// NK-0150 (walkthrough f5458dd, flow 3): once the person presses «Cerrar sesión», or the tab learns that another
// account signed in (D-S3-3), the setup guide that the sidebar keeps mounted must not send any more reads with X's
// org id and token: not before the logout request ends, not after the app is blocked. Real QueryClient, real useMe,
// real useSetupGuide (activity on, as in Inicio) plus the sidebar copy that opens with the mobile drawer, rendered.
// The fake Supabase client sends a request the way supabase-js does: after an async step (the auth lock), and not
// at all if its abort signal fired. Every request is recorded when it is SENT. Fictional ids, no network.
import { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Sess = { access_token: string; user: { id: string } };
const GUIDE_TABLES = vi.hoisted(() => [
  "setup_step_snoozes",
  "organizations",
  "positioning",
  "segments",
  "quotas",
  "accounts",
  "deals",
  "icp_profiles",
  "messaging_pillars",
]);
const h = vi.hoisted(() => ({
  session: null as { access_token: string; user: { id: string } } | null,
  listeners: [] as ((
    e: string,
    s: { access_token: string; user: { id: string } } | null,
  ) => void)[],
  sent: [] as { table: string; org: string | null; token: string | null; afterMark: boolean }[],
  mark: false,
  sendGate: null as Promise<void> | null,
  logoutGate: null as Promise<void> | null,
  signOutStarted: 0,
  failReads: false,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (t: string) => {
    let id: string | null = null;
    let org: string | null = null;
    let signal: AbortSignal | undefined;
    const send = async <T,>(answer: () => T): Promise<T> => {
      await h.sendGate; // supabase-js reads the session under a lock before the request leaves
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      h.sent.push({
        table: t,
        org: t === "organizations" ? id : org,
        token: h.session?.access_token ?? null,
        afterMark: h.mark,
      });
      if (h.failReads && GUIDE_TABLES.includes(t))
        return { data: null, error: { message: "simulated 500" } } as T;
      return answer();
    };
    const chain: unknown = new Proxy(function () {}, {
      get: (_t, k: string) => {
        if (k === "eq")
          return (c: string, v: string) => {
            if (c === "org_id") org = v;
            if (c === "id" || c === "user_id") id = v;
            return chain;
          };
        if (k === "abortSignal")
          return (s: AbortSignal) => {
            signal = s;
            return chain;
          };
        if (k === "maybeSingle")
          return () => {
            const p: unknown = new Proxy(function () {}, {
              get: (_x, kk: string) => {
                if (kk === "abortSignal")
                  return (s: AbortSignal) => {
                    signal = s;
                    return p;
                  };
                if (kk === "then")
                  return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
                    send(() => ({
                      data: {
                        id,
                        current_org_id: `org-of-${String(id)}`,
                        created_at: null,
                        last_human_edit_at: null,
                      },
                      error: null,
                    })).then(res, rej);
                return () => p;
              },
            });
            return p;
          };
        if (k === "then")
          return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
            send(() => ({
              data:
                t === "org_members"
                  ? [
                      {
                        org_id: `org-of-${String(id)}`,
                        role: "owner",
                        organizations: {
                          name: `Co ${String(id)}`,
                          currency: "EUR",
                          website: null,
                          archived_at: null,
                        },
                      },
                    ]
                  : [],
              error: null,
            })).then(res, rej);
        return () => chain;
      },
    });
    return chain;
  };
  return {
    supabase: {
      rpc: async () => ({ data: null }),
      from,
      auth: {
        getSession: async () => ({ data: { session: h.session } }),
        getUser: async (jwt?: string) => ({
          data: { user: { id: String(jwt).split(":")[0] } },
          error: null,
        }),
        signOut: async () => {
          h.signOutStarted++;
          await h.logoutGate; // the logout request is in flight; the session is still X's until it ends
          h.session = null;
          h.listeners.forEach((l) => l("SIGNED_OUT", null));
        },
        onAuthStateChange: (cb: (e: string, s: Sess | null) => void) => {
          h.listeners.push(cb);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    },
  };
});
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
// Steps pending (no deals yet), read through the real cache like the real hook: key ["setup", orgId].
vi.mock("@/hooks/use-setup", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  const { useMe } = await import("@/hooks/use-me");
  const { setupStatus } = await import("@/lib/setup-schema");
  return {
    useSetup: () => {
      const orgId = useMe().data?.currentOrg?.org_id;
      return useQuery({
        queryKey: ["setup", orgId],
        enabled: !!orgId,
        queryFn: async () => {
          const data = {
            currency: "EUR",
            segments: [],
            icps: [],
            positioning: {},
            pillars: [],
            quotas: [],
            accounts: 0,
            deals: 0,
            quarter: "2026-Q4",
          } as unknown as import("@/lib/setup-schema").SetupData;
          return { data, status: setupStatus(data) };
        },
      });
    },
  };
});

const x: Sess = { access_token: "user-x:1", user: { id: "user-x" } };
const y: Sess = { access_token: "user-y:1", user: { id: "user-y" } };

const RETRY_MS = 600;
let handleAuthEvent: typeof import("@/lib/session-cache").handleAuthEvent;
let signOutAndClear: typeof import("@/lib/session-cache").signOutAndClear;
let lastValidatedUserId: typeof import("@/lib/session").lastValidatedUserId;
let supabase: typeof import("@/integrations/supabase/client").supabase;
let useMe: typeof import("@/hooks/use-me").useMe;
let useSetupGuide: typeof import("@/hooks/use-setup-guide").useSetupGuide;
let AccountSwitchGate: typeof import("@/components/account-switch-gate").AccountSwitchGate;
let accountSwitch: typeof import("@/lib/account-switch").accountSwitch;
let beginAccountSwitch: typeof import("@/lib/account-switch").beginAccountSwitch;
let resetAccountSwitch: typeof import("@/lib/account-switch").resetAccountSwitch;

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  h.sent.length = 0;
  h.mark = false;
  h.sendGate = null;
  h.logoutGate = null;
  h.signOutStarted = 0;
  h.session = x;
  ({ handleAuthEvent, signOutAndClear } = await import("@/lib/session-cache"));
  ({ lastValidatedUserId } = await import("@/lib/session"));
  ({ supabase } = await import("@/integrations/supabase/client"));
  ({ useMe } = await import("@/hooks/use-me"));
  ({ useSetupGuide } = await import("@/hooks/use-setup-guide"));
  ({ AccountSwitchGate } = await import("@/components/account-switch-gate"));
  ({ accountSwitch, resetAccountSwitch, beginAccountSwitch } =
    await import("@/lib/account-switch"));
  resetAccountSwitch();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  resetAccountSwitch();
});

/** Inicio's guide (activity on) and, once the menu opens, the sidebar copy of the mobile drawer, next to «Cerrar sesión». */
function setup() {
  const reload = vi.fn();
  accountSwitch.reload = reload;
  function Inicio() {
    const g = useSetupGuide({ activity: true });
    return <p data-testid="guide">{g.orgId ?? "none"}</p>;
  }
  function Drawer() {
    const g = useSetupGuide();
    return <p data-testid="drawer">{g.orgId ?? "none"}</p>;
  }
  function Shell() {
    const { data: me } = useMe();
    const [open, setOpen] = useState(false);
    return (
      <>
        <p data-testid="who">{me ? me.user.id : "loading"}</p>
        <button onClick={() => setOpen(true)}>Abrir menú</button>
        {open && <Drawer />}
        <button onClick={() => void signOutAndClear(qc, supabase.auth)}>Cerrar sesión</button>
        <Inicio />
      </>
    );
  }
  // Same `retry` as the hook asks for; only the wait between attempts is short so the test needs no fake clock.
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: RETRY_MS } } });
  render(
    <QueryClientProvider client={qc}>
      <AccountSwitchGate>
        <Shell />
      </AccountSwitchGate>
    </QueryClientProvider>,
  );
  const emit = async (event: string, s: Sess | null) => {
    h.session = s;
    await act(async () => {
      h.listeners.forEach((l) => l(event, s));
      handleAuthEvent(qc, event, s, lastValidatedUserId());
    });
  };
  return { qc, emit, reload };
}

const ofX = (r: { org: string | null; token: string | null; table: string }) =>
  GUIDE_TABLES.includes(r.table) && (r.org === "org-of-user-x" || r.token === "user-x:1");
const sentAfterMark = () => h.sent.filter((r) => r.afterMark && ofX(r));

/** Loaded and idle: the activity reads (Inicio) and the drawer copy are on screen. */
async function mountedAndLoaded() {
  const ctx = setup();
  await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("user-x"));
  await waitFor(() => expect(h.sent.some((r) => r.table === "deals")).toBe(true));
  await act(async () => {
    screen.getByText("Abrir menú").click();
  });
  await waitFor(() => expect(screen.getByTestId("drawer").textContent).toBe("org-of-user-x"));
  await act(async () => {});
  return ctx;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Every guide read answers 500 and the first attempt has failed: a retry of each copy is now waiting for its delay. */
async function mountedWithRetriesPending() {
  h.failReads = true;
  const ctx = setup();
  await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("user-x"));
  await waitFor(() => expect(h.sent.some((r) => r.table === "deals")).toBe(true));
  await act(async () => {
    screen.getByText("Abrir menú").click();
  });
  await waitFor(() => expect(screen.getByTestId("drawer").textContent).toBe("org-of-user-x"));
  await act(async () => {});
  return ctx;
}

describe("failing guide reads with a retry pending when the session ends (NK-0150, walkthrough 598e73b)", () => {
  it("CA-1: the retry that was waiting when «Cerrar sesión» was pressed never sends with X's org id or token", async () => {
    await mountedWithRetriesPending();
    let finish = () => {};
    h.logoutGate = new Promise<void>((r) => (finish = r));
    await act(async () => {
      screen.getByText("Cerrar sesión").click();
    });
    await waitFor(() => expect(h.signOutStarted).toBe(1));
    h.mark = true;
    await act(async () => {
      await wait(RETRY_MS * 3);
    });
    const during = sentAfterMark();
    finish();
    await act(async () => {});
    expect(during).toEqual([]);
    expect(sentAfterMark()).toEqual([]);
  });

  it("CA-2: the retry that was waiting when another tab signed in as Y never sends with X's org id", async () => {
    const { emit, reload } = await mountedWithRetriesPending();
    h.mark = true;
    await emit("SIGNED_IN", y);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    await act(async () => {
      await wait(RETRY_MS * 3);
    });
    expect(sentAfterMark()).toEqual([]);
  });

  it("control: with nothing ending, the failing guide does retry", async () => {
    await mountedWithRetriesPending();
    const before = h.sent.length;
    await act(async () => {
      await wait(RETRY_MS * 2);
    });
    expect(h.sent.length).toBeGreaterThan(before);
  });

  it("CA-1: a refetch asked in the same tick as the click, before the screens re-render, sends nothing with X's ids", async () => {
    const { qc } = await mountedWithRetriesPending();
    h.logoutGate = new Promise<void>((r) => void r);
    h.mark = true;
    await act(async () => {
      void signOutAndClear(qc, supabase.auth);
      void qc.invalidateQueries({ queryKey: ["setup-guide"] });
      void qc.refetchQueries({ queryKey: ["setup-guide"] });
    });
    await act(async () => {
      await wait(RETRY_MS * 3);
    });
    expect(sentAfterMark()).toEqual([]);
  });

  it("CA-2: a refetch asked in the same tick as the account switch sends nothing with X's ids", async () => {
    const { qc } = await mountedWithRetriesPending();
    h.mark = true;
    await act(async () => {
      beginAccountSwitch();
      void qc.invalidateQueries({ queryKey: ["setup-guide"] });
      void qc.refetchQueries({ queryKey: ["setup-guide"] });
    });
    await act(async () => {
      await wait(RETRY_MS * 3);
    });
    expect(sentAfterMark()).toEqual([]);
  });
});
