// SDD-20261106-metrics-honest-data · U-4 · CA-5, CA-7, CA-8, CA-10 in CAC real: deals won assigned by amount, the
// shared cost split equally when nobody won, the 100 % margin assumed and «Sin dato» for margin ≤ 0 in «Payback
// real» (neutral tone). Fictional data, no network.
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

import { CacPanel } from "@/components/cac-panel";

const Q4 = "2026-10-20T10:00:00Z";
const segments = [
  segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 20000, payback_months: 12 }),
  segRow({
    id: "b",
    name: "Cero",
    acv_min: 100000,
    acv_max: 200000,
    gross_margin_pct: 0,
    payback_months: 12,
  }),
];
const show = async (tables: FakeDb["tables"]) => {
  db.tables = { segment_targets: [], segment_budget_quarters: [], ...tables };
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <CacPanel quarter="2026-Q4" />
    </QueryClientProvider>,
  );
  await screen.findByText("+ Compartido asignado");
  await screen.findAllByText(/Pyme/);
  return r;
};
const row = (label: string) => screen.getByText(label).closest("tr") as HTMLElement;
const marksOf = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);

describe("CAC real marks", () => {
  it("CA-8 shared cost split equally when nobody won: «+ Compartido asignado» and «Coste total»", async () => {
    const { container } = await show({
      segments,
      deals: [],
      cac_costs: [{ id: "c1", segment_id: null, channel: "Paid media", amount: 1000 }],
    });
    // SDD-20261109 D7: the shared cost is no longer split when nobody won.
    const equal = "Sin dato · nadie ganó: el compartido no se reparte";
    expect(marksOf(row("+ Compartido asignado"))).toEqual([equal, equal]);
    expect(marksOf(row("Coste total"))).toEqual([equal, equal]);
    expectDataMarks(container);
  });

  it("CA-8 no mark when the shared cost is split by customers", async () => {
    await show({
      segments,
      deals: [dealRow({ segment_id: "a", amount: 10000, stage: "won", closed_at: Q4 })],
      cac_costs: [{ id: "c1", segment_id: null, channel: "Paid media", amount: 1000 }],
    });
    expect(marksOf(row("+ Compartido asignado"))).toEqual([]);
  });

  it("CA-5 / CA-7 deals won by amount, margin assumed and margin ≤ 0", async () => {
    const { container } = await show({
      segments,
      deals: [
        dealRow({ amount: 10000, stage: "won", closed_at: Q4 }),
        dealRow({ segment_id: "a", amount: 12000, stage: "won", closed_at: Q4 }),
        dealRow({ segment_id: "b", amount: 150000, stage: "won", closed_at: Q4 }),
      ],
      cac_costs: [
        { id: "c1", segment_id: "a", channel: "Eventos", amount: 2000 },
        { id: "c2", segment_id: "b", channel: "Eventos", amount: 1000 },
      ],
    });
    expect(marksOf(row("Deals ganados"))).toEqual(["Estimado · 1 de 2 asignados por importe"]);
    const payback = row("Payback real");
    expect(marksOf(payback)).toEqual([
      // SDD-20261109 D1: without a margin there is no payback (never 100 %).
      "Sin dato · falta margen",
      "Sin dato · margen 0 % o negativo",
    ]);
    const sinDato = [...payback.querySelectorAll("[data-mark]")][1];
    expect(sinDato.closest(".text-success, .text-signal")).toBeNull();
    expect(payback.textContent).not.toContain("Infinity");
    expectDataMarks(container, 2);
  });
});

// SDD-20261109-metrics-strategy-no-estimates · U-3 · CA-2, CA-6, CA-13 (D7, D11): the company CAC of the header is
// every cost / every won deal of the quarter (also without segment); a missing CAC or payback reads «Sin dato».
describe("NK-0094 CAC real: one company CAC, Sin dato instead of «—»", () => {
  it("D11: «CAC medio» counts the won deal without segment; D7: shared cost kept in the total", async () => {
    await show({
      segments,
      deals: [
        dealRow({ segment_id: "a", amount: 10000, stage: "won", closed_at: Q4 }),
        dealRow({ amount: null, stage: "won", closed_at: Q4 }),
      ],
      cac_costs: [
        { id: "c1", segment_id: "a", channel: "Eventos", amount: 2000 },
        { id: "c2", segment_id: null, channel: "Paid media", amount: 1000 },
      ],
    });
    // 3000 / 2 won deals (one without segment)
    expect(screen.getByText("1500 €")).toBeTruthy();
    expect(screen.getByText("CAC medio · 2 clientes")).toBeTruthy();
  });

  it("CA-13: no «—» for a missing CAC or payback; only typed costs and targets keep it", async () => {
    const { container } = await show({
      segments,
      deals: [],
      cac_costs: [{ id: "c1", segment_id: "a", channel: "Eventos", amount: 2000 }],
    });
    expect(marksOf(row("CAC real"))).toEqual([
      "Sin dato · ningún deal ganado en 2026-Q4",
      "Sin dato · sin costes en 2026-Q4",
    ]);
    expect(marksOf(row("Payback real"))).toEqual([
      "Sin dato · ningún deal ganado en 2026-Q4",
      "Sin dato · sin costes en 2026-Q4",
    ]);
    expectNoBareDash(container, ["CAC objetivo: —"]);
    expectDataMarks(container, 4);
  });
});
