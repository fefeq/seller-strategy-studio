// SDD-20261106-metrics-honest-data · U-4 · CA-5, CA-6, CA-7, CA-10 in Cobertura por segmento: one mark per card for
// deals assigned by amount, the ACV mark, the 100 % margin assumed and «Sin dato» (neutral tone, never Infinity or a
// negative payback) for a margin of 0 % or below. Fictional data, no network.
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

import { SegmentCoverage } from "@/components/segment-coverage";

const Q4 = "2026-10-20T10:00:00Z";
db.tables = {
  segments: [
    segRow({
      id: "a",
      name: "Pyme",
      acv_min: 0,
      acv_max: 20000,
      cac_target: 3000,
      payback_months: 12,
    }),
    segRow({
      id: "b",
      name: "Cero",
      acv_min: 100000,
      acv_max: 200000,
      gross_margin_pct: 0,
      payback_months: 12,
    }),
    segRow({ id: "c", name: "Rango", acv_min: 1000, acv_max: 3000, gross_margin_pct: 60 }),
    segRow({ id: "d", name: "Minimo", acv_min: 50000, gross_margin_pct: 60 }),
    segRow({ id: "f", name: "Abiertos", acv_min: 300000, acv_max: 400000, gross_margin_pct: 50 }),
    segRow({
      id: "g",
      name: "Negativo",
      acv_min: 500000,
      acv_max: 600000,
      gross_margin_pct: -10,
      payback_months: 12,
    }),
    segRow({ id: "e", name: "Vacio", gross_margin_pct: 60 }),
  ],
  deals: [
    dealRow({ amount: 10000, stage: "won", closed_at: Q4 }),
    dealRow({ segment_id: "a", amount: 12000, stage: "won", closed_at: Q4 }),
    dealRow({ segment_id: "a", amount: 5000, stage: "demo", close_date: "2026-12-01" }),
    dealRow({ segment_id: "b", amount: 150000, stage: "won", closed_at: Q4 }),
    dealRow({ segment_id: "f", amount: 350000, stage: "demo", close_date: "2026-12-01" }),
    dealRow({ segment_id: "g", amount: 550000, stage: "won", closed_at: Q4 }),
  ],
  cac_costs: [
    { id: "c1", segment_id: "a", channel: "Eventos", amount: 6000 },
    { id: "c2", segment_id: "b", channel: "Eventos", amount: 5000 },
    { id: "c3", segment_id: "g", channel: "Eventos", amount: 1000 },
  ],
  segment_targets: [],
  segment_budget_quarters: [],
};

const card = (name: string) => screen.getByText(name).closest(".rounded-md") as HTMLElement;
const marksOf = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);

describe("Cobertura por segmento marks", () => {
  it("CA-5 one card mark when deals were assigned by amount, under the segment name", async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <SegmentCoverage quarter="2026-Q4" />
      </QueryClientProvider>,
    );
    await screen.findByText("Pyme");
    expect(marksOf(card("Pyme"))).toContain("Estimado · 1 de 3 deals asignados por importe");
    expect(marksOf(card("Cero")).some((t) => t?.includes("asignados por importe"))).toBe(false);
    expectDataMarks(container);
  });

  it("CA-6 ACV mark for each origin of the ACV", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SegmentCoverage quarter="2026-Q4" />
      </QueryClientProvider>,
    );
    await screen.findByText("Pyme");
    expect(marksOf(card("Pyme"))).toContain("Real · media de ganados");
    expect(marksOf(card("Abiertos"))).toContain("Estimado · media de deals abiertos");
    expect(marksOf(card("Rango"))).toContain("Estimado · punto medio del rango");
    expect(marksOf(card("Minimo"))).toContain("Estimado · mínimo del rango × 1,5");
    expect(marksOf(card("Vacio"))).toContain("Sin dato · falta rango de ACV");
  });

  it("CA-7 margin assumed next to the payback; margin ≤ 0 replaces the figure, neutral tone", async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <SegmentCoverage quarter="2026-Q4" />
      </QueryClientProvider>,
    );
    await screen.findByText("Pyme");
    expect(marksOf(card("Pyme"))).toContain("Estimado · margen del 100 % supuesto (falta margen)");
    for (const name of ["Cero", "Negativo"]) {
      const c = card(name);
      const mark = [...c.querySelectorAll("[data-mark]")].find(
        (m) => m.textContent === "Sin dato · margen 0 % o negativo",
      );
      expect(mark, name).toBeTruthy();
      expect(mark!.closest(".text-success, .text-signal"), `${name} tone`).toBeNull();
      expect(c.textContent).not.toMatch(/Infinity|-\d[\d.,]* m/);
    }
    expect(container.textContent).not.toContain("Infinity");
    expectDataMarks(container);
  });
});
