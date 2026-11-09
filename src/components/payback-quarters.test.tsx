// SDD-20261109-metrics-strategy-no-estimates · U-4 · CA-7, CA-13 in Payback real (/strategy?tab=payback): a cell
// without payback reads «Sin dato · motivo» (never «—» nor «sin costes» alone); estimated inputs carry their mark;
// green or red only for a real or estimated payback with a target. Fictional data, no network.
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

import { PaybackQuarters } from "@/components/payback-quarters";

const show = async () => {
  db.tables = TABLES;
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <PaybackQuarters />
    </QueryClientProvider>,
  );
  await screen.findByText("Pyme");
  return r;
};

describe("Payback real por trimestre (CA-7, CA-13)", () => {
  it("each missing payback says why: no margin, margin ≤ 0, no costs, nobody won", async () => {
    const { container } = await show();
    expect(marksOf(rowOf("Pyme"))).toContain("Sin dato · falta margen");
    expect(marksOf(rowOf("Cero"))).toContain("Sin dato · margen 0 % o negativo");
    expect(marksOf(rowOf("Pyme"))).toContain("Sin dato · sin costes en 2026-Q3");
    expect(marksOf(rowOf("Mid"))).toContain("Sin dato · ningún deal ganado en 2026-Q3");
    // the spend of a quarter without wins goes to the hint, never «0 ganados» as the figure
    expect(rowOf("Mid").textContent).toContain("9000 € gastado · 0 ganados");
    expect(container.textContent).not.toContain("Infinity");
    for (const v of container.querySelectorAll(".font-display"))
      expect(v.textContent, "a payback is never negative").not.toMatch(/^-/);
    expectNoBareDash(container, []);
    expectDataMarks(container);
  });

  it("a real payback is green or red against its target; a «Sin dato» cell is neutral", async () => {
    await show();
    const mid = rowOf("Mid");
    // Mid Q4: CAC 20 000 / 2 won (one by amount); ACV 35 000; margin 50 % → 6.9 m ≤ 12 → green
    const value = [...mid.querySelectorAll(".font-display")].find((e) =>
      /m$/.test(e.textContent ?? ""),
    );
    expect(value?.textContent).toBe("6,9 m");
    expect(value?.className).toContain("text-success");
    expect(marksOf(mid)).toContain("Estimado · 1 de 2 asignados por importe");
    for (const m of rowOf("Cero").querySelectorAll("[data-mark]"))
      expect(m.closest(".text-success, .text-signal")).toBeNull();
  });
});
