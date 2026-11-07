// SDD-20261106-metrics-honest-data · U-4 · CA-5, CA-6, CA-7, CA-8, CA-10 in Presupuesto por segmento: customers
// assigned by amount (CAC cell), ACV origin (Payback cell), 100 % margin assumed, «Sin dato» for margin ≤ 0 in a
// neutral tone, and acquisition spend split equally when nobody won. Fictional data, no network.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
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

import { BudgetPanel } from "@/components/budget-panel";

const bq = (o: Record<string, unknown>) => ({
  plan_revenue: null,
  plan_cost_to_serve: null,
  plan_acquisition: null,
  plan_new_customers: null,
  actual_revenue: null,
  actual_cost_to_serve: null,
  ...o,
});
const show = async (tables: FakeDb["tables"]) => {
  db.tables = tables;
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <BudgetPanel year={2026} />
    </QueryClientProvider>,
  );
  await screen.findByText(String((tables.segments[0] as { name: string }).name));
  return r;
};
const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;
const cell = (name: string, col: number) => rowOf(name).querySelectorAll("td")[col] as HTMLElement;
const marksOf = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);
const CAC = 4;
const PAYBACK = 5;
const SPEND = 3;

describe("Presupuesto por segmento marks", () => {
  it("CA-5 / CA-6 / CA-7 customers by amount, ACV origin, margin assumed, margin ≤ 0", async () => {
    const { container } = await show({
      segments: [
        segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 20000, payback_months: 12 }),
        segRow({ id: "b", name: "Rango", acv_min: 1000, acv_max: 3000, gross_margin_pct: 60 }),
        segRow({
          id: "c",
          name: "Negativo",
          acv_min: 100000,
          acv_max: 200000,
          gross_margin_pct: -10,
          payback_months: 12,
        }),
      ],
      deals: [
        dealRow({ amount: 10000, stage: "won", closed_at: "2026-05-10T10:00:00Z" }),
        dealRow({
          segment_id: "a",
          amount: 12000,
          stage: "won",
          closed_at: "2026-06-10T10:00:00Z",
        }),
        dealRow({
          segment_id: "c",
          amount: 150000,
          stage: "won",
          closed_at: "2026-04-10T10:00:00Z",
        }),
      ],
      segment_budget_quarters: [
        bq({ segment_id: "b", period: "2026-Q2", plan_acquisition: 600, plan_new_customers: 1 }),
      ],
      cac_costs: [
        { segment_id: "a", channel: "Eventos", amount: 6000, period: "2026-Q2" },
        { segment_id: "c", channel: "Eventos", amount: 1000, period: "2026-Q2" },
      ],
    });
    expect(marksOf(cell("Pyme", CAC))).toEqual(["Estimado · 1 de 2 asignados por importe"]);
    expect(marksOf(cell("Negativo", CAC))).toEqual([]);
    expect(marksOf(cell("Pyme", PAYBACK))).toEqual(
      expect.arrayContaining([
        "Real · media de ganados",
        "Estimado · margen del 100 % supuesto (falta margen)",
      ]),
    );
    expect(marksOf(cell("Rango", PAYBACK))).toContain("Estimado · punto medio del rango");
    const neg = cell("Negativo", PAYBACK);
    const mark = [...neg.querySelectorAll("[data-mark]")].find(
      (m) => m.textContent === "Sin dato · margen 0 % o negativo",
    );
    expect(mark).toBeTruthy();
    expect(mark!.closest(".text-success, .text-signal")).toBeNull();
    expect(neg.textContent).not.toMatch(/Infinity|-\d[\d.,]* m/);
    expectDataMarks(container);
  });

  it("CA-8 acquisition spend split equally when nobody won in the year", async () => {
    const { container } = await show({
      segments: [
        segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 20000 }),
        segRow({ id: "b", name: "Mid", acv_min: 20001 }),
      ],
      deals: [],
      segment_budget_quarters: [],
      cac_costs: [{ segment_id: null, channel: "Paid media", amount: 1000, period: "2026-Q3" }],
    });
    const equal = "Estimado · repartido a partes iguales (nadie ganó)";
    expect(marksOf(cell("Pyme", SPEND))).toEqual([equal]);
    expect(marksOf(cell("Mid", SPEND))).toEqual([equal]);
    expectDataMarks(container);
  });
});
