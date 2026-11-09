// NK-0098 round 3: after sign-out, meQuery never queries with the previous user's id.
// Fake Supabase client recording every data request with the session it was made under.
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Sess = { access_token: string; user: { id: string } };
const h = vi.hoisted(() => ({
  session: null as { access_token: string; user: { id: string } } | null,
  listeners: [] as ((e: string, s: unknown) => void)[],
  requests: [] as { what: string; sessionUser: string | null }[],
  gate: null as Promise<void> | null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const log = (what: string) => h.requests.push({ what, sessionUser: h.session?.user.id ?? null });
  return {
    supabase: {
      rpc: async (name: string) => {
        log(`rpc:${name}`);
        await h.gate;
        return { data: null };
      },
      from: (t: string) => {
        log(`from:${t}`);
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = () => q;
        q.maybeSingle = async () => ({ data: { id: "user-x", current_org_id: "org-x" } });
        q.then = (r: (v: unknown) => unknown) => r({ data: [] });
        return q;
      },
      auth: {
        getSession: async () => ({ data: { session: h.session } }),
        getUser: async (jwt?: string) => ({
          data: { user: { id: String(jwt).split(":")[0] } },
          error: null,
        }),
        signOut: async () => {
          h.session = null;
          h.listeners.forEach((l) => l("SIGNED_OUT", null));
        },
        onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
          h.listeners.push(cb);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    },
  };
});

const x: Sess = { access_token: "user-x:1", user: { id: "user-x" } };
let meQuery: typeof import("@/hooks/use-me").meQuery;
let handleAuthEvent: typeof import("./session-cache").handleAuthEvent;
let lastValidatedUserId: typeof import("./session").lastValidatedUserId;
let dropUserCache: typeof import("./session-cache").dropUserCache;
let signOutAndClear: typeof import("./session-cache").signOutAndClear;

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  h.requests.length = 0;
  h.gate = null;
  h.session = x;
  ({ meQuery } = await import("@/hooks/use-me"));
  ({ lastValidatedUserId } = await import("./session"));
  ({ handleAuthEvent, signOutAndClear, dropUserCache } = await import("./session-cache"));
  const { supabase } = await import("@/integrations/supabase/client");
  supabase.auth.onAuthStateChange(() => undefined);
});

describe("signing out while meQuery works (NK-0098 round 3)", () => {
  it("a me load interrupted by sign-out makes no further request as the old user", async () => {
    const qc = new QueryClient();
    let release = () => {};
    h.gate = new Promise<void>((r) => (release = r));
    const loading = qc.fetchQuery(meQuery);
    await vi.waitFor(() =>
      expect(h.requests.some((r) => r.what === "rpc:accept_invites")).toBe(true),
    );
    h.session = null;
    h.listeners.forEach((l) => l("SIGNED_OUT", null));
    handleAuthEvent(qc, "SIGNED_OUT", null);
    release();
    await loading.catch(() => undefined);
    // Nothing after the sign-out: no profiles / org_members lookups for X, authenticated or anonymous.
    expect(h.requests.filter((r) => r.what.startsWith("from:"))).toEqual([]);
  });

  it("signOutAndClear ends the session before dropping the cache, and nothing refetches in between", async () => {
    const qc = new QueryClient();
    await qc.fetchQuery(meQuery);
    h.requests.length = 0;
    const sessionWhenDropped: (string | null)[] = [];
    const remove = qc.removeQueries.bind(qc);
    qc.removeQueries = ((...a: Parameters<typeof remove>) => {
      sessionWhenDropped.push(h.session?.user.id ?? null);
      return remove(...a);
    }) as typeof qc.removeQueries;
    const { supabase } = await import("@/integrations/supabase/client");
    await signOutAndClear(qc, supabase.auth);
    expect(sessionWhenDropped.length).toBeGreaterThan(0);
    expect(sessionWhenDropped.every((s) => s === null)).toBe(true);
    expect(h.requests).toEqual([]);
    expect(qc.getQueryData(["me"])).toBeUndefined();
  });
});

describe("mutations are user-scoped too (NK-0115)", () => {
  async function withMutations() {
    const qc = new QueryClient();
    await new MutationObserver(qc, { mutationFn: async () => "done" }).mutate();
    void new MutationObserver(qc, {
      mutationFn: () => new Promise<string>(() => undefined),
    }).mutate();
    expect(qc.getMutationCache().getAll()).toHaveLength(2);
    return qc;
  }

  it("dropUserCache empties the mutation cache", async () => {
    const qc = await withMutations();
    dropUserCache(qc);
    expect(qc.getMutationCache().getAll()).toEqual([]);
  });

  it("signOutAndClear does too", async () => {
    const qc = await withMutations();
    const { supabase } = await import("@/integrations/supabase/client");
    await signOutAndClear(qc, supabase.auth);
    expect(qc.getMutationCache().getAll()).toEqual([]);
  });

  it("so does the other-user branch of handleAuthEvent", async () => {
    const qc = await withMutations();
    handleAuthEvent(qc, "SIGNED_IN", { user: { id: "user-y" } }, "user-x");
    expect(qc.getMutationCache().getAll()).toEqual([]);
  });
});

describe("sign-out forgets the last validated user (NK-0111)", () => {
  it("signOutAndClear leaves no last validated user, so the next login in this tab is not «another user»", async () => {
    const qc = new QueryClient();
    await qc.fetchQuery(meQuery);
    expect(lastValidatedUserId()).toBe("user-x");
    const { supabase } = await import("@/integrations/supabase/client");
    await signOutAndClear(qc, supabase.auth);
    expect(lastValidatedUserId()).toBeNull();
  });
});
