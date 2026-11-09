// SDD-20261106-metrics-honest-data · U-4 · CA-5, CA-6, CA-7, CA-8, CA-10 in Presupuesto por segmento: customers
// assigned by amount (CAC cell), ACV origin (Payback cell), 100 % margin assumed, «Sin dato» for margin ≤ 0 in a
// neutral tone, and acquisition spend split equally when nobody won. Fictional data, no network.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { expectDataMarks, expectNoBareDash } from "@/test/data-marks";
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
        // SDD-20261109 D1: without a margin there is no payback (never 100 %).
        "Sin dato · falta margen",
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

  it("CA-7 margin 0 % on plan and actual: no Infinity, no deviation, both read «Sin dato» (gate pass 3, note 2)", async () => {
    const { container } = await show({
      segments: [
        segRow({ id: "z", name: "Cero", acv_min: 0, gross_margin_pct: 0, payback_months: 12 }),
      ],
      deals: [
        dealRow({
          segment_id: "z",
          amount: 12000,
          stage: "won",
          closed_at: "2026-05-10T10:00:00Z",
        }),
      ],
      segment_budget_quarters: [
        bq({ segment_id: "z", period: "2026-Q2", plan_acquisition: 3000, plan_new_customers: 1 }),
      ],
      cac_costs: [{ segment_id: "z", channel: "Eventos", amount: 6000, period: "2026-Q2" }],
    });
    const c = cell("Cero", PAYBACK);
    expect(marksOf(c).filter((t) => t === "Sin dato · margen 0 % o negativo")).toHaveLength(2);
    expect(c.textContent).not.toMatch(/Infinity|-\d[\d.,]* m|[+-]?\d+%|= presupuesto/);
    expect(c.querySelector(".text-success, .text-signal")).toBeNull();
    expect(container.textContent).not.toContain("Infinity");
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
    // SDD-20261109 D7: the shared cost is no longer split when nobody won.
    const equal = "Sin dato · nadie ganó: el compartido no se reparte";
    expect(marksOf(cell("Pyme", SPEND))).toEqual([equal]);
    expect(marksOf(cell("Mid", SPEND))).toEqual([equal]);
    expectDataMarks(container);
  });
});

// SDD-20261109-metrics-strategy-no-estimates · U-3 · CA-6, CA-13, D15: the year's payback uses the one margin chain
// (the won deals with lines, read with gross_margin); a missing CAC, payback or margin reads «Sin dato · motivo».
describe("NK-0094 Presupuesto por segmento: one margin chain, Sin dato instead of «—»", () => {
  it("D15: the payback margin is the margin of the won deals with lines", async () => {
    await show({
      segments: [segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 20000 })],
      deals: [
        dealRow({
          segment_id: "a",
          amount: 12000,
          gross_margin: 6000,
          stage: "won",
          closed_at: "2026-05-10T10:00:00Z",
        }),
      ],
      segment_budget_quarters: [],
      cac_costs: [{ segment_id: "a", channel: "Eventos", amount: 6000, period: "2026-Q2" }],
    });
    expect(rowOf("Pyme").textContent).toContain(
      "margen en el payback: 50% (margen de los deals ganados)",
    );
    // 6000 / (12000 × 50 % / 12) = 12
    expect(cell("Pyme", PAYBACK).textContent).toContain("12 m");
  });

  it("CA-13: only revenue and spend nobody typed keep a «—»", async () => {
    const { container } = await show({
      segments: [segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 20000 })],
      deals: [],
      segment_budget_quarters: [],
      cac_costs: [],
    });
    expect(marksOf(cell("Pyme", CAC))).toEqual(["Sin dato · sin costes en 2026"]);
    expect(cell("Pyme", CAC).textContent).toContain("presup. sin plan");
    expect(marksOf(rowOf("Pyme"))).toEqual(expect.arrayContaining(["Sin dato · falta margen"]));
    expectNoBareDash(container, ["Pyme: —", "presup. —"]);
    expectDataMarks(container);
  });
});
