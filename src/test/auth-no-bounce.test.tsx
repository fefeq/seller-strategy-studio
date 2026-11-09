// NK-0098 round 4 (adopted from the sprint2 gate): no /home <-> /auth bounce with the real router and route tree.
// Measures, over 1 s, the /auth/v1/user calls and the redirects for: network down, persistent 503 and a definitive 401.
// Fictional session, no network.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

const h = vi.hoisted(() => ({
  mode: "network" as "network" | "503" | "401" | "ok",
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
          if (h.mode === "ok") return { data: { user: h.session?.user ?? null }, error: null };
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

const ANA = { id: "user-ana", created_at: "2026-01-01T00:00:00Z" };
// A new token per run: the validator keeps its saved answer per token for the life of the module.
let run = 0;
const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));

async function measure(mode: typeof h.mode, entry = "/home") {
  h.mode = mode;
  h.session = {
    access_token: `user-ana:run${++run}`,
    user: { id: "user-ana", created_at: "2026-01-01T00:00:00Z" },
  };
  h.getUser = 0;
  h.signOut = 0;
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  let toAuth = 0;
  const paths: string[] = [];
  // Every navigation that starts, also the ones a guard redirects away from before they resolve.
  const started: string[] = [];
  router.subscribe("onBeforeLoad", (e) => started.push(e.toLocation.pathname));
  router.subscribe("onResolved", (e) => {
    if (e.toLocation.pathname === "/auth") toAuth++;
    if (paths.length < 8) paths.push(e.toLocation.pathname);
  });
  render(<RouterProvider router={router} />);
  await act(async () => new Promise((r) => setTimeout(r, 1000)));
  const out = {
    router,
    paths,
    started,
    mode,
    getUserPerSecond: h.getUser,
    redirectsToAuth: toAuth,
    signOut: h.signOut,
    finalPath: router.state.location.pathname,
    firstPaths: paths.join(">"),
  };
  console.log(
    "BOUNCE",
    JSON.stringify({ ...out, router: undefined, paths: undefined, started: undefined }),
  );
  return out;
}

describe("a failing session check never bounces (NK-0098 r4, NK-0112)", () => {
  for (const [name, mode] of [
    ["network down", "network"],
    ["persistent 503", "503"],
    ["definitive 401", "401"],
  ] as const)
    it(`${name}: ${mode === "401" ? "ends on /auth" : "stays on /home with the retry screen"}, at most 3 /auth/v1/user calls in 1 s`, async () => {
      const r = await measure(mode);
      expect(r.finalPath, "no /home <-> /auth loop").toBe(mode === "401" ? "/auth" : "/home");
      expect(r.getUserPerSecond).toBeLessThanOrEqual(3);
      if (mode === "401") return;
      expect(screen.getByText("No he podido comprobar tu sesión")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
      expect(r.signOut, "the session is kept").toBe(0);
      expect(h.session, "the stored session stays").not.toBeNull();
      expect(r.redirectsToAuth).toBe(0);
    });

  it("Retry: once the server is back the requested route loads (one more call); while it still fails it stays, no loop", async () => {
    const r = await measure("503");
    const before = h.getUser;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("button", { name: "Reintentar" }); // the pending screen shows for a minimum time first
    expect(h.getUser - before, "one call per attempt").toBe(1);
    expect(r.router.state.location.pathname).toBe("/home");
    expect(screen.getByText("No he podido comprobar tu sesión")).toBeTruthy();
    expect(h.signOut).toBe(0);

    h.mode = "ok";
    const again = h.getUser;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByText("No he podido comprobar tu sesión")).toBeNull());
    expect(h.getUser - again, "one call for the successful retry").toBe(1);
    expect(r.router.state.location.pathname).toBe("/home");
    expect(screen.queryByText("No he podido comprobar tu sesión")).toBeNull();
  });

  it("401 while the retry screen is up: Retry closes the local session and goes to /auth", async () => {
    const r = await measure("503");
    h.mode = "401";
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(r.router.state.location.pathname).toBe("/auth"));
    expect(h.signOut).toBe(1);
  });
});

describe("/auth ignores session events it has not validated (NK-0113)", () => {
  it("persistent 503: 5x TOKEN_REFRESHED and 5x SIGNED_IN never navigate to /home", async () => {
    const r = await measure("503", "/auth");
    const mount = h.getUser;
    for (let i = 2; i <= 6; i++) {
      h.session = { access_token: `user-ana:run${run}:${i}`, user: ANA };
      await act(async () => {
        // Same token twice in the same tick: the in-flight request is shared.
        h.listeners.forEach((l) => l("TOKEN_REFRESHED", h.session));
        h.listeners.forEach((l) => l("SIGNED_IN", h.session));
      });
      await wait(30);
    }
    await wait(100);
    expect(
      r.started.filter((p) => p === "/home"),
      "no navigation to /home",
    ).toEqual([]);
    expect(r.router.state.location.pathname).toBe("/auth");
    expect(h.getUser - mount, "at most one call per distinct token").toBeLessThanOrEqual(5);
    expect(h.signOut).toBe(0);

    // Once the server validates the session, a SIGNED_IN does take you to /home.
    h.mode = "ok";
    h.session = { access_token: `user-ana:run${run}:7`, user: ANA };
    await act(async () => h.listeners.forEach((l) => l("SIGNED_IN", h.session)));
    await wait(300);
    expect(r.router.state.location.pathname).toBe("/home");
  });
});
