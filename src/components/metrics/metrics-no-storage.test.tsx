// NK-0148: with Node 26 (and in blocked-storage browsers) `localStorage` is undefined or throws. /metrics and the Inicio guide
// must still render: browser storage is only a convenience, never a requirement. Fictional data; no network.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/integrations/supabase/client", () => {
  const chain = (): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
                Promise.resolve({ data: [], error: null, count: 0 }).then(f, r)
            : () => chain(),
      },
    );
  return { supabase: { from: () => chain() } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({
    data: { user: { id: "u1" }, roles: ["owner"], currentOrg: { org_id: "o1", currency: "EUR" } },
  }),
  useCurrency: () => ({ currency: "EUR", symbol: "€", money: (n: number) => `${n} €` }),
}));
vi.mock("@/hooks/use-onboarding", () => ({ useOnboarding: () => ({ data: null }) }));
vi.mock("@/components/org-create", () => ({ OrgCreateForm: () => <div /> }));
vi.mock("@/hooks/use-leads", async () => {
  const { DEFAULT_LEAD_SLA } = await import("@/lib/lead-funnel");
  return {
    useLeads: () => ({
      data: { leads: [], sla: DEFAULT_LEAD_SLA, members: [] },
      isPending: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});
vi.mock("@/components/stage-settings", () => ({ useStages: () => ({ stages: null }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (r: unknown) => unknown }) =>
    select({ location: { pathname: "/metrics" } }),
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => ({}) }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/metrics/revops-panels", () => ({
  RevopsFunnel: () => <div />,
  RevopsLost: () => <div />,
  RevopsCohorts: () => <div />,
  RevopsTrends: () => <div />,
}));
vi.mock("@/components/metrics/performance-panels", () => ({
  Bar: () => <div />,
  Muted: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResumenKpis: () => <div>stub-resumen-kpis</div>,
  WinRatePanels: () => <div />,
}));
vi.mock("@/components/metrics/finance-panel", () => ({ FinancePanel: () => <div /> }));
vi.mock("@/components/leads/lead-funnel-panel", () => ({ LeadFunnelPanel: () => <div /> }));
vi.mock("@/components/stripe-panel", () => ({ StripeMetricsPanel: () => <div /> }));
vi.mock("@/components/segment-coverage", () => ({ SegmentCoverage: () => <div /> }));
vi.mock("@/components/cac-panel", () => ({ CacPanel: () => <div /> }));
vi.mock("@/components/won-deals-panel", () => ({ WonDealsPanel: () => <div /> }));
vi.mock("@/components/budget-panel", () => ({ BudgetPanel: () => <div /> }));
vi.mock("@/components/quarter-kpis-panel", () => ({ QuarterKpisPanel: () => <div /> }));
vi.mock("@/components/pipeline-board-panel", () => ({ PipelineBoardPanel: () => <div /> }));
vi.mock("@/components/self-service-funnel", () => ({ SelfServiceFunnel: () => <div /> }));

type Mode = "undefined" | "throws";
const NAMES = ["localStorage", "sessionStorage"] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();

function breakStorage(mode: Mode) {
  for (const name of NAMES) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get: () => {
        if (mode === "throws") throw new DOMException("denied", "SecurityError");
        return undefined;
      },
    });
  }
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  cleanup();
  for (const [name, d] of saved) {
    if (d) Object.defineProperty(globalThis, name, d);
    else delete (globalThis as Record<string, unknown>)[name];
  }
  saved.clear();
});

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe.each<Mode>(["undefined", "throws"])("browser storage %s", (mode) => {
  it("/metrics still renders its content", async () => {
    breakStorage(mode);
    const { Route } = await import("@/routes/_authenticated/metrics");
    const Page = Route.options.component;
    if (!Page) throw new Error("The metrics route has no component");
    wrap(<Page />);
    expect(await screen.findByText("stub-resumen-kpis")).toBeInTheDocument();
  });

  it("the Inicio guide still renders", async () => {
    breakStorage(mode);
    const { GuideCard } = await import("@/components/home/guide-card");
    wrap(<GuideCard />);
    await waitFor(() => expect(screen.getByText(/Primeros pasos/i)).toBeInTheDocument());
  });
});
