import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { setupStatus, type SetupData } from "@/lib/setup-schema";

// A recording stand-in for the browser client: every query answers empty, and the table names are kept.
const calls: string[] = [];
const writes: string[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const chain = (t: string): unknown => new Proxy(function () {}, {
    get: (_t, k: string) => (k === "then"
      ? (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res, rej)
      : (...a: unknown[]) => { if (k === "update" || k === "delete" || k === "upsert") writes.push(`${t}.${k}:${JSON.stringify(a[0] ?? null)}`); return chain(t); }),
  });
  return { supabase: { from: (t: string) => { calls.push(t); return chain(t); } } };
});
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
let role = "owner";
vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { currentOrg: { org_id: "org-1" }, user: { id: "u-1" }, roles: [role] } }) }));
let setupData: SetupData;
vi.mock("@/hooks/use-setup", () => ({ useSetup: () => ({ data: { data: setupData, status: setupStatus(setupData) }, isLoading: false, isError: false, dataUpdatedAt: 1 }) }));

import { toast } from "sonner";
import { useSetupGuide } from "@/hooks/use-setup-guide";
import { GuideOffer } from "@/components/setup/guide";
import { dayAfter } from "@/lib/setup-guide";

const fullPos = Object.fromEntries(["best_customers", "alternatives", "differentiation", "value", "trend", "target_customer", "need", "category", "key_benefit", "competitive_alternative", "differentiator", "one_liner", "elevator_pitch"].map((k) => [k, "texto"]));
const full: SetupData = {
  currency: "EUR", segments: [{ name: "Seg A", acv_min: 1, acv_max: 2, win_rate_target: 20, ae_quota: 100 }], icps: [{ industries: "a", company_size: "b", why_fit: "c", anti_icp: "d" }],
  positioning: fullPos, pillars: [1, 2, 3].map((n) => ({ title: `T${n}`, message: `M${n}` })), quotas: [{ period: "2026-Q4", amount: 100 }], accounts: 1, deals: 1, quarter: "2026-Q4",
};
const ACTIVITY_TABLES = ["positioning", "segments", "quotas", "accounts", "deals", "icp_profiles", "messaging_pillars"];
let client = new QueryClient();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const settle = () => new Promise((r) => setTimeout(r, 50));

describe("useSetupGuide loads only what the screen needs (the sidebar mounts it on every screen)", () => {
  beforeEach(() => { calls.length = 0; role = "owner"; client = new QueryClient(); vi.mocked(toast.info).mockClear(); try { sessionStorage.clear(); } catch { /* none */ } });

  it("queries nothing once every step is complete", async () => {
    setupData = full;
    const { result } = renderHook(() => useSetupGuide(), { wrapper });
    await settle();
    expect(calls).toEqual([]);
    expect(result.current.guide?.complete).toBe(true);
  });

  it("with steps pending and no activity asked, reads only the snoozes: one query", async () => {
    setupData = { ...full, deals: 0 };
    const { result } = renderHook(() => useSetupGuide(), { wrapper });
    await waitFor(() => expect(result.current.guide).not.toBeNull());
    await settle();
    expect(calls).toEqual(["setup_step_snoozes"]);
    expect(result.current.nextStep?.id).toBe("deals");
  });

  it("reads the activity of the data only when asked, as Inicio's nudge does", async () => {
    setupData = { ...full, deals: 0 };
    const { result } = renderHook(() => useSetupGuide({ activity: true }), { wrapper });
    await waitFor(() => expect(result.current.guide).not.toBeNull());
    await settle();
    for (const t of ACTIVITY_TABLES) expect(calls, t).toContain(t);
  });

  it("reads the members only when a pending step is not the person's to complete (CA-8)", async () => {
    setupData = { ...full, quotas: [] }; // quota: leaders only
    role = "ae";
    const { result } = renderHook(() => useSetupGuide(), { wrapper });
    await waitFor(() => expect(result.current.guide).not.toBeNull());
    await settle();
    expect(calls).toContain("org_members");
    calls.length = 0;
    role = "owner";
    renderHook(() => useSetupGuide(), { wrapper });
    await settle();
    expect(calls).not.toContain("org_members");
  });
});

