// SDD-20261106-ux-metrics-data-state · U-1 · CA-2: the closed list of /metrics (X-1, X-2, X-3, X-5, X-7, X-8) is
// folded behind «Cómo se calcula»; what the SDD §9 leaves in view (the X-3 link hint, the X-8 data warnings) and the
// blocks that stay fixed (X-4, X-6) are visible without opening anything. Fictional data, no network.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dealRow, segRow, type FakeDb } from "@/test/metrics-mocks";

const db = vi.hoisted((): FakeDb => ({ tables: {} }));
// Like the shared fake, but maybeSingle() answers the first row (Stripe reads one connection and one snapshot).
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) =>
                Promise.resolve({ data: db.tables[table] ?? [], error: null }).then(f)
            : p === "maybeSingle"
              ? () => Promise.resolve({ data: db.tables[table]?.[0] ?? null, error: null })
              : () => chain(table),
      },
    );
  return { supabase: { from: (t: string) => chain(t) } };
});
vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());
vi.mock("@/hooks/use-leads", async () => {
  const { DEFAULT_LEAD_SLA } = await import("@/lib/lead-funnel");
  return { useLeads: () => ({ data: { leads: [], sla: DEFAULT_LEAD_SLA, members: [] } }) };
});
vi.mock("@/components/stage-settings", () => ({ useStages: () => ({ stages: null }) }));
vi.mock("@/lib/stripe.functions", () => ({ connectStripe: vi.fn(), syncStripeNow: vi.fn() }));

import { SegmentCoverage } from "@/components/segment-coverage";
import { CacPanel } from "@/components/cac-panel";
import { BudgetPanel } from "@/components/budget-panel";
import { PipelineBoardPanel } from "@/components/pipeline-board-panel";
import { WonDealsPanel } from "@/components/won-deals-panel";
import { StripeMetricsPanel } from "@/components/stripe-panel";
import { QuarterKpisPanel } from "@/components/quarter-kpis-panel";
import { SelfServiceFunnel } from "@/components/self-service-funnel";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());
afterEach(cleanup);

const Q4 = "2026-10-20T10:00:00Z";
const BUTTON = "Cómo se calcula";
db.tables = {
  segments: [segRow({ id: "a", name: "Pyme", acv_min: 0, acv_max: 50000, gross_margin_pct: 60 })],
  deals: [dealRow({ segment_id: "a", amount: 10000, stage: "won", closed_at: Q4 })],
  cac_costs: [{ id: "c1", segment_id: "a", channel: "Eventos", amount: 5000, period: "2026-Q4" }],
  segment_targets: [],
  segment_budget_quarters: [],
  accounts: [],
  trials: [],
};
const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const text = (c: HTMLElement) => (c.textContent ?? "").replace(/\s+/g, " ");

