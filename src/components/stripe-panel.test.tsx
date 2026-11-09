// SDD-20261109-metrics-sin-dato-rest · U-4 · CA-4: the Stripe panel says «sin dato» inside the churn text when
// Stripe gave no churn, never «—». Fictional data, no network.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { FakeDb } from "@/test/metrics-mocks";

const db = vi.hoisted((): FakeDb => ({ tables: {} }));
vi.mock("@/integrations/supabase/client", () => {
  // maybeSingle() answers with one row (or null), like the real client.
  const chain = (table: string, single = false): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) =>
                Promise.resolve({
                  data: single ? (db.tables[table]?.[0] ?? null) : (db.tables[table] ?? []),
                  error: null,
                }).then(f)
            : () => chain(table, single || p === "maybeSingle"),
      },
    );
  return { supabase: { from: (t: string) => chain(t) } };
});
vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/stripe.functions", () => ({ connectStripe: vi.fn(), syncStripeNow: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { StripeMetricsPanel } from "@/components/stripe-panel";

const snapshot = (o: Record<string, unknown>) => ({
  id: "s1",
  mrr: 1000,
  currency: "EUR",
  active_customers: 10,
  trialing: 0,
  new_customers: 1,
  new_mrr: 100,
  churned_customers: 0,
  churned_mrr: 0,
  window_days: 30,
  logo_churn_pct: null,
  revenue_churn_pct: null,
  taken_at: "2026-11-05T10:00:00Z",
  details: {},
  ...o,
});
const show = async (s: object) => {
  db.tables = { stripe_connections: [], stripe_snapshots: [s] };
  const out = render(
    <QueryClientProvider client={new QueryClient()}>
      <StripeMetricsPanel />
    </QueryClientProvider>,
  );
  await screen.findByText("Ingresos en Stripe");
  return out;
};

describe("CA-4 churn without data", () => {
  it("says «sin dato» inside the text, no dash", async () => {
    const { container } = await show(snapshot({}));
    expect(screen.getByText("Churn sin dato de clientes · sin dato del MRR")).toBeInTheDocument();
    expect(container.textContent).not.toContain("—");
  });
  it("with churn it shows the percentages", async () => {
    const { container } = await show(
      snapshot({ logo_churn_pct: 2.5, revenue_churn_pct: 1.2, churned_customers: 1 }),
    );
    expect(screen.getByText("Churn 2,5 % de clientes · 1,2 % del MRR")).toBeInTheDocument();
    expect(container.textContent).not.toContain("—");
  });
});
