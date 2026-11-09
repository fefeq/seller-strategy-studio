// NK-0098: meQuery must not ask /auth/v1/user on every navigation or remount.
// The Supabase client is a fake that counts calls. Fictional tokens and ids, no network.
import { readFileSync } from "node:fs";
import path from "node:path";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as { access_token: string; user: { id: string } } | null,
  getUser: 0,
  rpc: 0,
  revoked: new Set<string>(),
  listeners: [] as ((e: string, s: unknown) => void)[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const rows = (data: unknown) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = async () => ({ data: { id: "x", current_org_id: null } });
    q.then = (r: (v: unknown) => unknown) => r({ data });
    return q;
  };
  return {
    supabase: {
      rpc: async () => {
        h.rpc++;
        return { data: null };
      },
      from: (t: string) => rows(t === "org_members" ? [] : null),
      auth: {
        getSession: async () => ({ data: { session: h.session } }),
        getUser: async (jwt?: string) => {
          h.getUser++;
          await Promise.resolve();
          if (!jwt || h.revoked.has(jwt))
            return { data: { user: null }, error: new Error("session_not_found") };
          return { data: { user: { id: jwt.split(":")[0] } }, error: null };
        },
        onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
          h.listeners.push(cb);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    },
  };
});

// Fresh module state per test: the validator keeps its saved token at module level.
let meQuery: typeof import("./use-me").meQuery;
let isSignedIn: typeof import("@/lib/session").isSignedIn;

const ana1 = { access_token: "user-ana:1", user: { id: "user-ana" } };
const ana2 = { access_token: "user-ana:2", user: { id: "user-ana" } };

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  ({ meQuery } = await import("./use-me"));
  ({ isSignedIn } = await import("@/lib/session"));
  h.session = ana1;
  h.getUser = 0;
  h.rpc = 0;
  h.revoked.clear();
});

describe("meQuery session cost (NK-0098)", () => {
  it("guard + meQuery over N navigations and remounts cost one getUser", async () => {
    const qc = new QueryClient();
    for (let i = 0; i < 12; i++) {
      expect(await isSignedIn()).toBe(true);
      // Shell and the mobile drawer both mount useMe on every navigation.
      await Promise.all([qc.fetchQuery(meQuery), qc.fetchQuery(meQuery)]);
    }
    expect(h.getUser).toBe(1);
    // Remounts inside the stale window reuse the cached me: one load, not 24.
    expect(h.rpc).toBe(1);
    expect((await qc.fetchQuery(meQuery))?.user.id).toBe("user-ana");
  });

  it("the route guard built on supabase.auth shares the validation with meQuery", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { createSessionCheck } = await import("@/lib/session-check");
    const routeGuard = createSessionCheck(
      supabase.auth as unknown as Parameters<typeof createSessionCheck>[0],
    );
    const qc = new QueryClient();
    expect(await routeGuard()).toBe(true);
    await qc.fetchQuery(meQuery);
    expect(await routeGuard()).toBe(true);
    expect(h.getUser).toBe(1);
  });

  it("a changed token costs exactly one more getUser", async () => {
    const qc = new QueryClient();
    await isSignedIn();
    await qc.fetchQuery(meQuery);
    h.session = ana2;
    h.listeners.forEach((l) => l("TOKEN_REFRESHED", ana2));
    await qc.invalidateQueries({ queryKey: ["me"] });
    await isSignedIn();
    await qc.fetchQuery(meQuery);
    expect(h.getUser).toBe(2);
  });

  it("a rejected session is not cached as a user", async () => {
    h.revoked.add("user-ana:1");
    const qc = new QueryClient();
    expect(await qc.fetchQuery(meQuery)).toBeNull();
    h.revoked.clear();
    await qc.invalidateQueries({ queryKey: ["me"] });
    expect((await qc.fetchQuery(meQuery))?.user.id).toBe("user-ana");
    expect(h.getUser).toBe(2);
  });

  it("the root refreshes me on token refresh and sign-out", () => {
    const src = readFileSync(path.resolve(__dirname, "../routes/__root.tsx"), "utf8");
    expect(src).toMatch(
      /TOKEN_REFRESHED[\s\S]{0,80}SIGNED_OUT[\s\S]{0,120}invalidateQueries\(\{ queryKey: \["me"\] \}\)/,
    );
  });
});
