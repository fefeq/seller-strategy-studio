// SDD-20261106-metrics-honest-data · U-4 · CA-7, CA-10 in KPIs trimestrales: the company payback says when it rests
// on assumptions, and shows «—» with «Sin dato» when a weighted segment has margin ≤ 0 (never Infinity or a negative
// payback). Fictional data, no network.
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

import { QuarterKpisPanel } from "@/components/quarter-kpis-panel";

const show = async (margin: number | null, withPlan = false) => {
  db.tables = {
    segments: [segRow({ id: "a", name: "Pyme", acv_min: 0, gross_margin_pct: margin })],
    deals: [
      dealRow({ segment_id: "a", amount: 12000, stage: "won", closed_at: "2026-11-10T10:00:00Z" }),
    ],
    segment_budget_quarters: withPlan
      ? [
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
        ]
      : [],
    cac_costs: [{ segment_id: "a", channel: "Eventos", amount: 6000, period: "2026-Q4" }],
  };
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <QuarterKpisPanel quarter="2026-Q4" />
    </QueryClientProvider>,
  );
  await screen.findByText("Payback 2026-Q4");
  return r;
};
const headline = () => screen.getByText("Payback 2026-Q4").parentElement as HTMLElement;
const paybackCell = () => {
  const tr = screen.getByText("Payback", { selector: "td" }).closest("tr") as HTMLElement;
  return tr.querySelectorAll("td")[4] as HTMLElement;
};
const marksOf = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);

describe("KPIs trimestrales payback marks (CA-7)", () => {
  // SDD-20261109 D1: without a margin there is no payback; the company figure says no segment has one.
  it("no margin: «Sin dato · ningún segmento con payback», never a payback at 100 %", async () => {
    const { container } = await show(null);
    const sd = "Sin dato · ningún segmento con payback";
    expect(headline().textContent).not.toContain("6 m");
    expect(marksOf(headline())).toEqual([sd]);
    expect(paybackCell().textContent).not.toContain("6 m");
    expect(marksOf(paybackCell())).toEqual([sd]);
    expectDataMarks(container);
  });

  // SDD-20261109 D2, §15.8: a segment with margin ≤ 0 has no payback and does not enter the company one.
  it("margin negative: «Sin dato · ningún segmento con payback», never a negative payback", async () => {
    const { container } = await show(-10);
    const sd = "Sin dato · ningún segmento con payback";
    expect(marksOf(headline())).toEqual([sd]);
    expect(marksOf(paybackCell())).toEqual([sd]);
    expect(paybackCell().textContent).not.toMatch(/Infinity|-\d[\d.,]* m/);
    expect(container.textContent).not.toContain("Infinity");
    expectDataMarks(container);
  });

  it("margin 0 %: never Infinity", async () => {
    const { container } = await show(0);
    expect(container.textContent).not.toContain("Infinity");
    expect(marksOf(headline())).toEqual(["Sin dato · ningún segmento con payback"]);
  });

  // SDD-20261109 CA-13: the plan payback says why instead of «—».
  it("margin 0 % with a plan: no Infinity, no deviation, the plan payback says why (gate pass 3, note 2)", async () => {
    const { container } = await show(0, true);
    const c = paybackCell();
    expect(c.textContent).not.toMatch(/Infinity|-\d[\d.,]* m/);
    expect(marksOf(c)).toEqual([
      "Sin dato · ningún segmento con payback",
      "Sin dato · ningún segmento con payback",
    ]);
    expect(c.textContent).not.toContain("plan —");
    expect(c.querySelector(".text-success, .text-signal")).toBeNull();
    expect(container.textContent).not.toContain("Infinity");
    expect(container.textContent).not.toContain("(ver Cobertura)");
  });

  it("dato: no mark on the payback", async () => {
    await show(50);
    expect(headline().textContent).toContain("12 m");
    expect(marksOf(headline())).toEqual([]);
  });
});