describe("postponing again counts as activity (M-1)", () => {
  it("every postponement and every clearing rewrites created_at, the time the nudge reads as the person's last act", async () => {
    setupData = { ...full, deals: 0 };
    writes.length = 0;
    const { result } = renderHook(() => useSetupGuide(), { wrapper });
    await waitFor(() => expect(result.current.guide).not.toBeNull());
    const day = dayAfter(new Date(), 2);
    expect(await result.current.snooze("deals", day)).toBe(true);
    expect(writes[0]).toMatch(/^setup_step_snoozes\.upsert:\{"org_id":"org-1","step_id":"deals","snoozed_until":"[^"]+","snoozed_by":"u-1","created_at":"\d{4}-\d{2}-\d{2}T[\d:.]+Z"\}$/);
    await result.current.unsnooze("deals");
    expect(writes[1]).toMatch(/"created_at":"\d{4}-\d{2}-\d{2}T[\d:.]+Z"/);
  });
});

describe("clearing a postponement", () => {
  it("ends it now instead of deleting the row, so the returning suggestion gets a key of its own", async () => {
    setupData = { ...full, deals: 0 };
    writes.length = 0;
    const { result } = renderHook(() => useSetupGuide(), { wrapper });
    await waitFor(() => expect(result.current.guide).not.toBeNull());
    await result.current.unsnooze("deals");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^setup_step_snoozes\.update:\{"snoozed_until":"\d{4}-\d{2}-\d{2}T[\d:.]+Z","snoozed_by":"u-1","created_at":"\d{4}-\d{2}-\d{2}T[\d:.]+Z"\}$/);
  });
});

describe("the guide reacts to edits made anywhere, without a reload", () => {
  beforeEach(() => { calls.length = 0; role = "owner"; client = new QueryClient(); vi.mocked(toast.info).mockClear(); try { sessionStorage.clear(); } catch { /* none */ } });

  it("CA-5: an edit that makes a step incomplete turns it back to Pendiente and says so, once", async () => {
    setupData = full;
    const { result, rerender } = renderHook(() => useSetupGuide(), { wrapper });
    await settle();
    expect(toast.info).not.toHaveBeenCalled();
    setupData = { ...full, icps: [] };
    rerender();
    await waitFor(() => expect(result.current.guide?.steps.find((s) => s.id === "icp")?.state).toBe("pending"));
    expect(toast.info).toHaveBeenCalledWith("Paso pendiente de nuevo: tu ICP.", expect.objectContaining({ id: "setup-reopened:icp" }));
    rerender();
    await settle();
    expect(new Set(vi.mocked(toast.info).mock.calls.map((c) => (c[1] as { id: string }).id))).toEqual(new Set(["setup-reopened:icp"])); // same id: copies of the hook share one notice
  });

  it("CA-10: in the Agent panel, finishing a step says what you have now and proposes the next one", async () => {
    setupData = { ...full, pillars: [], deals: 0 };
    const ui = () => <GuideOffer scope="agent" orgId="org-1" onStart={() => {}} />; // a new element per render, or React skips it
    const { rerender } = render(ui(), { wrapper });
    expect(await screen.findByText("Siguiente: escribe tus tres pilares de mensaje.")).toBeInTheDocument();
    setupData = { ...full, deals: 0 }; // the pillars were saved from the Agent's confirmed action
    rerender(ui());
    expect(await screen.findByText("Ya tienes tus tres pilares de mensaje. Siguiente: crea tu primer deal.")).toBeInTheDocument();
    expect(screen.getByText(/Así Nokko podrá calcular métricas/)).toBeInTheDocument();
  });
});
