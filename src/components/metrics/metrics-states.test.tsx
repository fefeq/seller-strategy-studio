// SDD-20261106-ux-core-screens-pattern, U-5 · CA-6, CA-7: /metrics never stays blank and never says «vacío» or shows figures at 0 before
// its data arrives. The page (its own read: deals, history, quotas, members, profiles) and each panel of the closed list show loading
// while their read has not answered, and errorText() with «Reintentar» when any answer carries an error. Fictional data; no network.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { errorText } from "@/lib/errors";

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string }>,
  reads: {} as Record<string, number>,
  gate: null as Promise<void> | null,
  org: "o1" as string | undefined,
  search: {} as Record<string, unknown>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
                (h.gate ?? Promise.resolve())
                  .then(() => {
                    h.reads[table] = (h.reads[table] ?? 0) + 1;
                    const error = h.errors[table] ?? null;
                    return { data: error ? null : (h.tables[table] ?? []).slice(), error };
                  })
                  .then(f, r)
            : () => chain(table),
      },
    );
  return { supabase: { from: (t: string) => chain(t) } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({
    data: {
      user: { id: "u1" },
      roles: ["owner"],
      currentOrg: h.org ? { org_id: h.org, currency: "EUR" } : null,
    },
  }),
  useCurrency: () => ({ currency: "EUR", symbol: "€", money: (n: number) => `${n} €` }),
}));
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
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => h.search }),
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));
// The page test only looks at what the page itself draws: every panel is a stub.
vi.mock("@/components/metrics/revops-panels", () => ({
  RevopsFunnel: () => <div>stub-embudo</div>,
  RevopsLost: () => <div>stub-perdidos</div>,
  RevopsCohorts: () => <div>stub-cohortes</div>,
  RevopsTrends: () => <div>stub-tendencias</div>,
}));
vi.mock("@/components/metrics/performance-panels", () => ({
  Bar: () => <div />,
  Muted: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResumenKpis: () => <div>stub-resumen-kpis</div>,
  WinRatePanels: () => <div>stub-win-rates</div>,
}));
vi.mock("@/components/metrics/finance-panel", () => ({
  FinancePanel: () => <div>stub-finanzas</div>,
}));
vi.mock("@/components/leads/lead-funnel-panel", () => ({
  LeadFunnelPanel: () => <div>stub-leads</div>,
}));
vi.mock("@/components/stripe-panel", () => ({ StripeMetricsPanel: () => <div>stub-stripe</div> }));

import { SegmentCoverage } from "@/components/segment-coverage";
import { CacPanel } from "@/components/cac-panel";
import { WonDealsPanel } from "@/components/won-deals-panel";
import { BudgetPanel } from "@/components/budget-panel";
import { QuarterKpisPanel } from "@/components/quarter-kpis-panel";
import { PipelineBoardPanel } from "@/components/pipeline-board-panel";
import { SelfServiceFunnel } from "@/components/self-service-funnel";

const Q = "2026-Q4";
const NETWORK = { message: "Failed to fetch" };
const networkText = errorText(new Error("Failed to fetch"));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
const wait = () => new Promise((r) => setTimeout(r, 30));
const hold = () => {
  let release: () => void = () => {};
  h.gate = new Promise<void>((r) => {
    release = r;
  });
  return () => release();
};

beforeEach(() => {
  h.tables = {};
  h.errors = {};
  h.reads = {};
  h.gate = null;
  h.org = "o1";
  h.search = {};
});
afterEach(cleanup);

// What each panel of the closed list reads, what it says once answered with no data, and what must not show before.
const PANELS: {
  name: string;
  ui: () => ReactNode;
  tables: string[];
  answered: (string | RegExp)[];
  notBefore: (string | RegExp)[];
}[] = [
  {
    name: "SegmentCoverage",
    ui: () => <SegmentCoverage quarter={Q} />,
    tables: ["segments", "deals", "segment_targets", "cac_costs", "segment_budget_quarters"],
    answered: [/No hay segmentos/],
    notBefore: [/No hay segmentos/],
  },
  {
    name: "CacPanel",
    ui: () => <CacPanel quarter={Q} />,
    tables: ["segments", "deals", "segment_targets", "cac_costs", "segment_budget_quarters"],
    answered: ["coste total"],
    notBefore: ["coste total", "0 €"],
  },
  {
    name: "WonDealsPanel",
    ui: () => <WonDealsPanel quarter={Q} />,
    tables: ["deals", "segments", "accounts"],
    answered: [/Ningún deal ganado en 2026-Q4/, "ganados en el trimestre"],
    notBefore: [/Ningún deal ganado/, "ganados en el trimestre"],
  },
  {
    name: "BudgetPanel",
    ui: () => <BudgetPanel year={2026} />,
    tables: ["segments", "deals", "segment_budget_quarters", "cac_costs"],
    answered: [/No hay segmentos/, "margen bruto real"],
    notBefore: [/No hay segmentos/, "margen bruto real"],
  },
  {
    name: "QuarterKpisPanel",
    ui: () => <QuarterKpisPanel quarter={Q} />,
    tables: ["segments", "deals", "segment_budget_quarters", "cac_costs"],
    answered: [/Crea tus segmentos en/],
    notBefore: [/Crea tus segmentos en/],
  },
  {
    name: "PipelineBoardPanel",
    ui: () => <PipelineBoardPanel quarter={Q} />,
    tables: ["deals", "segments", "segment_budget_quarters", "cac_costs"],
    answered: ["Gasto de captación del trimestre"],
    notBefore: ["Gasto de captación del trimestre", "Nadie en esta etapa."],
  },
  {
    name: "SelfServiceFunnel",
    ui: () => <SelfServiceFunnel quarter={Q} />,
    tables: ["trials", "segments"],
    answered: [/Sin registros en 2026-Q4/],
    notBefore: [/Sin registros/],
  },
];

