// SDD-20261106-metrics-honest-data · U-4 · CA-11: the hints of /metrics that send to another section are links to
// where it is fixed («CAC real» → /metrics?seccion=economia; «Presupuesto por segmento» and «Presupuesto vs real» →
// /strategy?tab=budget; «Define cuotas» → /metrics?seccion=rendimiento), and no text of /metrics says «más abajo»,
// «más arriba» or «abajo» for another section («Añade facturas abajo», same panel, stays). Fictional data.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

import { QuarterKpisPanel } from "@/components/quarter-kpis-panel";
import { PipelineBoardPanel } from "@/components/pipeline-board-panel";
import { SegmentCoverage } from "@/components/segment-coverage";
import { BudgetPanel } from "@/components/budget-panel";
import { ResumenKpis } from "@/components/metrics/performance-panels";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const CAC_REAL = "/metrics?seccion=economia";
const BUDGET = "/strategy?tab=budget";
const QUOTAS = "/metrics?seccion=rendimiento";
const ELSEWHERE = /más abajo|más arriba|\babajo\b/i;

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const hrefs = (name: string | RegExp) =>
  screen.getAllByRole("link", { name }).map((a) => a.getAttribute("href"));

describe("CA-11 linked hints", () => {
  it("KPIs trimestrales: «Presupuesto vs real» → budget tab, «CAC real» → CAC y presupuesto (both hints)", async () => {
    db.tables = {
      segments: [segRow({ id: "a", name: "Pyme", acv_min: 0, gross_margin_pct: 60 })],
      deals: [],
      segment_budget_quarters: [],
      cac_costs: [],
    };
    const { container } = wrap(<QuarterKpisPanel quarter="2026-Q4" />);
    await screen.findByText("Payback 2026-Q4");
    expect(hrefs("Estrategia GTM → Presupuesto vs real")).toEqual([BUDGET]);
    expect(hrefs("CAC real")).toEqual([CAC_REAL, CAC_REAL]);
    expect(container.textContent).not.toMatch(ELSEWHERE);
  });

  it("Rendimiento board: «CAC real» → CAC y presupuesto", async () => {
    db.tables = {
      segments: [segRow({ id: "a", name: "Pyme", acv_min: 0 })],
      deals: [],
      segment_budget_quarters: [],
      cac_costs: [],
    };
    const { container } = wrap(<PipelineBoardPanel quarter="2026-Q4" />);
    await screen.findByText("Gasto de captación del trimestre");
    expect(hrefs("CAC real")).toEqual([CAC_REAL]);
    expect(container.textContent).not.toMatch(ELSEWHERE);
  });

  it("Cobertura: «Presupuesto por segmento» → budget tab; «CAC real» → CAC y presupuesto", async () => {
    db.tables = {
      segments: [
        segRow({
          id: "a",
          name: "Pyme",
          acv_min: 0,
          acv_max: 9000,
          gross_margin_pct: 60,
          cac_target: 1000,
        }),
        segRow({ id: "b", name: "Mid", acv_min: 9001, gross_margin_pct: 60 }),
      ],
      deals: [
        dealRow({ segment_id: "a", amount: 5000, stage: "won", closed_at: "2026-10-20T10:00:00Z" }),
      ],
      cac_costs: [],
      segment_targets: [],
      segment_budget_quarters: [],
    };
    const { container } = wrap(<SegmentCoverage quarter="2026-Q4" />);
    await screen.findByText("Pyme");
    expect(hrefs("Presupuesto por segmento")).toEqual([BUDGET, BUDGET]);
    // «Calculado con el CAC objetivo…» (Pyme) and «Introduce los costes en «CAC real» o un CAC objetivo…» (Mid)
    expect(hrefs("CAC real")).toEqual([CAC_REAL, CAC_REAL]);
    expect(container.textContent).not.toMatch(ELSEWHERE);
  });

  it("Presupuesto por segmento: «Estrategia GTM → Presupuesto vs real» → budget tab", async () => {
    db.tables = {
      segments: [segRow({ id: "a", name: "Pyme", acv_min: 0 })],
      deals: [],
      segment_budget_quarters: [],
      cac_costs: [],
    };
    const { container } = wrap(<BudgetPanel year={2026} />);
    await screen.findByText("Pyme");
    expect(hrefs("Estrategia GTM → Presupuesto vs real")).toEqual([BUDGET]);
    expect(container.textContent).not.toMatch(ELSEWHERE);
  });

  it("Resumen: «Define cuotas» → Rendimiento, where the quotas panel lives", () => {
    const { container } = render(
      <ResumenKpis
        quarter="2026-Q4"
        money={(n) => `${n} €`}
        quota={0}
        cov={{ ratio: 0, status: "low", undated: { count: 0, amount: 0 } }}
        openPipe={0}
        actual={0}
        commit={0}
        acc={{ diff: 0, accurate: true }}
        overall={{ won: 0, lost: 0, closed: 0, rate: null }}
      />,
    );
    expect(hrefs("Define cuotas")).toEqual([QUOTAS]);
    expect(container.textContent).not.toMatch(ELSEWHERE);
  });
});

describe("CA-11 source guard: /metrics never points to another section with «abajo» / «más arriba»", () => {
  const root = join(process.cwd(), "src");
  const metricsDir = join(root, "components/metrics");
  const files = [
    "routes/_authenticated/metrics.tsx",
    "components/segment-coverage.tsx",
    "components/cac-panel.tsx",
    "components/budget-panel.tsx",
    "components/quarter-kpis-panel.tsx",
    "components/pipeline-board-panel.tsx",
    "components/won-deals-panel.tsx",
    ...readdirSync(metricsDir)
      .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
      .map((f) => `components/metrics/${f}`),
  ];
  it.each(files)("%s", (f) => {
    const lines = readFileSync(join(root, f), "utf8").split("\n");
    const bad = lines.filter((l) => ELSEWHERE.test(l) && !l.includes("Añade facturas abajo"));
    expect(bad).toEqual([]);
  });
});