/** The block is not in the document, the panel has one closed button, and opening it shows the block unchanged. */
function expectFolded(c: HTMLElement, start: string, full: string) {
  expect(text(c), `«${start}» hidden`).not.toContain(start);
  const button = within(c).getByRole("button", { name: BUTTON });
  expect(button.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(text(c)).toContain(full);
}

describe("closed list of /metrics is folded (CA-2)", () => {
  it("X-1 Cobertura por segmento", async () => {
    const { container } = wrap(<SegmentCoverage quarter="2026-Q4" />);
    await screen.findByText("Pyme");
    expectFolded(
      container,
      "Cobertura = pipeline abierto",
      "Real frente a objetivo. Cobertura = pipeline abierto que cierra este trimestre / objetivo del segmento (sana entre 3x y 4x). Los deals sin segmento se asignan por su importe.",
    );
  });

  it("X-2 CAC real", async () => {
    const { container } = wrap(<CacPanel quarter="2026-Q4" />);
    await screen.findByText("+ Compartido asignado");
    expectFolded(
      container,
      "Introduce lo que gastaste",
      "Introduce lo que gastaste para captar clientes, por canal y segmento. CAC = coste / deals ganados en el trimestre. Los costes «Compartido» se reparten entre segmentos según los clientes ganados. El payback de la cobertura usa este CAC.",
    );
  });

  it("X-3 Presupuesto: the hint with its link stays in view, the rest folds", async () => {
    const { container } = wrap(<BudgetPanel year={2026} />);
    await screen.findByText("Presupuesto por segmento · 2026");
    const link = within(container).getByRole("link", {
      name: "Estrategia GTM → Presupuesto vs real",
    });
    expect(link.getAttribute("href")).toBe("/strategy?tab=budget");
    expect(text(link.parentElement as HTMLElement)).toContain("Se apunta por trimestre en");
    expectFolded(
      container,
      "Suma de los cuatro trimestres.",
      "Suma de los cuatro trimestres. El margen real (ingresos − coste de servir) sustituye al margen objetivo en todos los paybacks.",
    );
    expect(link.isConnected, "the link never goes into the fold").toBe(true);
  });

  it("X-5 Pipeline", async () => {
    const { container } = wrap(<PipelineBoardPanel quarter="2026-Q4" />);
    // SDD-20261109 D10: the board's payback is labelled «Payback real» now (only the label it waits for changes).
    await screen.findByText("Payback real");
    expectFolded(
      container,
      "Quién sigue en cada etapa",
      "Quién sigue en cada etapa, de lead a deal ganado. Los ganados del trimestre son los que dividen el gasto de captación en el CAC real; las oportunidades que cierran este trimestre, al win rate real, dan el CAC y el payback proyectados.",
    );
  });

  it("X-7 Deals ganados", async () => {
    const { container } = wrap(<WonDealsPanel quarter="2026-Q4" />);
    await screen.findByText("Deals ganados · 2026-Q4");
    expectFolded(
      container,
      "Son los clientes nuevos",
      "Son los clientes nuevos entre los que se divide el gasto de «CAC real». Revisa que cada uno tenga su fecha de cierre real, su valor y su segmento: la fecha decide el trimestre, el segmento decide a quién se le imputa el CAC y el valor alimenta el ACV del payback.",
    );
  });
});

describe("Stripe panel (X-8)", () => {
  const snapshot = (details: Record<string, unknown>) => ({
    taken_at: "2026-11-14T10:00:00Z",
    mrr: 1000,
    currency: "EUR",
    active_customers: 10,
    trialing: 0,
    new_customers: 2,
    new_mrr: 200,
    window_days: 30,
    churned_customers: 1,
    logo_churn_pct: 10,
    revenue_churn_pct: 5,
    details,
  });
  const show = async (details: Record<string, unknown>) => {
    db.tables = {
      ...db.tables,
      stripe_connections: [{ status: "ok" }],
      stripe_snapshots: [snapshot(details)],
    };
    const r = wrap(<StripeMetricsPanel />);
    await screen.findByText("Ingresos en Stripe");
    return r;
  };
  const FIXED =
    "Cuenta como cliente de pago quien tiene una suscripción activa o con un pago pendiente, igual que Stripe; las pruebas van aparte y una prueba cancelada no es una baja. Un cambio de plan no cuenta como alta ni como baja. Las suscripciones impagadas o pausadas dejan de contar como clientes de pago, pero no como bajas. Los precios anuales o trimestrales se pasan a mes.";

  it("the four fixed sentences fold; the three data warnings stay in view", async () => {
    const { container } = await show({
      truncated: true,
      unpriced_items: 3,
      other_currencies: { USD: { mrr: 100, customers: 2 } },
    });
    const seen = text(container);
    expect(seen).toContain("3 conceptos con precio por tramos o por uso no se han podido sumar.");
    expect(seen).toContain("Hay más de 5.000 suscripciones: las cifras son parciales.");
    expect(seen).toContain(
      "Suscripciones en otras monedas, sin convertir: 2 clientes y 100 USD de MRR.",
    );
    expectFolded(container, "Cuenta como cliente de pago", FIXED);
    expect(text(container)).toContain("Hay más de 5.000 suscripciones: las cifras son parciales.");
  });

  it("without warnings only the fold shows", async () => {
    const { container } = await show({});
    expect(text(container)).not.toContain("conceptos con precio");
    expect(text(container)).not.toContain("las cifras son parciales");
    expectFolded(container, "Cuenta como cliente de pago", FIXED);
  });
});

describe("blocks that stay fixed (X-4, X-6)", () => {
  it("X-4 KPIs trimestrales shows its whole text with no button", async () => {
    const { container } = wrap(<QuarterKpisPanel quarter="2026-Q4" />);
    await screen.findByText("KPIs trimestrales");
    expect(within(container).queryByRole("button", { name: BUTTON })).toBeNull();
    expect(text(container)).toContain("Toda la empresa, real frente a presupuesto.");
    expect(text(container)).toContain(
      "el payback es la media de los segmentos ponderada por clientes. Verde = mejor que el plan; rojo = peor.",
    );
  });

  it("X-6 the CSV instructions stay in view when the form opens", async () => {
    wrap(<SelfServiceFunnel quarter="2026-Q4" />);
    fireEvent.click(await screen.findByRole("button", { name: "Gestionar registros" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "Columnas: email, empresa, segmento (nombre exacto), fuente, plan, alta, activacion, pago, mrr. Fechas AAAA-MM-DD o DD/MM/AAAA. Si el email ya existe, se actualiza.",
      ),
    ).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: BUTTON })).toBeNull();
  });
});
