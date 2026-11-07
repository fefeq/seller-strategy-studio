// SDD-20261106-metrics-honest-data · U-4 · CA-7, CA-10 in KPIs trimestrales: the company payback says when it rests
// on assumptions, and shows «—» with «Sin dato» when a weighted segment has margin ≤ 0 (never Infinity or a negative
// payback). Fictional data, no network.
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

import { QuarterKpisPanel } from "@/components/quarter-kpis-panel";

const show = async (margin: number | null) => {
  db.tables = {
    segments: [segRow({ id: "a", name: "Pyme", acv_min: 0, gross_margin_pct: margin })],
    deals: [
      dealRow({ segment_id: "a", amount: 12000, stage: "won", closed_at: "2026-11-10T10:00:00Z" }),
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
const headline = () => screen.getByText("Payback 2026-Q4").parentElement as HTMLElement;
const paybackCell = () => {
  const tr = screen.getByText("Payback", { selector: "td" }).closest("tr") as HTMLElement;
  return tr.querySelectorAll("td")[4] as HTMLElement;
};
const marksOf = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);

describe("KPIs trimestrales payback marks (CA-7)", () => {
  it("estimado: the figure with «Estimado · supuestos en algún segmento (ver Cobertura)»", async () => {
    const { container } = await show(null);
    const est = "Estimado · supuestos en algún segmento (ver Cobertura)";
    expect(headline().textContent).toContain("6 m");
    expect(marksOf(headline())).toEqual([est]);
    expect(paybackCell().textContent).toContain("6 m");
    expect(marksOf(paybackCell())).toEqual([est]);
    expectDataMarks(container);
  });

  it("sin_dato: «—» with «Sin dato · un segmento tiene margen 0 % o negativo», never a negative payback", async () => {
    const { container } = await show(-10);
    const sd = "Sin dato · un segmento tiene margen 0 % o negativo";
    expect(marksOf(headline())).toEqual([sd]);
    expect(headline().querySelector(".font-display")?.textContent).toBe("—");
    expect(marksOf(paybackCell())).toEqual([sd]);
    expect(paybackCell().textContent).not.toMatch(/Infinity|-\d[\d.,]* m/);
    expect(container.textContent).not.toContain("Infinity");
    expectDataMarks(container);
  });

  it("margin 0 %: never Infinity", async () => {
    const { container } = await show(0);
    expect(container.textContent).not.toContain("Infinity");
    expect(marksOf(headline())).toEqual(["Sin dato · un segmento tiene margen 0 % o negativo"]);
  });

  it("dato: no mark on the payback", async () => {
    await show(50);
    expect(headline().textContent).toContain("12 m");
    expect(marksOf(headline())).toEqual([]);
  });
});
