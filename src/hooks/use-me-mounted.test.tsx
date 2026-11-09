// NK-0111 (walkthrough 08c5b9a): another tab signs in as Y while this one shows X. The mounted useMe
// observer must never keep rendering X once the tab knows the session is Y: removeQueries alone leaves it
// holding the removed query. Real QueryClient, real useMe, rendered; fake Supabase; fictional ids.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Sess = { access_token: string; user: { id: string } };
const h = vi.hoisted(() => ({
  session: null as Sess | null,
  listeners: [] as ((e: string, s: Sess | null) => void)[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async () => ({ data: null }),
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (_c: string, id: string) => {
        q.id = id;
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
let useMe: typeof import("@/hooks/use-me").useMe;

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  h.session = x;
  ({ handleAuthEvent } = await import("@/lib/session-cache"));
  ({ lastValidatedUserId } = await import("@/lib/session"));
  ({ useMe } = await import("@/hooks/use-me"));
});
afterEach(cleanup);

/** What the shell shows: identity and company of the current `me`. Every render is recorded. */
function setup() {
  const rendered: string[] = [];
  function Shell() {
    const { data: me } = useMe();
    const text = me ? `${me.user.id} | ${me.currentOrg?.name}` : "loading";
    rendered.push(text);
    return <p data-testid="who">{text}</p>;
  }
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <Shell />
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
  return { qc, rendered, emit };
}

describe("a mounted useMe when the session changes (NK-0111)", () => {
  it("SIGNED_IN of Y (other tab): X is never rendered after the event, and Y arrives", async () => {
    const { rendered, emit } = setup();
    await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("user-x | Co user-x"));
    const before = rendered.length;
    await emit("SIGNED_IN", y);
    await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("user-y | Co user-y"));
    expect(rendered.slice(before).filter((t) => t.includes("user-x"))).toEqual([]);
  });

  it("SIGNED_OUT: X is not rendered after the event either", async () => {
    const { rendered, emit } = setup();
    await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("user-x | Co user-x"));
    const before = rendered.length;
    await emit("SIGNED_OUT", null);
    await waitFor(() => expect(screen.getByTestId("who").textContent).toBe("loading"));
    expect(rendered.slice(before).filter((t) => t.includes("user-x"))).toEqual([]);
  });
});
