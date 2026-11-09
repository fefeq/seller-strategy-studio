// NK-0100 · CA-1 and CA-2: /hub and /theory-u rewrite an unknown ?seccion= (and a blank ?q= on /hub) with `replace`,
// and leave a valid URL alone. Real router with memory history; the screens are stubs, the routes' own validateSearch and component are used.
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

// Real screens (they own the cleanup), with data and children stubbed; real router and the routes' own validateSearch.
vi.mock("@/integrations/supabase/client", () => {
  const chain = (): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) =>
                Promise.resolve({ data: [], count: 0, error: null }).then(f)
            : () => chain(),
      },
    );
  return { supabase: { from: () => chain() } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "u1" }, roles: ["owner"], currentOrg: { org_id: "o1" } } }),
}));
vi.mock("@/components/background", () => ({
  useJob: () => ({ running: false, start: vi.fn(), job: null }),
}));
vi.mock("@/components/drive", () => ({
  DriveImportButton: () => <button>Importar de Drive</button>,
  SaveToDriveButton: () => <button>Guardar en Drive</button>,
}));
vi.mock("@/components/linkedin", () => ({ BattlecardFromReviews: () => <span /> }));
vi.mock("@/components/drive-overview", () => ({ DriveAccountsPanel: () => <span /> }));
vi.mock("@/components/theory-u/journey", () => ({ UJourney: () => <span /> }));
vi.mock("@/components/theory-u/sensing", () => ({ Sensing: () => <span /> }));
vi.mock("@/components/theory-u/listening", () => ({ Listening: () => <span /> }));
vi.mock("@/components/theory-u/case-clinic", () => ({ CaseClinics: () => <span /> }));
vi.mock("@/components/theory-u/prototypes", () => ({ Prototypes: () => <span /> }));

import { Route as HubRoute } from "./hub";
import { Route as TheoryURoute } from "./theory-u";

type Opts = {
  validateSearch: (s: Record<string, unknown>) => Record<string, unknown>;
  component: () => React.JSX.Element;
};

async function open(path: "/hub" | "/theory-u", url: string) {
  const o = (path === "/hub" ? HubRoute : TheoryURoute).options as unknown as Opts;
  const root = createRootRoute();
  const layout = createRoute({ getParentRoute: () => root, id: "_authenticated" });
  const route = createRoute({
    getParentRoute: () => layout,
    path,
    validateSearch: o.validateSearch,
    component: o.component,
  });
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createRouter({
    routeTree: root.addChildren([layout.addChildren([route])]),
    history,
  });
  const nav = vi.spyOn(router, "navigate");
  const replace = vi.spyOn(history, "replace");
  const push = vi.spyOn(history, "push");
  const before = history.length;
  await act(async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await router.load();
  });
  await screen.findByText(
    path === "/hub" ? "Drive por cuenta" : "Liderar desde el futuro que emerge · Otto Scharmer",
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return { router, history, before, nav, replace, push };
}
afterEach(cleanup);

describe("URL limpia de /hub y /theory-u (NK-0100)", () => {
  it("/hub: unknown seccion and blank q are rewritten with replace (CA-1)", async () => {
    const { router, history, before } = await open("/hub", "/hub?seccion=nope&q=%20%20&doc=d1");
    expect(router.state.location.search).toEqual({ doc: "d1" });
    expect(history.location.search).toBe("?doc=d1");
    expect(history.length).toBe(before);
  });

  it("/hub: a lone unknown seccion goes away and the bare path remains (CA-1)", async () => {
    const { history, before } = await open("/hub", "/hub?seccion=otra-pantalla");
    expect(history.location.search).toBe("");
    expect(history.length).toBe(before);
  });

  it("/theory-u: unknown seccion is rewritten with replace (CA-1)", async () => {
    const { history, before } = await open("/theory-u", "/theory-u?seccion=nope");
    expect(history.location.search).toBe("");
    expect(history.length).toBe(before);
  });

  it("a valid URL is not rewritten and causes no navigation (CA-2)", async () => {
    for (const [path, url] of [
      ["/hub", "/hub?seccion=objections&q=precio&doc=d1"],
      ["/hub", "/hub?seccion=company"],
      ["/theory-u", "/theory-u?seccion=clinic"],
    ] as const) {
      const { history, nav, replace, push } = await open(path, url);
      expect(nav).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect(history.location.search).toBe(url.slice(url.indexOf("?")));
      cleanup();
    }
  });
});
