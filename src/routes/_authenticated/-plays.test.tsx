// SDD-20261110-play-teams U-3 (CA-11): the /plays route. parsePlaysSearch is tested pure; the real route tree is rendered with a memory
// history (pattern of src/test/auth-no-bounce.test.tsx): the views bar and which panel is drawn. Fictional session, no network.
// The file name starts with «-» so the router ignores it as a route.
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { parsePlaysSearch } from "@/lib/plays/search";
import { TEAMS_INTRO } from "@/lib/plays/teams";

const USER = { id: "user-ana", created_at: "2026-01-01T00:00:00Z" };
const SESSION = { access_token: "user-ana:plays-route", user: USER };
const DATA: Record<string, unknown> = {
  profiles: { id: "user-ana", current_org_id: "org-1", full_name: "Ana Prueba" },
  org_members: [
    {
      org_id: "org-1",
      role: "owner",
      organizations: {
        name: "Empresa de prueba",
        currency: "EUR",
        website: null,
        archived_at: null,
      },
    },
  ],
};

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string, one = false): object =>
    new Proxy(
      {},
      {
        get: (_t, p) => {
          if (p === "then") {
            const d = DATA[table];
            const data = one ? (Array.isArray(d) ? (d[0] ?? null) : (d ?? null)) : (d ?? []);
            return (f: (v: unknown) => unknown) =>
              Promise.resolve({ data, count: 0, error: null }).then(f);
          }
          return (..._a: unknown[]) => chain(table, one || p === "maybeSingle" || p === "single");
        },
      },
    );
  return {
    supabase: {
      from: (t: string) => chain(t),
      rpc: () => chain("rpc"),
      channel: () => chain("channel"),
      removeChannel: () => undefined,
      functions: { invoke: async () => ({ data: null, error: null }) },
      auth: {
        getSession: async () => ({ data: { session: SESSION }, error: null }),
        getUser: async () => ({ data: { user: USER }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
          queueMicrotask(() => cb("INITIAL_SESSION", SESSION));
          return { data: { subscription: { unsubscribe: () => undefined } } };
        },
      },
    },
  };
});

afterEach(cleanup);

async function open(entry: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(<RouterProvider router={router} />);
  const bar = await screen.findByRole(
    "navigation",
    { name: "Vistas de Plays GTM" },
    { timeout: 5000 },
  );
  return { router, bar: within(bar) };
}

describe("parsePlaysSearch (CA-11, G-1)", () => {
  it("accepts vista=equipos and drops anything else", () => {
    expect(parsePlaysSearch({ vista: "equipos" })).toEqual({ vista: "equipos" });
    expect(parsePlaysSearch({ vista: "otra" })).toEqual({ vista: undefined });
    expect(parsePlaysSearch({})).toEqual({ vista: undefined });
    expect(parsePlaysSearch({ vista: 3 })).toEqual({ vista: undefined });
  });
});

describe("the real /plays route (CA-11, G-1)", () => {
  it("?vista=equipos draws the views bar and PlayTeamsPanel, not PlaysPanel", async () => {
    const { router, bar } = await open("/plays?vista=equipos");
    expect(router.state.location.pathname).toBe("/plays");
    expect(bar.getByRole("link", { name: "Todos los plays" })).toBeTruthy();
    expect(bar.getByRole("link", { name: "Equipos de plays" })).toBeTruthy();
    expect(await screen.findByText(TEAMS_INTRO)).toBeTruthy();
    expect(screen.queryByLabelText("Filtrar por motion")).toBeNull();
  });

  it("with no parameter it draws the views bar and PlaysPanel, not the teams", async () => {
    const { bar } = await open("/plays");
    expect(bar.getByRole("link", { name: "Todos los plays" })).toBeTruthy();
    expect(bar.getByRole("link", { name: "Equipos de plays" })).toBeTruthy();
    expect(await screen.findByLabelText("Filtrar por motion")).toBeTruthy();
    expect(screen.queryByText(TEAMS_INTRO)).toBeNull();
  });

  it("an unknown vista falls back to the catalogue, and the links point at the two views", async () => {
    const { bar } = await open("/plays?vista=otra");
    expect(await screen.findByLabelText("Filtrar por motion")).toBeTruthy();
    expect(bar.getByRole("link", { name: "Todos los plays" }).getAttribute("href")).toBe("/plays");
    expect(bar.getByRole("link", { name: "Equipos de plays" }).getAttribute("href")).toBe(
      "/plays?vista=equipos",
    );
  });
});
