// NK-0110 / NK-0114: the places that need the signed-in user take it from the shared validator
// (`@/lib/session`, mocked here), never from their own GET /auth/v1/user. Fictional ids, no network.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NO_SESSION = "No he podido comprobar tu sesión. Vuelve a intentarlo.";

const h = vi.hoisted(() => ({
  validated: null as { id: string; email?: string } | null,
  state: { status: "none" } as
    | { status: "valid"; user: { id: string; email: string } }
    | { status: "none" }
    | { status: "unverified" },
  writes: [] as { table: string; op: string; payload: unknown; eq?: [string, unknown] }[],
  directGetUser: 0,
  toastError: [] as string[],
}));

vi.mock("@/lib/session", () => ({
  validatedUser: async () => h.validated,
  checkSession: async () => h.state,
  isSignedIn: async () => h.validated !== null,
}));
vi.mock("sonner", () => ({
  toast: { error: (m: string) => h.toastError.push(m), success: () => undefined },
}));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useNavigate: () => () => undefined,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/stage-settings", () => ({ useStages: () => ({ stages: [] }) }));
vi.mock("@/hooks/use-me", () => ({ useCurrency: () => ({ money: (n: number) => String(n) }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: unknown) => ({
        eq: async (col: string, v: unknown) => {
          h.writes.push({ table, op: "update", payload, eq: [col, v] });
          return { error: null };
        },
      }),
      insert: async (payload: unknown) => {
        h.writes.push({ table, op: "insert", payload });
        return { error: null };
      },
    }),
    rpc: async () => ({ error: null }),
    auth: {
      getUser: async () => {
        h.directGetUser++;
        return { data: { user: null }, error: null };
      },
      oauth: {
        getAuthorizationDetails: async () => ({
          data: { client: { name: "Asistente ficticio" }, scope: "openid email" },
          error: null,
        }),
      },
    },
  },
}));

import { OrgOnboarding } from "@/components/org-onboarding";
import { OrgCreateForm } from "@/components/org-create";
import { DealsTab } from "@/components/account/calls-deals-tabs";
import { SessionUnverifiedError } from "@/lib/session-check";
import { Route as ConsentRoute } from "@/routes/[.]lovable.oauth.consent";

const org = {
  org_id: "org-1",
  role: "owner",
  name: "Empresa Ficticia",
  currency: "EUR",
  website: null,
  archived: false,
};
const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  h.validated = null;
  h.state = { status: "none" };
  h.writes.length = 0;
  h.directGetUser = 0;
  h.toastError.length = 0;
});
afterEach(cleanup);

describe("OrgOnboarding.pick", () => {
  it("writes current_org_id for the validated user", async () => {
    h.validated = { id: "user-ana" };
    wrap(<OrgOnboarding memberships={[org]} />);
    fireEvent.click(screen.getByRole("button", { name: "Empresa Ficticia" }));
    await waitFor(() => expect(h.writes).toHaveLength(1));
    expect(h.writes[0]).toMatchObject({
      table: "profiles",
      payload: { current_org_id: "org-1" },
      eq: ["id", "user-ana"],
    });
    expect(h.directGetUser).toBe(0);
  });

  it("without a validated user shows the message and writes nothing", async () => {
    wrap(<OrgOnboarding memberships={[org]} />);
    fireEvent.click(screen.getByRole("button", { name: "Empresa Ficticia" }));
    await waitFor(() => expect(h.toastError).toEqual([NO_SESSION]));
    expect(h.writes).toEqual([]);
    expect(h.directGetUser).toBe(0);
  });
});

describe("OrgCreateForm.enter", () => {
  const open = () => {
    wrap(<OrgCreateForm orgs={[org]} location="test" />);
    fireEvent.change(screen.getByPlaceholderText("Nombre de la empresa"), {
      target: { value: "Empresa Ficticia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar en ella" }));
  };

  it("writes current_org_id for the validated user", async () => {
    h.validated = { id: "user-ana" };
    open();
    await waitFor(() => expect(h.writes).toHaveLength(1));
    expect(h.writes[0]).toMatchObject({
      table: "profiles",
      payload: { current_org_id: "org-1" },
      eq: ["id", "user-ana"],
    });
    expect(h.directGetUser).toBe(0);
  });

  it("without a validated user shows the message and writes nothing", async () => {
    open();
    await waitFor(() => expect(h.toastError).toEqual([NO_SESSION]));
    expect(h.writes).toEqual([]);
    expect(h.directGetUser).toBe(0);
  });
});

describe("DealsTab.add", () => {
  it("inserts the deal owned by the validated user", async () => {
    h.validated = { id: "user-ana" };
    wrap(<DealsTab accountId="acc-1" list={[]} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo deal" }));
    await waitFor(() => expect(h.writes).toHaveLength(1));
    expect(h.writes[0]).toMatchObject({
      table: "deals",
      op: "insert",
      payload: { account_id: "acc-1", owner_id: "user-ana" },
    });
    expect(h.directGetUser).toBe(0);
  });

  it("without a validated user shows the message and inserts nothing", async () => {
    wrap(<DealsTab accountId="acc-1" list={[]} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo deal" }));
    await waitFor(() => expect(h.toastError).toEqual([NO_SESSION]));
    expect(h.writes).toEqual([]);
  });
});

describe("OAuth consent loader (checkSession)", () => {
  // Narrow cast: the route's loader option is typed as function-or-object; ours is the function form.
  const loader = ConsentRoute.options.loader as unknown as (ctx: {
    location: { pathname: string; searchStr: string };
  }) => Promise<unknown>;
  const load = () =>
    loader({
      location: { pathname: "/.lovable/oauth/consent", searchStr: "?authorization_id=auth-1" },
    });

  it("valid: takes the email of the validated user", async () => {
    h.state = { status: "valid", user: { id: "user-ana", email: "ana@example.test" } };
    const data = await load();
    expect(data).toMatchObject({ email: "ana@example.test" });
    expect(h.directGetUser).toBe(0);
  });

  it("none: redirects to /auth with next", async () => {
    h.state = { status: "none" };
    await expect(load()).rejects.toMatchObject({
      options: { to: "/auth", search: { next: "/.lovable/oauth/consent?authorization_id=auth-1" } },
    });
  });

  it("unverified: throws SessionUnverifiedError and the error screen says so", async () => {
    h.state = { status: "unverified" };
    const err = await load().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SessionUnverifiedError);
    const ErrorScreen = ConsentRoute.options.errorComponent as React.ComponentType<{
      error: unknown;
    }>;
    render(<ErrorScreen error={err} />);
    expect(screen.getByText("No he podido comprobar tu sesión")).toBeTruthy();
    expect(screen.getByText(/Tu sesión sigue abierta/)).toBeTruthy();
  });
});
