// NK-0093: reads that used `.data ?? []` and never threw (useLeads, useStripe) now throw when Supabase answers with an error, and
// every screen or panel that uses them (Leads, LeadFunnelPanel, PipelineBoardPanel, StripeConnect, StripeMetricsPanel) shows
// loading while the read has not answered and errorText() with «Reintentar» when it fails, never the empty state.
// Pattern of SDD-20261106-ux-core-screens-pattern (ScreenState). Fictional data; no network.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string, single = false): object =>
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
                    const rows = (h.tables[table] ?? []).slice();
                    return { data: error ? null : single ? (rows[0] ?? null) : rows, error };
                  })
                  .then(f, r)
            : () => chain(table, single || p === "maybeSingle"),
      },
    );
  return { supabase: { from: (t: string) => chain(t), rpc: () => chain("rpc") } };
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
vi.mock("@/components/stage-settings", () => ({ useStages: () => ({ stages: null }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/stripe.functions", () => ({ connectStripe: vi.fn(), syncStripeNow: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => ({}),
    useNavigate: () => vi.fn(),
  }),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (r: unknown) => unknown }) =>
    select({ location: { pathname: "/leads" } }),
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));
// The Leads page test only looks at what the page itself draws: its heavy children are stubs.
vi.mock("@/components/quick-actions", () => ({ LeadQuickActions: () => <div /> }));
vi.mock("@/components/company-logo", () => ({ CompanyLogo: () => <div /> }));
vi.mock("@/components/background", () => ({ useLeadTouched: () => vi.fn() }));
vi.mock("@/components/leads/lead-detail", () => ({ LeadDetail: () => <div /> }));
vi.mock("@/components/leads/lead-dialogs", () => ({
  AutoEnrichSwitch: () => <div />,
  NewLead: () => <div />,
  SlaSettings: () => <div />,
}));
vi.mock("@/components/leads/lead-qualification", () => ({
  QualSettingsDialog: () => <div />,
  QualTag: () => <div />,
  QualifyPending: () => <div />,
  leadQualView: () => ({}),
}));
vi.mock("@/components/board-dnd", () => ({
  BoardDnd: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DragCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropColumn: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { LeadFunnelPanel } from "@/components/leads/lead-funnel-panel";
import { PipelineBoardPanel } from "@/components/pipeline-board-panel";
import { StripeConnect, StripeMetricsPanel } from "@/components/stripe-panel";
import { leadsQuery } from "@/hooks/use-leads";

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
  h.tables = {
    org_members: [{ user_id: "u1" }],
    profiles: [{ id: "u1", full_name: "Ana Ficticia" }],
  };
  h.errors = {};
  h.reads = {};
  h.gate = null;
  h.org = "o1";
});
afterEach(cleanup);

// Every table useLeads reads; a failure in any of them must surface (profiles only when there are members).
const LEADS_TABLES = [
  "leads",
  "deals",
  "lead_settings",
  "segments",
  "org_members",
  "icp_profiles",
  "accounts",
  "profiles",
];

describe("useLeads query throws", () => {
  it.each(LEADS_TABLES)("when «%s» answers with an error", async (table) => {
    h.errors[table] = NETWORK;
    const q = leadsQuery("o1");
    // The query function ignores its context here; it only reads through the mocked client.
    await expect((q.queryFn as () => Promise<unknown>)()).rejects.toMatchObject({
      message: "Failed to fetch",
    });
  });
});

type Case = {
  name: string;
  ui: () => ReactNode;
  tables: string[];
  answered: (string | RegExp)[];
  notBefore: (string | RegExp)[];
};
const CASES: Case[] = [
  {
    name: "LeadFunnelPanel",
    ui: () => <LeadFunnelPanel quarter={Q} />,
    tables: LEADS_TABLES,
    answered: [/No entró ningún lead en/],
    notBefore: [/No entró ningún lead/],
  },
  {
    name: "PipelineBoardPanel (its leads half)",
    ui: () => <PipelineBoardPanel quarter={Q} />,
    // Its own reads (deals…) are covered by metrics-states; here the shared leads read.
    tables: LEADS_TABLES,
    answered: ["Gasto de captación del trimestre"],
    notBefore: ["Gasto de captación del trimestre", "Nadie en esta etapa."],
  },
  {
    name: "StripeConnect",
    ui: () => <StripeConnect />,
    tables: ["stripe_connections", "stripe_snapshots"],
    answered: ["Sin conectar"],
    notBefore: ["Sin conectar", "Conectar con una clave restringida"],
  },
  {
    name: "StripeMetricsPanel",
    ui: () => <StripeMetricsPanel />,
    tables: ["stripe_connections", "stripe_snapshots"],
    answered: [/conecta Stripe en Conexiones/],
    notBefore: [/conecta Stripe en Conexiones/],
  },
];

describe.each(CASES)("$name", (p) => {
  it("while its read has not answered: loading, no empty text", async () => {
    const release = hold();
    wrap(p.ui());
    await wait();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Cargando…");
    for (const t of p.notBefore) expect(screen.queryByText(t)).not.toBeInTheDocument();
    release();
    for (const t of p.answered) expect(await screen.findByText(t)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(p.tables)(
    "when «%s» fails: errorText and «Reintentar», no empty text; retry reads again",
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

describe("Leads page", () => {
  async function mountPage() {
    const { Route } = await import("@/routes/_authenticated/leads.index");
    const Page = Route.options.component;
    if (!Page) throw new Error("The leads route has no component");
    return wrap(<Page />);
  }
  const EMPTY = /Aún no hay leads/;

  it("while the read has not answered: loading, not the empty text", async () => {
    const release = hold();
    await mountPage();
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
  });

  it.each(LEADS_TABLES)(
    "when «%s» fails: errorText and «Reintentar», not the empty text",
    async (table) => {
      h.errors[table] = NETWORK;
      await mountPage();
      expect(await screen.findByText(networkText)).toBeInTheDocument();
      expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
      delete h.errors[table];
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    },
  );
});
