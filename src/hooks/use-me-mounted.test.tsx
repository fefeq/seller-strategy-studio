// NK-0111 (walkthroughs 08c5b9a and 979962e): another tab signs in as Y while this one shows X. Once the tab
// knows the session is Y: no frame renders X, no request is built from X's ids (D-S3-3: the app is replaced by
// a blocking «Cambiando de cuenta…» state, then reloads). Real QueryClient, real useMe, a screen query keyed by
// org and user ids, rendered; fake Supabase recording every request; fictional ids.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Sess = { access_token: string; user: { id: string } };
const h = vi.hoisted(() => ({
  session: null as Sess | null,
  listeners: [] as ((e: string, s: Sess | null) => void)[],
  requests: [] as { table: string; col: string; value: string }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async () => ({ data: null }),
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (c: string, id: string) => {
        q.id = id;
        h.requests.push({ table: t, col: c, value: id });
        return q;
      };
      q.maybeSingle = async () => ({
        data: { id: q.id, current_org_id: `org-of-${String(q.id)}` },
      });
      q.then = (r: (v: unknown) => unknown) =>
        r({
          data:
            t === "org_members"
              ? [
                  {
                    org_id: `org-of-${String(q.id)}`,
                    role: "owner",
                    organizations: {
                      name: `Co ${String(q.id)}`,
                      currency: "EUR",
                      website: null,
                      archived_at: null,
                    },
                  },
                ]
              : null,
        });
      return q;
    },
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      getUser: async (jwt?: string) => ({
        data: { user: { id: String(jwt).split(":")[0] } },
        error: null,
      }),
      onAuthStateChange: (cb: (e: string, s: Sess | null) => void) => {
        h.listeners.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));

const x: Sess = { access_token: "user-x:1", user: { id: "user-x" } };
const y: Sess = { access_token: "user-y:1", user: { id: "user-y" } };

let handleAuthEvent: typeof import("@/lib/session-cache").handleAuthEvent;
let lastValidatedUserId: typeof import("@/lib/session").lastValidatedUserId;
let supabase: typeof import("@/integrations/supabase/client").supabase;
let useMe: typeof import("@/hooks/use-me").useMe;
let useQuery: typeof import("@tanstack/react-query").useQuery;
let AccountSwitchGate: typeof import("@/components/account-switch-gate").AccountSwitchGate;
let accountSwitch: typeof import("@/lib/account-switch").accountSwitch;

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  h.session = x;
  h.requests.length = 0;
  ({ handleAuthEvent } = await import("@/lib/session-cache"));
  ({ lastValidatedUserId } = await import("@/lib/session"));
  ({ supabase } = await import("@/integrations/supabase/client"));
  ({ useMe } = await import("@/hooks/use-me"));
  ({ useQuery } = await import("@tanstack/react-query"));
  ({ AccountSwitchGate } = await import("@/components/account-switch-gate"));
  ({ accountSwitch } = await import("@/lib/account-switch"));
});
afterEach(cleanup);

/** What the shell shows: identity and company of the current `me`, plus a screen keyed by org and user ids. */
function setup() {
  const rendered: string[] = [];
  const reload = vi.fn();
  accountSwitch.reload = reload;
  function Screen({ orgId, userId }: { orgId: string; userId: string }) {
    useQuery({
      queryKey: ["deals", orgId, userId],
      queryFn: async () => {
        await supabase.from("deals").select().eq("org_id", orgId);
        await supabase.from("notifications").select().eq("user_id", userId);
        return [];
      },
    });
    return null;
  }
  function Shell() {
    const { data: me } = useMe();
    const text = me ? `${me.user.id} | ${me.currentOrg?.name}` : "loading";
    rendered.push(text);
    return (
      <>
        <p data-testid="who">{text}</p>
        {me?.currentOrg && <Screen orgId={me.currentOrg.org_id} userId={me.user.id} />}
      </>
    );
  }
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <AccountSwitchGate>
        <Shell />
      </AccountSwitchGate>
    </QueryClientProvider>,
  );
  // Like __root: the validator's own listener and handleAuthEvent both hear every event.
  const emit = async (event: string, s: Sess | null) => {
    h.session = s;
    await act(async () => {
      h.listeners.forEach((l) => l(event, s));
      handleAuthEvent(qc, event, s, lastValidatedUserId());
    });
  };
  return { qc, rendered, emit, reload };
}

const ofX = (r: { value: string }) => r.value.includes("user-x");

describe("a mounted app when the session changes (NK-0111, D-S3-3)", () => {
  it("SIGNED_IN of Y (other tab): no request with X's ids, no frame with X, a blocking state, then a reload", async () => {
    const { rendered, emit, reload } = setup();
    await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("user-x | Co user-x"));
    await waitFor(() => expect(h.requests.some((r) => r.table === "notifications")).toBe(true));
    const framesBefore = rendered.length;
    const requestsBefore = h.requests.length;
    await emit("SIGNED_IN", y);
    await waitFor(() => expect(screen.getByText("Cambiando de cuenta…")).toBeTruthy());
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("who")).toBeNull();
    expect(rendered.slice(framesBefore).filter((t) => t.includes("user-x"))).toEqual([]);
    expect(h.requests.slice(requestsBefore).filter(ofX)).toEqual([]);
  });

  it("SIGNED_IN of the same user (tab focus) keeps the app and does not reload", async () => {
    const { emit, reload } = setup();
    await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("user-x | Co user-x"));
    await emit("SIGNED_IN", x);
    expect(screen.getByTestId("who").textContent).toBe("user-x | Co user-x");
    expect(screen.queryByText("Cambiando de cuenta…")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("SIGNED_OUT: X is not rendered after the event, and no switch screen", async () => {
    const { rendered, emit, reload } = setup();
    await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("user-x | Co user-x"));
    const before = rendered.length;
    await emit("SIGNED_OUT", null);
    await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("loading"));
    expect(rendered.slice(before).filter((t) => t.includes("user-x"))).toEqual([]);
    expect(screen.queryByText("Cambiando de cuenta…")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});
