// SDD-20261109-metrics-strategy-no-estimates · U-4 · CA-9, CA-13, CA-14 in Modelos de venta: no example ACV (D12), the
// mean of the ranges marked «Estimado» (D13), the plan's «Payback real» equal to the table's whatever ACV is typed
// (D14a), the target-CAC scenario marked (D14b), each real row with its window, never «margen bruto 100%» nor a «—»
// for a missing ACV, CAC, payback or win rate. Fictional data, no network.
import { fireEvent, render, screen } from "@testing-library/react";
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

import { Motions } from "@/components/strategy/motions";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const pyme = segRow({
  id: "a",
  name: "Pyme",
  acv_min: 5000,
  acv_max: 20000,
  gross_margin_pct: 60,
  payback_months: 12,
  cac_target: 3000,
  win_rate_target: 25,
  ae_quota: 100000,
  motion: "inside",
  acquisition_motion: null,
  priority: 1,
  cycle_days: 60,
  sdr_per_ae: null,
  ae_per_se: null,
  notes: null,
});
const won = (amount: number, closed_at: string) =>
  dealRow({ segment_id: "a", amount, stage: "won", closed_at, created_at: "2026-09-01T10:00:00Z" });

const show = async (tables: Partial<FakeDb["tables"]>) => {
  db.tables = {
    segments: [],
    deals: [],
    cac_costs: [],
    segment_budget_quarters: [],
    ...tables,
  };
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <Motions />
    </QueryClientProvider>,
  );
  await screen.findByText("Calculadora de estrategia GTM");
  return r;
};
const tile = (label: string) =>
  screen.getByText(label, { selector: "p.eyebrow" }).parentElement as HTMLElement;
const marksOf = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-mark]")].map((m) => m.textContent);
const acvInput = () => screen.getByPlaceholderText("Escribe un ACV") as HTMLInputElement;
/** 50 000 is outside Pyme's range: choose the segment by hand, as a person would. */
const forcePyme = () =>
  fireEvent.change(screen.getByDisplayValue("Automático según ACV"), { target: { value: "a" } });
const basisReal = () =>
  fireEvent.change(screen.getByDisplayValue("Benchmarks objetivo del segmento"), {
    target: { value: "real" },
  });

describe("Modelos de venta (CA-9, CA-13, CA-14)", () => {
  it("D12: without deals or ranges the ACV stays empty and the calculator says «Sin dato · falta ACV»", async () => {
    const { container } = await show({});
    expect(acvInput().value).toBe("");
    expect(marksOf(container)).toContain("Sin dato · falta ACV");
    expect(container.textContent).not.toMatch(/20\.?000|valor de ejemplo/);
    expectDataMarks(container);
  });

  it("D13: with ranges and no deals, «Estimado · media de los rangos de tus segmentos»", async () => {
    const { container } = await show({ segments: [pyme] });
    await screen.findByText("Segmento · Pyme");
    expect(acvInput().value).toBe("12500");
    expect(marksOf(container)).toContain("Estimado · media de los rangos de tus segmentos");
  });

  it("D14a: with basis «real» the plan's «Payback real» is the table's, and a typed ACV does not move it", async () => {
    const { container } = await show({
      segments: [pyme],
      deals: [won(10000, "2026-10-20T10:00:00Z"), won(12000, "2026-11-02T10:00:00Z")],
      cac_costs: [{ segment_id: "a", channel: "Eventos", amount: 6000, period: "2026-Q4" }],
    });
    await screen.findByText("Segmento · Pyme");
    basisReal();
    // 3000 / (11 000 × 60 % / 12) = 5.45…
    expect(tile("Payback real").textContent).toContain("5,5 m");
    // the table's payback row (window «Últimos 4 trimestres») shows the same figure
    expect(container.textContent?.match(/5,5 m/g)?.length).toBe(2);
    forcePyme();
    fireEvent.change(acvInput(), { target: { value: "50000" } });
    expect(tile("Payback real").textContent).toContain("5,5 m");
    expect(marksOf(tile("Payback real"))).toEqual([]);
  });

  it("D14b: with basis «objetivo» the scenario is «Estimado · con el ACV de la calculadora y el CAC objetivo»", async () => {
    await show({
      segments: [pyme],
      deals: [won(10000, "2026-10-20T10:00:00Z"), won(12000, "2026-11-02T10:00:00Z")],
      cac_costs: [{ segment_id: "a", channel: "Eventos", amount: 6000, period: "2026-Q4" }],
    });
    await screen.findByText("Segmento · Pyme");
    forcePyme();
    fireEvent.change(acvInput(), { target: { value: "50000" } });
    const t = tile("Payback estimado");
    // 3000 / (50 000 × 60 % / 12) = 1.2
    expect(t.textContent).toContain("1,2 m");
    expect(marksOf(t)).toEqual(["Estimado · con el ACV de la calculadora y el CAC objetivo"]);
    expect(screen.getByText(/Dentro del payback objetivo de 12 meses/)).toBeTruthy();
  });

  it("no margin: no payback, no «Dentro/Fuera», never «margen bruto 100%»", async () => {
    const { container } = await show({
      segments: [{ ...pyme, gross_margin_pct: null }],
      deals: [won(10000, "2026-10-20T10:00:00Z")],
      cac_costs: [{ segment_id: "a", channel: "Eventos", amount: 6000, period: "2026-Q4" }],
    });
    await screen.findByText("Segmento · Pyme");
    expect(marksOf(tile("Payback estimado"))).toEqual(["Sin dato · falta margen"]);
    expect(container.textContent).not.toMatch(
      /margen bruto 100|Dentro del payback|Fuera del payback/,
    );
  });

  it("CA-14 / CA-13: each real row says its window; no «—» for a missing ACV, win rate, CAC or payback", async () => {
    const { container } = await show({ segments: [pyme] });
    await screen.findByText("Segmento · Pyme");
    for (const w of ["Todo el histórico", "Últimos 365 días", "Últimos 4 trimestres"])
      expect(screen.getAllByText(w).length, w).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("Real (12 meses)");
    expect(screen.getAllByText("Win rate real · Últimos 365 días").length).toBeGreaterThan(0);
    expect(marksOf(container)).toEqual(
      expect.arrayContaining([
        "Sin dato · ningún deal cerrado en últimos 365 días",
        "Sin dato · sin costes en los últimos 4 trimestres",
      ]),
    );
    // team ratios not set and the real cycle (other metrics, NK-0106)
    expectNoBareDash(container, ["— Win rate objetivo", "— 60 días", "—", ": —"]);
    expectDataMarks(container);
  });
});