describe.each(PANELS)("$name (CA-7)", (p) => {
  it("while its read has not answered: loading, no empty text, no figures", async () => {
    const release = hold();
    wrap(p.ui());
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    for (const t of p.notBefore) expect(screen.queryByText(t)).not.toBeInTheDocument();
    release();
    for (const t of p.answered) expect(await screen.findByText(t)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(p.tables)(
    "when «%s» fails: errorText and «Reintentar», no empty text, no figures; retry reads again",
    async (table) => {
      h.errors[table] = NETWORK;
      wrap(p.ui());
      expect(await screen.findByText(networkText)).toBeInTheDocument();
      for (const t of p.notBefore) expect(screen.queryByText(t)).not.toBeInTheDocument();
      delete h.errors[table];
      const before = h.reads[table] ?? 0;
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      for (const t of p.answered) expect(await screen.findByText(t)).toBeInTheDocument();
      expect(h.reads[table]).toBeGreaterThan(before);
      expect(screen.queryByText(networkText)).not.toBeInTheDocument();
    },
  );
});

describe("CacPanel · Por trimestre (CA-7)", () => {
  const open = () =>
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Por trimestre" }), { button: 0 });
  const EMPTY = /Aún no hay costes en/;

  it("no empty text until the quarters answer, then the text", async () => {
    wrap(<CacPanel quarter={Q} />);
    await screen.findByText("coste total");
    let release: () => void = () => {};
    h.gate = new Promise<void>((r) => {
      release = r;
    });
    open();
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
  });

  it("a failing read shows errorText, not the empty text; retry recovers", async () => {
    wrap(<CacPanel quarter={Q} />);
    await screen.findByText("coste total");
    h.errors.cac_costs = NETWORK;
    open();
    expect(await screen.findByText(networkText)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    delete h.errors.cac_costs;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
  });
});

describe("Metrics page (CA-6)", () => {
  const nav = () => screen.getByRole("navigation", { name: "Secciones de Métricas" });
  async function mountPage() {
    const { Route } = await import("@/routes/_authenticated/metrics");
    const Page = Route.options.component;
    if (!Page) throw new Error("The metrics route has no component");
    return wrap(<Page />);
  }
  const title = () => screen.getByRole("heading", { level: 1 });

  it("without orgId the read is off: loading under the section bar, title «Métricas», no content", async () => {
    h.org = undefined;
    await mountPage();
    await wait();
    expect(nav()).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(title()).toHaveTextContent("Métricas");
    expect(screen.queryByText("stub-resumen-kpis")).not.toBeInTheDocument();
  });

  it("while the read has not answered: loading; after, the content", async () => {
    const release = hold();
    await mountPage();
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(title()).toHaveTextContent("Métricas");
    expect(screen.queryByText("stub-resumen-kpis")).not.toBeInTheDocument();
    release();
    expect(await screen.findByText("stub-resumen-kpis")).toBeInTheDocument();
    // The panels of the section (real ones) load on their own; the page's state is gone once they answer.
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it.each(["deals", "deal_stage_history", "quotas", "org_members", "profiles"])(
    "when «%s» fails: errorText and «Reintentar», not a blank page; retry reads again",
    async (table) => {
      h.tables.org_members = [{ user_id: "u1" }];
      h.errors[table] = NETWORK;
      await mountPage();
      expect(await screen.findByText(networkText)).toBeInTheDocument();
      expect(title()).toHaveTextContent("Métricas");
      expect(screen.queryByText("stub-resumen-kpis")).not.toBeInTheDocument();
      delete h.errors[table];
      const before = h.reads[table] ?? 0;
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByText("stub-resumen-kpis")).toBeInTheDocument();
      expect(h.reads[table]).toBeGreaterThan(before);
      await waitFor(() => expect(screen.queryByText(networkText)).not.toBeInTheDocument());
    },
  );
});
