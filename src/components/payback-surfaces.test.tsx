// SDD-20261109-metrics-strategy-no-estimates · CA-3 and CA-7 (walkthrough fix NK-0094): the screens of /metrics,
// /strategy and Inicio, rendered from the same data, show the same payback for the same segment and quarter, with the
// same number format, and the Inicio headline agrees with its own table. Fictional data, no network.
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
import { SegmentCoverage } from "@/components/segment-coverage";
import { PaybackQuarters } from "@/components/payback-quarters";
import { PaybackCard } from "@/components/payback-card";
import { BudgetQuarters } from "@/components/budget-quarters";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());
afterEach(cleanup);

const budget = (segment_id: string, plan_revenue: number, plan_cost_to_serve: number) => ({
  segment_id,
  period: "2026-Q4",
  plan_revenue,
  plan_cost_to_serve,
  plan_acquisition: null,
  plan_new_customers: null,
  actual_revenue: null,
  actual_cost_to_serve: null,
});
// A: no target margin, planned margin from the budget. B: target margin 70 % and a planned margin (the chain wins).
const TABLES = {
  segments: [
    segRow({ id: "a", name: "Alfa", acv_min: 0, acv_max: 20000 }),
    segRow({ id: "b", name: "Beta", acv_min: 20001, acv_max: 90000, gross_margin_pct: 70 }),
  ],
  deals: [
    dealRow({ segment_id: "a", amount: 12000, stage: "won", closed_at: "2026-10-20T10:00:00Z" }),
    dealRow({ segment_id: "b", amount: 24000, stage: "won", closed_at: "2026-10-21T10:00:00Z" }),
  ],
  cac_costs: [
    { id: "c1", segment_id: "a", channel: "Eventos", amount: 1000, period: "2026-Q4" },
    { id: "c2", segment_id: "b", channel: "Eventos", amount: 1500, period: "2026-Q4" },
  ],
  segment_targets: [],
  segment_budget_quarters: [budget("a", 60000, 1000), budget("b", 40000, 500)],
};

const wrap = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);
const PAYBACK = /\d+(?:[.,]\d+)? m(?![a-zñ])|Sin dato · [^\n]+/;
const paybackIn = (el: Element | null | undefined) => PAYBACK.exec(el?.textContent ?? "")?.[0];

async function onCac() {
  render(wrap(<CacPanel quarter="2026-Q4" />));
  await screen.findAllByText(/Payback real/);
  const cells = [...(screen.getByText("Payback real").closest("tr")?.children ?? [])].slice(1);
  return { Alfa: paybackIn(cells[0]), Beta: paybackIn(cells[1]) };
}
async function onCoverage() {
  const { container } = render(wrap(<SegmentCoverage quarter="2026-Q4" />));
  await screen.findByText("Alfa");
  const of = (name: string) =>
    paybackIn(
      within(screen.getByText(name).closest("div.rounded-md") as HTMLElement)
        .getByText("Payback real")
        .closest("div"),
    );
  expect(container).toBeTruthy();
  return { Alfa: of("Alfa"), Beta: of("Beta") };
}
async function onPaybackScreen() {
  render(wrap(<PaybackQuarters />));
  await screen.findByText("Alfa");
  const of = (name: string) =>
    paybackIn(screen.getByText(name).closest("tr")?.querySelectorAll("td")[4]);
  return { Alfa: of("Alfa"), Beta: of("Beta") };
}
async function onHome() {
  render(wrap(<PaybackCard />));
  await screen.findByText("Alfa");
  const of = (name: string) =>
    paybackIn(screen.getByText(name).closest("tr")?.querySelectorAll("td")[4]);
  return { Alfa: of("Alfa"), Beta: of("Beta") };
}
async function onBudget() {
  render(wrap(<BudgetQuarters />));
  await screen.findAllByText("Payback");
  // first segment (Alfa): the «Payback» row has a plan and a real value per quarter; only Q4 has a real payback.
  const row = screen
    .getAllByText("Payback")
    .find((e) => e.tagName === "TD")!
    .closest("tr")!;
  const real = [...row.querySelectorAll("td")].find((c) =>
    /\d m(?![a-zñ])/.test(c.textContent ?? ""),
  );
  return { Alfa: paybackIn(real) };
}

describe("CA-3: the same payback (value, format) on every surface for 2026-Q4", () => {
  it("«CAC real», Cobertura, Payback real and Inicio agree for both segments, and none says «Sin dato»", async () => {
    db.tables = TABLES;
    const cac = await onCac();
    cleanup();
    const cov = await onCoverage();
    cleanup();
    const pay = await onPaybackScreen();
    cleanup();
    const home = await onHome();
    // es-ES: a comma, never a point, and no trailing «,0».
    expect(home.Alfa).toMatch(/^\d+(,\d)? m$/);
    expect(home.Beta).toMatch(/^\d+(,\d)? m$/);
    expect(cac, "CAC real").toEqual(home);
    expect(cov, "Cobertura").toEqual(home);
    expect(pay, "Payback real").toEqual(home);
  });

  it("Presupuesto vs real shows the same payback for the first segment", async () => {
    db.tables = TABLES;
    const home = await onHome();
    cleanup();
    expect((await onBudget()).Alfa).toBe(home.Alfa);
  });
});

