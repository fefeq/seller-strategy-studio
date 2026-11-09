// NK-0098 round 2 (adopted from the sprint2 gate): a failed validation is never kept as «no user» by meQuery.
// Fake Supabase client counting calls; fictional tokens and ids, no network.
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as { access_token: string; user: { id: string } } | null,
  getUser: 0,
  failNext: 0,
  listeners: [] as ((e: string, s: unknown) => void)[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const rows = (data: unknown) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = async () => ({ data: { id: "x", current_org_id: "org-1" } });
    q.then = (r: (v: unknown) => unknown) => r({ data });
    return q;
  };
  return {
    supabase: {
      rpc: async () => ({ data: null }),
      from: (t: string) =>
        rows(
          t === "org_members"
            ? [
                {
                  org_id: "org-1",
                  role: "owner",
                  organizations: {
                    name: "Empresa ficticia",
                    currency: "EUR",
                    website: null,
                    archived_at: null,
                  },
                },
              ]
            : null,
        ),
      auth: {
        getSession: async () => ({ data: { session: h.session } }),
        getUser: async (jwt?: string) => {
          h.getUser++;
          await Promise.resolve();
          // supabase-js returns (does not throw) AuthRetryableFetchError on a network blip.
          if (h.failNext > 0) {
            h.failNext--;
            return {
              data: { user: null },
              error: new Error("AuthRetryableFetchError: Failed to fetch"),
            };
          }
          // Without a jwt supabase-js validates the stored session (the base code path).
          const token = jwt ?? h.session?.access_token;
          if (!token) return { data: { user: null }, error: new Error("no session") };
          return { data: { user: { id: token.split(":")[0] } }, error: null };
        },
        onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
          h.listeners.push(cb);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    },
  };
});

let meQuery: typeof import("@/hooks/use-me").meQuery;
let isSignedIn: () => Promise<boolean>;
const ana = { access_token: "user-ana:1", user: { id: "user-ana" } };
const bea = { access_token: "user-bea:1", user: { id: "user-bea" } };

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  ({ meQuery } = await import("@/hooks/use-me"));
  // The route guard exactly as src/routes/_authenticated/route.tsx builds it (exists at base and at dfc0ba9).
  const { supabase } = await import("@/integrations/supabase/client");
  const { createSessionCheck } = await import("@/lib/session-check");
  isSignedIn = createSessionCheck(
    supabase.auth as unknown as Parameters<typeof createSessionCheck>[0],
  );
  h.session = ana;
  h.getUser = 0;
  h.failNext = 0;
});

describe("gate extra NK-0098: meQuery cache", () => {
  it("another user after SIGNED_OUT + SIGNED_IN never gets the previous user's me (fetchQuery after invalidation)", async () => {
    const qc = new QueryClient();
    expect((await qc.fetchQuery(meQuery))?.user.id).toBe("user-ana");
    h.session = null;
    h.listeners.forEach((l) => l("SIGNED_OUT", null));
    await qc.invalidateQueries({ queryKey: ["me"] });
    h.session = bea;
    h.listeners.forEach((l) => l("SIGNED_IN", bea));
    await qc.invalidateQueries();
    expect((await qc.fetchQuery(meQuery))?.user.id).toBe("user-bea");
  });

  it("a transient /auth/v1/user failure is not kept as «no user» once the guard has re-validated", async () => {
    const qc = new QueryClient();
    h.failNext = 1;
    await expect(qc.fetchQuery(meQuery)).rejects.toThrow(); // the blip: failed, not cached as «no user»
    expect(await isSignedIn()).toBe(true); // next navigation: the guard asks again and lets the user in
    // The shell (useMe) mounts again inside the 5-minute window: does it get the user or the cached null?
    const again = await qc.fetchQuery(meQuery);
    expect(again?.user.id, "me after a transient refusal and a successful guard").toBe("user-ana");
  });
});
