// NK-0122 (CA-3): approving or denying an OAuth connection validates the session again at that moment, with the
// shared validator (checkSession), instead of trusting what the loader saw minutes ago. Fictional ids, no network.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: { status: "none" } as
    | { status: "valid"; user: { id: string; email: string } }
    | { status: "none" }
    | { status: "unverified" },
  approve: 0,
  deny: 0,
  checks: 0,
  directGetUser: 0,
  navigated: [] as unknown[],
}));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useNavigate: () => (opts: unknown) => h.navigated.push(opts),
}));
vi.mock("@/lib/session", () => ({
  checkSession: async () => {
    h.checks++;
    return h.state;
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => {
        h.directGetUser++;
        return { data: { user: null }, error: null };
      },
      oauth: {
        approveAuthorization: async () => {
          h.approve++;
          return { data: { redirect_url: "https://assistant.example.test/back" }, error: null };
        },
        denyAuthorization: async () => {
          h.deny++;
          return { data: { redirect_url: "https://assistant.example.test/denied" }, error: null };
        },
      },
    },
  },
}));

import { Route } from "@/routes/[.]lovable.oauth.consent";

const LOADED_AS = "user-ana";
const DETAILS = { client: { name: "Asistente ficticio" }, scope: "openid email" };
const NO_SESSION = "No he podido comprobar tu sesión. Vuelve a intentarlo.";

// Narrow casts (with reasons): the route object is a TanStack Route whose hooks need a router; the screen is
// exercised as a plain component with the loader data and search it would get.
const route = Route as unknown as {
  useLoaderData: () => unknown;
  useSearch: () => unknown;
  options: { component: React.ComponentType };
};
const Consent = route.options.component;

beforeEach(() => {
  h.state = { status: "none" };
  h.approve = h.deny = h.checks = h.directGetUser = 0;
  h.navigated.length = 0;
  route.useLoaderData = () => ({ details: DETAILS, email: "ana@example.test", userId: LOADED_AS });
  route.useSearch = () => ({ authorization_id: "auth-1" });
  window.history.pushState({}, "", "/.lovable/oauth/consent?authorization_id=auth-1");
});
afterEach(cleanup);

const click = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("decide() re-validates the session (NK-0122)", () => {
  for (const [label, button, counter] of [
    ["approve", /Aprobar/, "approve"],
    ["deny", /Cancelar conexión/, "deny"],
  ] as const) {
    it(`${label}, valid and same user: goes ahead`, async () => {
      h.state = { status: "valid", user: { id: LOADED_AS, email: "ana@example.test" } };
      render(<Consent />);
      click(button);
      await waitFor(() => expect(h[counter]).toBe(1));
      expect(h.checks).toBe(1);
      expect(h.directGetUser).toBe(0);
    });

    it(`${label}, none: goes to /auth with next and does not call the server`, async () => {
      h.state = { status: "none" };
      render(<Consent />);
      click(button);
      await waitFor(() =>
        expect(h.navigated).toEqual([
          { to: "/auth", search: { next: "/.lovable/oauth/consent?authorization_id=auth-1" } },
        ]),
      );
      expect(h.approve + h.deny).toBe(0);
    });

    it(`${label}, unverified: shows the approved text and does not call the server`, async () => {
      h.state = { status: "unverified" };
      render(<Consent />);
      click(button);
      expect(await screen.findByText(NO_SESSION)).toBeTruthy();
      expect(h.approve + h.deny).toBe(0);
      // The person can try again once the check works.
      expect((screen.getByRole("button", { name: button }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    it(`${label}, another user validated than the one who opened the request: does not call the server`, async () => {
      h.state = { status: "valid", user: { id: "user-bea", email: "bea@example.test" } };
      render(<Consent />);
      click(button);
      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(h.approve + h.deny).toBe(0);
    });
  }
});
