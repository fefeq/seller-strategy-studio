// SDD-20261106-metrics-honest-data · U-4 · CA-7, CA-9, CA-10 in the Rendimiento board: where its margin and its ACV
// come from, the 365-day window of its win rate, and «Sin dato» instead of an Infinity / negative payback when the
// margin is 0 % or below. Fictional data, no network.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { expectDataMarks } from "@/test/data-marks";
import { dealRow, segRow, type FakeDb } from "@/test/metrics-mocks";

const db = vi.hoisted((): FakeDb => ({ tables: {} }));
vi.mock("@/integrations/supabase/client", async () =>
  (await import("@/test/metrics-mocks")).fakeSupabaseModule(db),
);
vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());
vi.mock("@/hooks/use-leads", async () => {
  const { DEFAULT_LEAD_SLA } = await import("@/lib/lead-funnel");
  return { useLeads: () => ({ data: { leads: [], sla: DEFAULT_LEAD_SLA, members: [] } }) };
});
vi.mock("@/components/stage-settings", () => ({ useStages: () => ({ stages: null }) }));

import { PipelineBoardPanel } from "@/components/pipeline-board-panel";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const bq = (o: Record<string, unknown>) => ({
  segment_id: "a",
  period: "2026-Q4",
  plan_revenue: null,
  plan_cost_to_serve: null,
  plan_acquisition: null,
  plan_new_customers: null,
  actual_revenue: null,
  actual_cost_to_serve: null,
  ...o,
});
const segments = [
  segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 50000, gross_margin_pct: 60 }),
  segRow({ id: "b", name: "Mid", acv_min: 50001, gross_margin_pct: 80 }),
];
const wonQ4 = (o: Record<string, unknown> = {}) =>
  dealRow({
    segment_id: "a",
    amount: 10000,
    stage: "won",
    closed_at: "2026-10-20T10:00:00Z",
    ...o,
  });

const show = async (tables: Partial<FakeDb["tables"]>) => {
  db.tables = { segments, deals: [], segment_budget_quarters: [], cac_costs: [], ...tables };
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <PipelineBoardPanel quarter="2026-Q4" />
    </QueryClientProvider>,
  );
  await screen.findByText("Payback real → proyectado");
  return r;
};
const stat = (label: string) => screen.getByText(label).parentElement as HTMLElement;
const marksOf = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);
const cost = { segment_id: null, channel: "Paid media", amount: 5000, period: "2026-Q4" };

describe("Rendimiento board marks (CA-9, CA-7)", () => {
  it("mean of target margins, ACV from won deals, win rate of the last 365 days", async () => {
    const { container } = await show({ deals: [wonQ4()], cac_costs: [cost] });
    const p = stat("Payback real → proyectado");
    expect(marksOf(p)).toEqual([
      "Real · media de ganados",
      "Estimado · media de márgenes objetivo",
    ]);
    expect(p.textContent).toContain("8,6 m");
    expect(stat("CAC proyectado").textContent).toContain("Últimos 365 días");
    expectDataMarks(container, 2);
  });

  it("real margin of the books; margin ≤ 0 replaces the payback with «Sin dato», neutral", async () => {
    const { container } = await show({
      deals: [wonQ4()],
      cac_costs: [cost],
      segment_budget_quarters: [bq({ actual_revenue: 1000, actual_cost_to_serve: 1200 })],
    });
    const p = stat("Payback real → proyectado");
    expect(marksOf(p)).toEqual(
      expect.arrayContaining(["Sin dato · margen 0 % o negativo", "Real · de las cuentas"]),
    );
    expect(p.textContent).not.toMatch(/Infinity|-\d[\d.,]* m/);
    const mark = [...p.querySelectorAll("[data-mark]")].find((m) =>
      m.textContent?.startsWith("Sin dato"),
    );
    expect(mark!.closest(".text-success, .text-signal")).toBeNull();
    expect(container.textContent).not.toContain("Infinity");
  });

  it("margin of the won deals with product lines", async () => {
    await show({ deals: [wonQ4({ gross_margin: 3000 })], cac_costs: [cost] });
    expect(marksOf(stat("Payback real → proyectado"))).toContain("Real · de deals con líneas");
  });

  it("plan margin and ACV from open deals", async () => {
    await show({
      deals: [dealRow({ segment_id: "a", amount: 20000, stage: "demo", close_date: "2026-12-10" })],
      segment_budget_quarters: [bq({ plan_revenue: 1000, plan_cost_to_serve: 400 })],
    });
    expect(marksOf(stat("Payback real → proyectado"))).toEqual([
      "Estimado · media de deals abiertos",
      "Estimado · margen de plan",
    ]);
  });
});
