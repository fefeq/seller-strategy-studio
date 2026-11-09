// SDD-20261109-metrics-strategy-no-estimates · U-4 · CA-7, CA-13 on Inicio (payback card): a quarter without payback
// says why instead of «—», and «X de Y dentro del objetivo» counts only segments that have a payback. Fictional data.
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

import { PaybackCard } from "@/components/payback-card";

const show = async () => {
  db.tables = TABLES;
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <PaybackCard />
    </QueryClientProvider>,
  );
  await screen.findByText("Pyme");
  return r;
};

describe("Inicio · Payback real por trimestre (CA-7, CA-13)", () => {
  it("counts as measured only the segments with a payback (Mid), never the ones without margin", async () => {
    await show();
    expect(screen.getByText("1 de 1")).toBeTruthy();
  });

  it("cells without payback read «Sin dato · motivo»; the legend no longer explains a «—»", async () => {
    const { container } = await show();
    expect(marksOf(rowOf("Pyme"))).toContain("Sin dato · falta margen");
    expect(marksOf(rowOf("Cero"))).toContain("Sin dato · margen 0 % o negativo");
    expect(container.textContent).not.toContain("— = sin costes");
    expect(container.textContent).not.toMatch(/Infinity|-\d[\d.,]* m/);
    // only targets nobody typed and trends without two quarters keep a «—»
    expectNoBareDash(container, ["Pyme: —", "Mid: —", "Cero: —"]);
    expectDataMarks(container);
  });
});
