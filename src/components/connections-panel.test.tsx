// Walk-through of «Tus cuentas» with fictitious data: the real panel, with Supabase, the role and the server
// functions replaced. Nothing here reaches the network, a real project or a real credential.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "owner" as string,
  provided: ["apollo", "google_drive"] as string[],
  own: [] as Record<string, unknown>[],
  connect: vi.fn(),
  disconnect: vi.fn(),
  confirm: vi.fn(async () => true),
}));

vi.mock("@/integrations/supabase/client", () => {
  const data = (t: string) => {
    if (t === "org_connections") return state.own;
    if (t === "posthog_connections") return { project_id: "12345", status: "ok", created_at: "2026-10-20T10:00:00Z", created_by: "u1", last_error: null };
    if (t === "stripe_connections") return { account_name: "Acme Prueba", key_hint: "wxyz", status: "error", created_at: "2026-10-21T10:00:00Z", connected_by: "u2", last_error: "La clave ha caducado." };
    if (t === "profiles") return [{ id: "u1", full_name: "Ana Prueba" }, { id: "u2", full_name: "Luis Prueba" }];
    return null;
  };
  const from = (t: string) => {
    const b = { select: () => b, maybeSingle: async () => ({ data: data(t), error: null }), then: (res: (v: unknown) => unknown) => res({ data: data(t), error: null }) };
    return b;
  };
  return { supabase: { from } };
});
vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { roles: [state.role] } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/connections.functions", () => ({
  nokkoProvidedFn: async () => ({ provided: state.provided }),
  connectAccountFn: (a: unknown) => state.connect(a),
  disconnectAccountFn: (a: unknown) => state.disconnect(a),
}));
vi.mock("@/components/confirm-dialog", () => ({ askConfirm: () => state.confirm() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Apollo is switched on here only to walk the connect form; in the registry every provider is still off.
vi.mock("@/lib/connections", async (orig) => {
  const m = await orig<typeof import("@/lib/connections")>();
  return { ...m, PROVIDERS: m.PROVIDERS.map((p) => (p.id === "apollo" ? { ...p, ownAccount: true } : p)) };
});

import { ConnectionsPanel } from "./connections-panel";

const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ConnectionsPanel /></QueryClientProvider>);
const card = (name: string) => screen.getByText(name).closest("div.rounded-lg") as HTMLElement;

beforeEach(() => { state.role = "owner"; state.own = []; state.connect.mockReset(); state.disconnect.mockReset(); });
afterEach(cleanup);

describe("Tus cuentas, walk-through with fictitious data", () => {
  it("CA-1, CA-2, CA-3: every provider shows a state in words, the account, who connected it and what it is for", async () => {
    show();
    await waitFor(() => expect(card("PostHog")).toHaveTextContent("Cuenta propia"));
    expect(card("PostHog")).toHaveTextContent("Proyecto 12345 · conectada por Ana Prueba");
    expect(card("PostHog")).toHaveTextContent("uso de producto");
    expect(card("Stripe")).toHaveTextContent("Error");
    expect(card("Stripe")).toHaveTextContent("Acme Prueba · conectada por Luis Prueba");
    expect(card("Stripe")).toHaveTextContent("La clave ha caducado.");
    expect(card("Apollo.io")).toHaveTextContent("Proporcionada por NOKKO");
    expect(card("Google Drive")).toHaveTextContent("Solo proporcionada por NOKKO");
    expect(card("Clay")).toHaveTextContent("Sin conectar");
  });

  it("never shows a credential or key hint", async () => {
    const { container } = show();
    await waitFor(() => expect(card("Stripe")).toHaveTextContent("Error"));
    expect(container.textContent).not.toContain("wxyz");
  });

  it("CA-11: a non-owner sees the states read-only and no buttons", async () => {
    state.role = "member";
    show();
    await waitFor(() => expect(card("PostHog")).toHaveTextContent("Cuenta propia"));
    expect(screen.getByText(/Solo el Owner de la empresa puede conectar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conectar mi cuenta|Cambiar|Desconectar/ })).toBeNull();
  });

  it("with own accounts off, the owner gets no connect button on providers that are off (Drive, Clay)", async () => {
    show();
    await waitFor(() => expect(card("Clay")).toHaveTextContent("Sin conectar"));
    expect(card("Clay").querySelector("button")).toBeNull();
    expect(card("Google Drive").querySelector("button")).toBeNull();
  });

  it("CA-4, CA-5: the guided steps, the key is masked, and the account is shown before saving", async () => {
    state.connect.mockResolvedValueOnce({ ok: true, saved: false, accountLabel: "ventas@acme.test", needsConfirmation: false, message: "Funciona. Cuenta: ventas@acme.test." });
    show();
    await waitFor(() => expect(card("Apollo.io")).toHaveTextContent("Proporcionada por NOKKO"));
    fireEvent.click(screen.getByRole("button", { name: "Conectar mi cuenta" }));
    expect(card("Apollo.io")).toHaveTextContent("Crea una clave en tu cuenta de Apollo.io.");
    const input = screen.getByLabelText("Clave de Apollo.io") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "clave-ficticia-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Funciona. Cuenta: ventas@acme.test."));
    expect(state.connect).toHaveBeenCalledWith({ data: { provider: "apollo", credential: "clave-ficticia-123", mode: "check", confirmShared: false } });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("CA-6: a failed check explains why, offers no Guardar button and changes nothing", async () => {
    state.connect.mockResolvedValueOnce({ ok: false, message: "La clave no es válida. No hemos guardado la conexión." });
    show();
    await waitFor(() => expect(card("Apollo.io")).toHaveTextContent("Proporcionada por NOKKO"));
    fireEvent.click(screen.getByRole("button", { name: "Conectar mi cuenta" }));
    fireEvent.change(screen.getByLabelText("Clave de Apollo.io"), { target: { value: "mala" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("La clave no es válida. No hemos guardado la conexión."));
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
  });

  it("section 8: an account connected in another company asks for confirmation and then saves", async () => {
    state.connect
      .mockResolvedValueOnce({ ok: true, saved: false, accountLabel: "ventas@acme.test", needsConfirmation: true, message: "Funciona. Cuenta: ventas@acme.test. Esta cuenta ya está conectada en otra empresa de NOKKO. Si continúas, se usará en las dos." })
      .mockResolvedValueOnce({ ok: true, saved: true, accountLabel: "ventas@acme.test", message: "Funciona. Cuenta: ventas@acme.test." });
    show();
    await waitFor(() => expect(card("Apollo.io")).toHaveTextContent("Proporcionada por NOKKO"));
    fireEvent.click(screen.getByRole("button", { name: "Conectar mi cuenta" }));
    fireEvent.change(screen.getByLabelText("Clave de Apollo.io"), { target: { value: "clave-ficticia-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("otra empresa"));
    fireEvent.click(screen.getByRole("button", { name: "Usar igualmente" }));
    await waitFor(() => expect(state.connect).toHaveBeenLastCalledWith({ data: { provider: "apollo", credential: "clave-ficticia-123", mode: "save", confirmShared: true } }));
  });

  it("CA-7, CA-8: an own account can be changed or disconnected, and disconnecting says the data stays", async () => {
    state.own = [{ provider: "apollo", status: "connected", account_label: "ventas@acme.test", connected_by: "u1", connected_at: "2026-10-22T10:00:00Z", last_error: null, fallback_active: false }];
    state.disconnect.mockResolvedValueOnce({ ok: true, message: "NOKKO deja de usar tu cuenta de Apollo.io ahora mismo." });
    show();
    await waitFor(() => expect(card("Apollo.io")).toHaveTextContent("Cuenta propia"));
    expect(card("Apollo.io")).toHaveTextContent("ventas@acme.test · conectada por Ana Prueba");
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(state.disconnect).toHaveBeenCalledWith({ data: { provider: "apollo" } }));
    expect(state.confirm).toHaveBeenCalled();
  });

  it("CA-13: says NOKKO's account covers while an own account has no credit", async () => {
    state.own = [{ provider: "apollo", status: "connected", account_label: "ventas@acme.test", connected_by: "u1", connected_at: "2026-10-22T10:00:00Z", last_error: null, fallback_active: true }];
    show();
    await waitFor(() => expect(card("Apollo.io")).toHaveTextContent("NOKKO usa la suya mientras tanto"));
  });
});