// SDD-20261109-metrics-strategy-no-estimates · U-3 · CA-6, CA-13, D11, §15.8: one company CAC over every won deal (with
// a hint for those without segment) and a company payback that says on how many segments it rests.
describe("NK-0094 KPIs trimestrales: company CAC and payback from the Figures", () => {
  const render2 = async () => {
    db.tables = {
      segments: [
        segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 20000, gross_margin_pct: 50 }),
        segRow({ id: "b", name: "Mid", acv_min: 20001, acv_max: 90000, gross_margin_pct: 50 }),
      ],
      deals: [
        dealRow({
          segment_id: "a",
          amount: 12000,
          stage: "won",
          closed_at: "2026-11-10T10:00:00Z",
        }),
        dealRow({
          segment_id: "b",
          amount: 40000,
          stage: "won",
          closed_at: "2026-11-11T10:00:00Z",
        }),
        dealRow({ amount: null, stage: "won", closed_at: "2026-11-12T10:00:00Z" }),
      ],
      segment_budget_quarters: [],
      cac_costs: [{ segment_id: "a", channel: "Eventos", amount: 6000, period: "2026-Q4" }],
    };
    const r = render(
      <QueryClientProvider client={new QueryClient()}>
        <QuarterKpisPanel quarter="2026-Q4" />
      </QueryClientProvider>,
    );
    await screen.findByText("Payback 2026-Q4");
    return r;
  };
  it("D11: CAC = 6000 / 3 won deals, with the hint for the one without segment", async () => {
    await render2();
    expect(screen.getByText("CAC 2026-Q4").parentElement!.textContent).toContain("2000 €");
    expect(screen.getAllByText("1 ganados sin segmento cuentan en el CAC de empresa").length).toBe(
      1,
    );
  });
  it("§15.8: the payback rests on 1 of 2 segments with customers, and says so", async () => {
    const { container } = await render2();
    expect(marksOf(headline())).toEqual([
      "Estimado · calculado sobre 1 de 2 segmentos con clientes",
    ]);
    // Pyme only: 6000 / (12000 × 50 % / 12) = 12
    expect(headline().textContent).toContain("12 m");
    // NK-0106: no «—» is allowed any more; the missing real figures carry their «Sin dato · motivo».
    expectNoBareDash(container, []);
    const row = (label: string) =>
      screen.getByText(label, { selector: "td" }).closest("tr") as HTMLElement;
    expect(marksOf(row("Ingresos"))).toContain("Sin dato · sin ingresos del trimestre");
    expect(marksOf(row("Coste de servir"))).toContain("Sin dato · sin coste de servir apuntado");
    // The quarter has 6000 of costs: its cell (5th column) is the figure; the quarters before have none.
    expect(marksOf(row("Gasto de captación").querySelectorAll("td")[4] as HTMLElement)).toEqual([]);
    expectDataMarks(container);
  });
});

// SDD-20261109-metrics-sin-dato-rest · CA-5: without costs the real spend says why; the plan nobody typed stays «sin plan».
describe("CA-5 KPIs trimestrales without costs", () => {
  it("Gasto de captación: «Sin dato · sin gasto de captación apuntado» and «sin plan», no dash", async () => {
    db.tables = {
      segments: [segRow({ id: "a", name: "Pyme", acv_min: 0, gross_margin_pct: 50 })],
      deals: [],
      segment_budget_quarters: [],
      cac_costs: [],
    };
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <QuarterKpisPanel quarter="2026-Q4" />
      </QueryClientProvider>,
    );
    await screen.findByText("Payback 2026-Q4");
    const row = screen.getByText("Gasto de captación", { selector: "td" }).closest("tr")!;
    const current = row.querySelectorAll("td")[4] as HTMLElement;
    expect(marksOf(current)).toEqual(["Sin dato · sin gasto de captación apuntado"]);
    expect(current.textContent).toContain("sin plan");
    expectNoBareDash(container, []);
    expectDataMarks(container);
  });
});
