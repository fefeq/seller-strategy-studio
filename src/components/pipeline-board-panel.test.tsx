// SDD-20261106-metrics-honest-data · U-4 · CA-7, CA-9, CA-10 in the Rendimiento board: where its margin and its ACV
// come from, the 365-day window of its win rate, and «Sin dato» instead of an Infinity / negative payback when the
// margin is 0 % or below. Fictional data, no network.
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
vi.mock("@/hooks/use-leads", async () => {
  const { DEFAULT_LEAD_SLA } = await import("@/lib/lead-funnel");
  return { useLeads: () => ({ data: { leads: [], sla: DEFAULT_LEAD_SLA, members: [] } }) };
});
vi.mock("@/components/stage-settings", () => ({ useStages: () => ({ stages: null }) }));

import { PipelineBoardPanel } from "@/components/pipeline-board-panel";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const bq = (o: Record<string, unknown>) => ({
  segment_id: "a",
  period: "2026-Q4",
  plan_revenue: null,
  plan_cost_to_serve: null,
  plan_acquisition: null,
  plan_new_customers: null,
  actual_revenue: null,
  actual_cost_to_serve: null,
  ...o,
});
const segments = [
  segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 50000, gross_margin_pct: 60 }),
  segRow({ id: "b", name: "Mid", acv_min: 50001, gross_margin_pct: 80 }),
];
const wonQ4 = (o: Record<string, unknown> = {}) =>
  dealRow({
    segment_id: "a",
    amount: 10000,
    stage: "won",
    closed_at: "2026-10-20T10:00:00Z",
    ...o,
  });

const show = async (tables: Partial<FakeDb["tables"]>) => {
  db.tables = { segments, deals: [], segment_budget_quarters: [], cac_costs: [], ...tables };
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <PipelineBoardPanel quarter="2026-Q4" />
    </QueryClientProvider>,
  );
  // SDD-20261109 D10: one payback on the board, the KPI's («Payback real», no «→ proyectado»).
  await screen.findByText("Payback real");
  return r;
};
const stat = (label: string) => screen.getByText(label).parentElement as HTMLElement;
const marksOf = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);
const cost = { segment_id: null, channel: "Paid media", amount: 5000, period: "2026-Q4" };

describe("Rendimiento board marks (CA-9, CA-7)", () => {
  it("mean of target margins, ACV from won deals, win rate of the last 365 days", async () => {
    const { container } = await show({ deals: [wonQ4()], cac_costs: [cost] });
    // SDD-20261109 D10: the board's payback is the KPI's: 5000 / (10000 × 60 % / 12) = 10, real.
    const p = stat("Payback real");
    expect(marksOf(p)).toEqual(["Real"]);
    expect(p.textContent).toContain("10 m");
    expect(stat("CAC proyectado").textContent).toContain("Últimos 365 días");
    expectDataMarks(container, 2);
  });

  it("real margin of the books; margin ≤ 0 replaces the payback with «Sin dato», neutral", async () => {
    const { container } = await show({
      deals: [wonQ4()],
      cac_costs: [cost],
      segment_budget_quarters: [bq({ actual_revenue: 1000, actual_cost_to_serve: 1200 })],
    });
    // SDD-20261109 D2, D10: the only segment has margin ≤ 0, so no segment has a payback.
    const p = stat("Payback real");
    expect(marksOf(p)).toEqual(["Sin dato · ningún segmento con payback"]);
    expect(p.textContent).not.toMatch(/Infinity|-\d[\d.,]* m/);
    const mark = [...p.querySelectorAll("[data-mark]")].find((m) =>
      m.textContent?.startsWith("Sin dato"),
    );
    expect(mark!.closest(".text-success, .text-signal")).toBeNull();
    expect(container.textContent).not.toContain("Infinity");
  });

  it("margin of the won deals with product lines", async () => {
    await show({ deals: [wonQ4({ gross_margin: 3000 })], cac_costs: [cost] });
    // SDD-20261109 D10, D15: 30 % margin of the won deal with lines → 5000 / (10000 × 30 % / 12) = 20.
    expect(marksOf(stat("Payback real"))).toEqual(["Real"]);
    expect(stat("Payback real").textContent).toContain("20 m");
  });

  it("plan margin and ACV from open deals", async () => {
    await show({
      deals: [dealRow({ segment_id: "a", amount: 20000, stage: "demo", close_date: "2026-12-10" })],
      segment_budget_quarters: [bq({ plan_revenue: 1000, plan_cost_to_serve: 400 })],
    });
    // SDD-20261109 D10: no margin or ACV of the board's own; without costs or wins, no payback.
    expect(marksOf(stat("Payback real"))).toEqual(["Sin dato · ningún segmento con payback"]);
  });
});

// SDD-20261109-metrics-strategy-no-estimates · U-3 · CA-2, CA-6, CA-13, CA-14: the board's CACs and payback are the
// KPI's Figures; the projected CAC is «Estimado» with its window beside the number; no «—» for a missing figure.
describe("NK-0094 Rendimiento board: one payback, the projected CAC says its window", () => {
  // «CAC real» is also the text of the link in the spend hint: take the KPI label.
  const cacReal = () =>
    screen.getAllByText("CAC real").find((e) => e.tagName !== "A")!.parentElement as HTMLElement;
  it("CA-14 / CA-6: «Estimado · proyección con win rate de los últimos 365 días» next to the projected CAC", async () => {
    const { container } = await show({
      deals: [
        wonQ4(),
        dealRow({ segment_id: "a", amount: 9000, stage: "demo", close_date: "2026-12-10" }),
      ],
      cac_costs: [cost],
    });
    const p = stat("CAC proyectado");
    expect(marksOf(p)).toEqual(["Estimado · proyección con win rate de los últimos 365 días"]);
    // 5000 / (1 won + 1 closing × 100 %) = 2500
    expect(p.textContent).toContain("2500 €");
    expect(marksOf(cacReal())).toEqual(["Real"]);
    expect(container.textContent).not.toContain("→ proyectado");
    expectDataMarks(container, 3);
  });

  it("CA-13: without costs every CAC and the payback say why; only the spend keeps «—»", async () => {
    const { container } = await show({ deals: [wonQ4()] });
    expect(marksOf(cacReal())).toEqual(["Sin dato · sin costes en 2026-Q4"]);
    expect(marksOf(stat("CAC proyectado"))).toEqual(["Sin dato · sin costes en 2026-Q4"]);
    expectNoBareDash(container, ["— Apúntalo en «CAC real»"]); // the spend nobody typed (otra métrica)
  });
});
