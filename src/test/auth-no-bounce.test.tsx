// NK-0098 round 4 (adopted from the sprint2 gate): no /home <-> /auth bounce with the real router and route tree.
// Measures, over 1 s, the /auth/v1/user calls and the redirects for: network down, persistent 503 and a definitive 401.
// Fictional session, no network.
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

const h = vi.hoisted(() => ({
  mode: "network" as "network" | "503" | "401",
  session: null as { access_token: string; user: { id: string; created_at: string } } | null,
  getUser: 0,
  signOut: 0,
  listeners: [] as ((e: string, s: unknown) => void)[],
}));
vi.mock("@/integrations/supabase/client", () => {
  const empty = { data: [], count: 0, error: null };
  const chain = (): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) => Promise.resolve(empty).then(f)
            : () => chain(),
      },
    );
  const error = () =>
    h.mode === "network"
      ? Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError", status: 0 })
      : Object.assign(new Error(h.mode), {
          name: h.mode === "503" ? "AuthRetryableFetchError" : "AuthApiError",
          status: Number(h.mode),
        });
  return {
    supabase: {
      from: () => chain(),
      rpc: () => chain(),
      channel: () => chain(),
      removeChannel: () => undefined,
      functions: { invoke: async () => ({ data: null, error: null }) },
      auth: {
        getSession: async () => ({ data: { session: h.session }, error: null }),
        getUser: async () => {
          h.getUser++;
          await new Promise((r) => setTimeout(r, 5)); // a failing request still takes a few ms
          return { data: { user: null }, error: error() };
        },
        signOut: async () => {
          h.signOut++;
          h.session = null;
          h.listeners.forEach((l) => l("SIGNED_OUT", null));
          return { error: null };
        },
        onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
          h.listeners.push(cb);
          // Like supabase-js: a new subscriber is told about the stored session (may be stale).
          queueMicrotask(() => cb("INITIAL_SESSION", h.session));
          return {
            data: {
              subscription: {
                unsubscribe: () => (h.listeners = h.listeners.filter((l) => l !== cb)),
              },
            },
          };
        },
      },
    },
  };
});

afterEach(cleanup);

async function measure(mode: typeof h.mode) {
  h.mode = mode;
  h.session = {
    access_token: "user-ana:1",
    user: { id: "user-ana", created_at: "2026-01-01T00:00:00Z" },
  };
  h.getUser = 0;
  h.signOut = 0;
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: ["/home"] }),
  });
  let toAuth = 0;
  const paths: string[] = [];
  router.subscribe("onResolved", (e) => {
    if (e.toLocation.pathname === "/auth") toAuth++;
    if (paths.length < 8) paths.push(e.toLocation.pathname);
  });
  render(<RouterProvider router={router} />);
  await act(async () => new Promise((r) => setTimeout(r, 1000)));
  const out = {
    mode,
    getUserPerSecond: h.getUser,
    redirectsToAuth: toAuth,
    signOut: h.signOut,
    finalPath: router.state.location.pathname,
    firstPaths: paths.join(">"),
  };
  console.log("BOUNCE", JSON.stringify(out));
  return out;
}

describe("a failing session check settles on /auth (NK-0098 r4)", () => {
  for (const [name, mode] of [
    ["network down", "network"],
    ["persistent 503", "503"],
    ["definitive 401", "401"],
  ] as const)
    it(`${name}: ends on /auth, at most 3 /auth/v1/user calls in 1 s`, async () => {
      const r = await measure(mode);
      expect(r.finalPath, "no /home <-> /auth loop").toBe("/auth");
      expect(r.getUserPerSecond).toBeLessThanOrEqual(3);
    });
});
