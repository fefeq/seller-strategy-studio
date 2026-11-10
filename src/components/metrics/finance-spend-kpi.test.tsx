// NK-0132 CA-1 (D-3 of SDD-20261109-metrics-sin-dato-rest): the «Gasto real» figure of Finanzas says «Sin dato · sin costes
// apuntados» when no acquisition cost was typed, never «0 € captación». Fictional data, no network.
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeDb } from "@/test/metrics-mocks";

const db = vi.hoisted((): FakeDb => ({ tables: {} }));
vi.mock("@/integrations/supabase/client", async () =>
  (await import("@/test/metrics-mocks")).fakeSupabaseModule(db),
);
vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { FinancePanel } from "@/components/metrics/finance-panel";

const NONE = "Sin dato · sin costes apuntados";
const show = async (tables: Record<string, unknown[]>) => {
  db.tables = tables;
  const out = render(
    <QueryClientProvider client={new QueryClient()}>
      <FinancePanel quarter="2026-Q4" />
    </QueryClientProvider>,
  );
  await screen.findByText("Últimos 4 trimestres");
  return out;
};
const kpi = () => screen.getByText("Gasto real", { selector: "p.eyebrow" }).parentElement!;
const line = { amount: 100, category: "tools", starts_on: "2026-01-01", ends_on: null };

beforeEach(() => {
  db.tables = {};
});

describe("Gasto real KPI", () => {
  it("with no costs at all the figure is the mark and no «0 € captación» is written", async () => {
    await show({});
    expect(within(kpi()).getByText(NONE)).toHaveAttribute("data-mark", "sin_dato");
    expect(kpi().textContent).not.toContain("0 € captación");
  });

  it("with only operating costs, the figure is theirs and captación says what is missing", async () => {
    await show({ finance_cost_lines: [line] });
    expect(kpi().textContent).toContain("300 €");
    expect(kpi().textContent).not.toContain("0 € captación");
    expect(within(kpi()).getByText(NONE)).toHaveAttribute("data-mark", "sin_dato");
  });

  it("with acquisition costs it still shows them as a figure", async () => {
    await show({ cac_costs: [{ period: "2026-Q4", amount: 500 }] });
    expect(kpi().textContent).toContain("500 € captación");
    expect(within(kpi()).queryByText(NONE)).toBeNull();
  });

  it("a cost typed as 0 sums to no spend, so it reads the same as none (D-3: 0 is «sin costes apuntados»)", async () => {
    await show({ cac_costs: [{ period: "2026-Q4", amount: 0 }] });
    expect(within(kpi()).getByText(NONE)).toHaveAttribute("data-mark", "sin_dato");
  });
});
