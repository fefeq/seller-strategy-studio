import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ user: { id: "synthetic-user" } as { id: string } | null, rpc: vi.fn(), from: vi.fn(), validated: vi.fn(), load: vi.fn(), callbacks: [] as (() => void)[] }));
vi.mock("@/lib/session", () => ({ validatedUser: h.validated }));
vi.mock("@/lib/org-data", () => ({ loadSetupData: h.load }));
vi.mock("@/lib/setup-schema", () => ({ setupStatus: () => ({}) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: h.user ? { user: h.user } : null } }) },
  rpc: h.rpc, from: h.from,
  channel: () => { const c = { on: (_kind: string, _filter: unknown, fn: () => void) => { h.callbacks.push(fn); return c; }, subscribe: () => c }; return c; },
  removeChannel: vi.fn(),
} }));
import { meQuery } from "./use-me";
import { useSetup } from "./use-setup";
import { useLivePipeline } from "./use-live-pipeline";
import { beginSessionEnd, endSessionEnd, SessionEndedError } from "@/lib/session-ending";

const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = (client: QueryClient) => ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => {
  endSessionEnd(); vi.clearAllMocks(); h.callbacks.length = 0; h.user = { id: "synthetic-user" };
  h.validated.mockImplementation(async () => h.user);
  h.rpc.mockResolvedValue({ data: null });
  h.from.mockImplementation((table: string) => { const c = { select: () => c, eq: () => c, maybeSingle: async () => ({ data: { current_org_id: "synthetic-org" } }),
    then: (resolve: (value: unknown) => void) => resolve({ data: table === "org_members" ? [{ org_id: "synthetic-org", role: "owner", organizations: { name: "Empresa sintética", currency: "EUR" } }] : null }) }; return c; });
});
afterEach(() => { cleanup(); endSessionEnd(); vi.useRealTimers(); });

describe("F4: reads while the old token remains valid during sign-out", () => {
  it("does not accept invites or read profiles/members if sign-out began during validation", async () => {
    h.validated.mockImplementation(async () => { beginSessionEnd(); return h.user; });
    const client = qc();
    expect(await client.fetchQuery(meQuery)).toBeNull();
    expect(h.rpc).not.toHaveBeenCalled(); expect(h.from).not.toHaveBeenCalled(); client.clear();
  });
  it("does not read profiles/members if sign-out starts while accept_invites is in flight", async () => {
    h.rpc.mockImplementation(async () => { beginSessionEnd(); return { data: null }; });
    const client = qc();
    expect(await client.fetchQuery(meQuery)).toBeNull();
    expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.from).not.toHaveBeenCalled(); client.clear();
  });
  it("still returns null with no user during sign-out (NK-0098)", async () => {
    h.user = null; beginSessionEnd(); const client = qc();
    expect(await client.fetchQuery(meQuery)).toBeNull(); expect(h.rpc).not.toHaveBeenCalled(); client.clear();
  });
  it("useSetup never reads during the quiet window, including explicit refetch", async () => {
    const client = qc();
    client.setQueryData(["me"], { currentOrg: { org_id: "synthetic-org" } });
    beginSessionEnd();
    const { result } = renderHook(() => useSetup(), { wrapper: wrapper(client) });
    await act(async () => {
      const refreshed = await result.current.refetch();
      expect(refreshed.error).toBeInstanceOf(SessionEndedError);
    });
    expect(h.load).not.toHaveBeenCalled(); client.clear();
  });
  it("useLivePipeline suppresses a queued refresh during sign-out and refreshes once open", async () => {
    vi.useFakeTimers(); const client = qc(); const invalidate = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useLivePipeline("synthetic-org"), { wrapper: wrapper(client) });
    act(() => { h.callbacks[0]?.(); beginSessionEnd(); vi.advanceTimersByTime(600); });
    expect(invalidate).not.toHaveBeenCalled();
    act(() => { endSessionEnd(); h.callbacks[0]?.(); vi.advanceTimersByTime(600); });
    expect(invalidate).toHaveBeenCalledTimes(1); client.clear();
  });
});