describe("CA-7: the Inicio headline agrees with its table", () => {
  it("with payback values but no target typed, it does not say «Aún sin payback real»", async () => {
    db.tables = TABLES; // no segment has payback_months
    const { container } = render(wrap(<PaybackCard />));
    await screen.findByText("Alfa");
    expect(container.textContent).toMatch(/\d(,\d)? m(?![a-zñ])/);
    expect(container.textContent).not.toContain("Aún sin payback real");
  });

  it("Objetivo and Tendencia without a value read «Sin dato · motivo», never a bare «—»", async () => {
    db.tables = TABLES;
    const { container } = render(wrap(<PaybackCard />));
    await screen.findByText("Alfa");
    const row = screen.getByText("Alfa").closest("tr") as HTMLElement;
    const tds = row.querySelectorAll("td");
    expect(tds[5].querySelector('[data-mark="sin_dato"]')?.textContent).toMatch(/^Sin dato · .+/);
    expect(tds[6].querySelector('[data-mark="sin_dato"]')?.textContent).toMatch(/^Sin dato · .+/);
    expect(container.textContent).not.toContain("—");
  });
});

describe("CA-7: same data → same state and reason on Payback real and Inicio", () => {
  // A won deal with no segment is assigned by its amount (estimated attribution): both screens must say so.
  const withInferred = {
    ...TABLES,
    deals: [
      ...TABLES.deals,
      dealRow({ segment_id: null, amount: 15000, stage: "won", closed_at: "2026-10-22T10:00:00Z" }),
    ],
  };
  const marksOfQ4 = (name: string) =>
    [
      ...(screen
        .getByText(name)
        .closest("tr")
        ?.querySelectorAll("td")[4]
        ?.querySelectorAll("[data-mark]") ?? []),
    ].map((m) => `${m.getAttribute("data-mark")}|${m.textContent}`);

  it("the Q4 cell of each segment carries the same marks (state and reason) on both screens", async () => {
    db.tables = withInferred;
    render(wrap(<PaybackQuarters />));
    await screen.findByText("Alfa");
    const payback = { Alfa: marksOfQ4("Alfa"), Beta: marksOfQ4("Beta") };
    cleanup();
    render(wrap(<PaybackCard />));
    await screen.findByText("Alfa");
    const home = { Alfa: marksOfQ4("Alfa"), Beta: marksOfQ4("Beta") };
    expect(payback.Alfa.some((m) => m.startsWith("estimado|Estimado · "))).toBe(true);
    expect(home).toEqual(payback);
  });
});

describe("CA-8 / D8: Presupuesto vs real carries the estimated-attribution mark too", () => {
  it("the real payback and CAC cells of the first segment carry the mark that Payback real shows", async () => {
    db.tables = {
      ...TABLES,
      deals: [
        ...TABLES.deals,
        dealRow({
          segment_id: null,
          amount: 15000,
          stage: "won",
          closed_at: "2026-10-22T10:00:00Z",
        }),
      ],
    };
    render(wrap(<PaybackQuarters />));
    await screen.findByText("Alfa");
    const expected = [
      ...(screen
        .getByText("Alfa")
        .closest("tr")
        ?.querySelectorAll("td")[4]
        ?.querySelectorAll('[data-mark="estimado"]') ?? []),
    ].map((m) => m.textContent);
    expect(expected).toEqual(["Estimado · 1 de 2 asignados por importe"]);
    cleanup();

    render(wrap(<BudgetQuarters />));
    await screen.findAllByText("Payback");
    const realCell = (label: string) =>
      [
        ...(screen
          .getAllByText(label)
          .find((e) => e.tagName === "TD")
          ?.closest("tr")
          ?.querySelectorAll("td") ?? []),
      ].find(
        (c) =>
          /\d/.test(c.textContent ?? "") &&
          /\d,?\d* m(?![a-zñ])|\d+ €/.test(c.textContent ?? "") &&
          c.querySelector('[data-mark="estimado"]'),
      );
    for (const label of ["Payback", "CAC"]) {
      const cell = realCell(label);
      expect(cell, `${label} real cell with an estimated mark`).toBeTruthy();
      expect(
        [...cell!.querySelectorAll('[data-mark="estimado"]')].map((m) => m.textContent),
      ).toContain(expected[0]);
    }
  });
});
