// NK-0093 walkthrough round 2: opening or reloading /leads must never paint a blank page. Real router, real
// route tree, memory history at /leads, a slow session check and a leads fetch that never answers.
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

vi.mock("@/integrations/supabase/client", () => {
  const empty = { data: [], count: 0, error: null };
  const never = new Promise(() => undefined);
  const chain = (hang: boolean): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) => (hang ? never : Promise.resolve(empty).then(f))
            : () => chain(hang),
      },
    );
  const session = { access_token: "t", user: { id: "u1" } };
  return {
    supabase: {
      from: (table: string) => chain(table === "leads"),
      rpc: () => chain(false),
      channel: () => chain(false),
      removeChannel: () => undefined,
      auth: {
        getSession: async () => ({ data: { session } }),
        // The session check never answers: the page must still show a loading state.
        getUser: () => new Promise(() => undefined),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
    },
  };
});

afterEach(cleanup);

describe("first load of /leads", () => {
  it("shows a loading state at once, never a blank page", async () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
      history: createMemoryHistory({ initialEntries: ["/leads"] }),
    });
    const { container } = render(<RouterProvider router={router} />);
    // Session check and leads both pending: a loading state must already be on screen.
    expect(await screen.findByRole("status", {}, { timeout: 1000 })).toBeInTheDocument();
    expect(container.textContent).toContain("Cargando");
  });
});
