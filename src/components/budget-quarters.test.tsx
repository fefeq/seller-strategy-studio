// SDD-20261109-metrics-strategy-no-estimates · U-4 · CA-8, CA-13 in Presupuesto vs real (/strategy?tab=budget): paybacks
// and CAC as Figures (D1-D3, D7, D8), never negative nor Infinity, no deviation without a payback, and the footer
// with the two margin chains. Fictional data, no network.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

// Segments: Pyme (no margin anywhere), Mid (margin 50 %, target 12 m), Cero (margin 0 %), Medio (only a range).
const TABLES = {
  segments: [
    segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 20000, payback_months: 12 }),
    segRow({
      id: "b",
      name: "Mid",
      acv_min: 20001,
      acv_max: 90000,
      gross_margin_pct: 50,
      payback_months: 12,
    }),
    segRow({
      id: "c",
      name: "Cero",
      acv_min: 90001,
      acv_max: 200000,
      gross_margin_pct: 0,
      payback_months: 12,
    }),
  ],
  deals: [
    dealRow({ segment_id: "a", amount: 10000, stage: "won", closed_at: "2026-10-20T10:00:00Z" }),
    dealRow({ segment_id: "b", amount: 40000, stage: "won", closed_at: "2026-10-21T10:00:00Z" }),
    dealRow({ amount: 30000, stage: "won", closed_at: "2026-10-22T10:00:00Z" }),
    dealRow({ segment_id: "c", amount: 100000, stage: "won", closed_at: "2026-10-23T10:00:00Z" }),
  ],
  cac_costs: [
    { segment_id: "a", channel: "Eventos", amount: 5000, period: "2026-Q4" },
    { segment_id: "b", channel: "Eventos", amount: 20000, period: "2026-Q4" },
    { segment_id: "c", channel: "Eventos", amount: 5000, period: "2026-Q4" },
    { segment_id: "b", channel: "Eventos", amount: 9000, period: "2026-Q3" },
  ],
  segment_budget_quarters: [],
};
const marksOf = (el: Element) => [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);
const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { BudgetQuarters } from "@/components/budget-quarters";

const show = async (tables: Partial<FakeDb["tables"]> = {}) => {
  db.tables = { ...TABLES, ...tables };
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <BudgetQuarters />
    </QueryClientProvider>,
  );
  await screen.findByText("Presupuesto vs real por trimestre");
  await screen.findAllByText("Payback");
  return r;
};
const line = (label: string) =>
  screen
    .getAllByText(label)
    .map((e) => e.closest("tr"))
    .find(Boolean) as HTMLElement;

describe("Presupuesto vs real (CA-8, CA-13)", () => {
  it("D1: the first segment (no margin) has no payback, real nor planned: «Sin dato · falta margen»", async () => {
    const { container } = await show({
      segment_budget_quarters: [
        {
          segment_id: "a",
          period: "2026-Q4",
          plan_revenue: null,
          plan_cost_to_serve: null,
          plan_acquisition: 3000,
          plan_new_customers: 1,
          actual_revenue: null,
          actual_cost_to_serve: null,
        },
      ],
    });
    const p = line("Payback");
    expect(marksOf(p)).toEqual(expect.arrayContaining(["Sin dato · falta margen"]));
    expect(p.textContent).not.toMatch(/Infinity|-\d[\d.,]* m|[+-]\d+%/);
    expect(p.querySelector(".text-success, .text-signal")).toBeNull();
    expect(container.textContent).not.toContain("Infinity");
    expectDataMarks(container);
  });

  it("CA-13: CAC, payback and margin never read «—»; only typed budget values and the target do", async () => {
    const { container } = await show();
    expect(marksOf(line("CAC"))).toEqual(
      expect.arrayContaining(["Sin dato · sin costes en 2026-Q1"]),
    );
    expect(marksOf(line("Margen bruto"))).toContain("Sin dato · falta margen");
    const dashes = expectNoBareDash(container, [
      "Ingresos: —",
      "Coste de servir: —",
      "Gasto de captación: —",
      "Clientes nuevos: —",
    ]);
    expect(dashes.every((d) => !/CAC|Payback|Margen/.test(d))).toBe(true);
  });

  it("CA-8: the footer states both margin chains", async () => {
    await show();
    expect(
      screen.getByText(
        /El margen sale, por este orden, del presupuesto real del trimestre o del año, de los deals ganados con líneas, del presupuesto planificado y del margen objetivo del segmento\. Sin ninguno, no hay payback\. El payback presupuestado usa el margen presupuestado y, sin él, el margen objetivo del segmento\./,
      ),
    ).toBeTruthy();
  });
});
