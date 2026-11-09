// SDD-20261109-metrics-strategy-no-estimates · U-0: the fictional fixture of NK-0068's freeze net
// (src/lib/strategy-freeze.test.ts), moved here unchanged so the coherence test, the MCP test and the unit tests
// share it, plus the cases this SDD adds (exported apart so the original arrays never change). Fictional data only.
import { quarterRange } from "@/lib/metrics";
import type { DealLike, SegLike } from "@/lib/segment-coverage";
import type { QuarterBudgetLike } from "@/lib/segment-budget";

// ---------- fixture of NK-0068 (unchanged) ----------
export const NOW = new Date("2026-11-15T12:00:00Z");
export const Q = "2026-Q4";
export const RANGE = quarterRange(Q);

export type Seg = SegLike & { acquisition_motion: string | null; org_id: string };
export const seg = (o: Partial<Seg> & { id: string; name: string }): Seg => ({
  acv_min: null,
  acv_max: null,
  win_rate_target: null,
  cac_target: null,
  gross_margin_pct: null,
  payback_months: null,
  acquisition_motion: null,
  org_id: "o1",
  ...o,
});
export const SEGMENTS: Seg[] = [
  // margin missing (payback at 100 %), deals assigned by amount and to a deleted segment land here
  seg({
    id: "s-pyme",
    name: "Pyme",
    acv_min: 5000,
    acv_max: 20000,
    win_rate_target: 25,
    cac_target: 3000,
    payback_months: 12,
    acquisition_motion: "slg",
  }),
  // no max and no deals: ACV = minimum × 1.5
  seg({
    id: "s-mid",
    name: "Mid",
    acv_min: 20000,
    acv_max: null,
    gross_margin_pct: 80,
    cac_target: 9000,
    payback_months: 18,
    acquisition_motion: "plg",
  }),
  // no range and no deals: ACV 0
  seg({ id: "s-vacio", name: "Sin rango", gross_margin_pct: 70, cac_target: 5000 }),
  // negative margin with real CAC
  seg({
    id: "s-neg",
    name: "Negativo",
    acv_min: 300000,
    acv_max: 400000,
    gross_margin_pct: -10,
    payback_months: 24,
    acquisition_motion: "slg",
  }),
  // zero margin with real CAC
  seg({
    id: "s-cero",
    name: "Cero",
    acv_min: 500000,
    acv_max: 600000,
    gross_margin_pct: 0,
    payback_months: 24,
  }),
  // only open deals with amount: ACV from open deals
  seg({
    id: "s-abiertos",
    name: "Abiertos",
    acv_min: 100000,
    acv_max: 200000,
    gross_margin_pct: 70,
    cac_target: 20000,
    payback_months: 18,
  }),
  // range midpoint (no deals at all)
  seg({
    id: "s-medio",
    name: "Medio",
    acv_min: 1000,
    acv_max: 3000,
    win_rate_target: 30,
    cac_target: 500,
    gross_margin_pct: 60,
    payback_months: 6,
  }),
];

export type Deal = DealLike & { gross_margin: number | null; org_id: string };
export const deal = (o: Partial<Deal>): Deal => ({
  segment_id: null,
  amount: null,
  stage: "discovery",
  close_date: null,
  closed_at: null,
  updated_at: "2026-10-02T10:00:00Z",
  created_at: "2026-10-01T10:00:00Z",
  gross_margin: null,
  org_id: "o1",
  ...o,
});
export const DEALS: Deal[] = [
  // won, no segment: assigned by amount to Pyme
  deal({ amount: 10000, stage: "won", closed_at: "2026-10-20T10:00:00Z", gross_margin: 6000 }),
  // won, explicit Pyme
  deal({
    segment_id: "s-pyme",
    amount: 12000,
    stage: "won",
    closed_at: "2026-11-02T10:00:00Z",
    created_at: "2026-08-01T10:00:00Z",
  }),
  // lost, pointing to a deleted segment: assigned by amount to Pyme
  deal({ segment_id: "s-borrado", amount: 8000, stage: "lost", closed_at: "2026-11-05T10:00:00Z" }),
  // won without closed_at: updated_at decides the quarter
  deal({
    segment_id: "s-pyme",
    amount: 9000,
    stage: "won",
    updated_at: "2026-10-28T10:00:00Z",
    created_at: "2026-09-10T10:00:00Z",
  }),
  // open Pyme deal closing in the quarter
  deal({ segment_id: "s-pyme", amount: 15000, stage: "proposal", close_date: "2026-12-10" }),
  // negative margin segment: won in the quarter
  deal({
    segment_id: "s-neg",
    amount: 350000,
    stage: "won",
    closed_at: "2026-10-15T10:00:00Z",
    gross_margin: -35000,
  }),
  // zero margin segment: won in the quarter
  deal({ segment_id: "s-cero", amount: 550000, stage: "won", closed_at: "2026-12-01T10:00:00Z" }),
  // open deals only (ACV from open deals)
  deal({ segment_id: "s-abiertos", amount: 150000, stage: "demo", close_date: "2026-12-20" }),
  deal({ segment_id: "s-abiertos", amount: 0, stage: "lost", closed_at: "2026-11-10T10:00:00Z" }),
  // open without amount and without segment: no segment at all
  deal({ stage: "discovery", close_date: "2026-11-30" }),
  // old won deal (2025): outside the quarter, inside the 365-day window
  deal({
    segment_id: "s-pyme",
    amount: 7000,
    stage: "won",
    closed_at: "2025-12-15T10:00:00Z",
    created_at: "2025-10-01T10:00:00Z",
  }),
  // very old lost deal: outside the 365-day window
  deal({
    amount: 6000,
    stage: "lost",
    closed_at: "2024-03-01T10:00:00Z",
    created_at: "2024-01-01T10:00:00Z",
  }),
];

export type Cost = {
  segment_id: string | null;
  channel: string;
  amount: number;
  period: string;
  org_id: string;
};
export const COSTS: Cost[] = [
  { segment_id: null, channel: "Paid media", amount: 9000, period: "2026-Q4", org_id: "o1" },
  {
    segment_id: "s-pyme",
    channel: "Outbound / SDR",
    amount: 3000,
    period: "2026-Q4",
    org_id: "o1",
  },
  { segment_id: "s-neg", channel: "Eventos", amount: 10000, period: "2026-Q4", org_id: "o1" },
  { segment_id: "s-cero", channel: "Eventos", amount: 5000, period: "2026-Q4", org_id: "o1" },
  // Q3: shared cost and nobody won → split equally
  { segment_id: null, channel: "Contenido y SEO", amount: 4200, period: "2026-Q3", org_id: "o1" },
];

export const bq = (
  o: Partial<QuarterBudgetLike> & { segment_id: string; period: string },
): QuarterBudgetLike & { org_id: string } => ({
  plan_revenue: null,
  plan_cost_to_serve: null,
  plan_acquisition: null,
  plan_new_customers: null,
  actual_revenue: null,
  actual_cost_to_serve: null,
  org_id: "o1",
  ...o,
});
export const BUDGET_ROWS = [
  bq({
    segment_id: "s-pyme",
    period: "2026-Q4",
    plan_revenue: 50000,
    plan_acquisition: 6000,
    plan_new_customers: 3,
  }),
  bq({
    segment_id: "s-neg",
    period: "2026-Q4",
    plan_revenue: 300000,
    plan_cost_to_serve: 330000,
    plan_acquisition: 12000,
    plan_new_customers: 1,
    actual_revenue: 350000,
    actual_cost_to_serve: 385000,
  }),
  bq({ segment_id: "s-cero", period: "2026-Q4", plan_acquisition: 5000, plan_new_customers: 1 }),
  bq({
    segment_id: "s-mid",
    period: "2026-Q3",
    plan_revenue: 40000,
    plan_cost_to_serve: 8000,
    plan_acquisition: 9000,
    plan_new_customers: 2,
  }),
];
export const TARGETS = { "s-pyme": 60000, "s-mid": 30000, "s-neg": 400000, "s-medio": 6000 };
export const YEAR_QUARTERS = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];

// ---------- cases added by SDD-20261109-metrics-strategy-no-estimates (U-0) ----------
// Already in DEALS: a won deal with product lines (gross_margin 6000 of 10000) assigned to Pyme, whose budget has
// no real margin (Pyme's Q4 row has plan revenue only): M1 takes the 60 % of the deal, M2 did not.
/** A won deal without segment and without amount: no range can place it, so it lands in no segment (D11). */
export const UNSEGMENTED_WON: Deal = deal({
  amount: null,
  stage: "won",
  closed_at: "2026-11-20T10:00:00Z",
  created_at: "2026-10-10T10:00:00Z",
});
/** The fixture deals plus the unsegmented won deal. */
export const EXT_DEALS: Deal[] = [...DEALS, UNSEGMENTED_WON];
/** Shared cost and nobody won: COSTS of 2026-Q3 (4200 shared, no deal won in Q3). */
export const Q3 = "2026-Q3";
/** acv_min 0 without a maximum and without deals (D3: no ACV, never 0 × 1.5). */
export const SEG_MIN0_NO_MAX: Seg = seg({
  id: "s-min0",
  name: "Desde cero",
  acv_min: 0,
  acv_max: null,
  gross_margin_pct: 50,
  payback_months: 12,
});
/** A company without segments: the KPI and the board still give one company CAC. */
export const NO_SEGMENTS: Seg[] = [];
/** An ACV typed in the calculator, different from Pyme's real ACV (D14a: it must not move the real payback). */
export const CALC_ACV = 50000;

// ---------- fake Supabase client over the fixture (MCP handlers and loaders) ----------
export const TABLES: Record<string, Record<string, unknown>[]> = {
  segments: SEGMENTS,
  deals: EXT_DEALS,
  segment_targets: Object.entries(TARGETS).map(([segment_id, amount]) => ({
    segment_id,
    amount,
    period: Q,
    org_id: "o1",
  })),
  cac_costs: COSTS,
  segment_budget_quarters: BUDGET_ROWS,
};

type Filter = (r: Record<string, unknown>) => boolean;
/** Records every table read, so a test can prove that nothing was read. */
export type ReadLog = string[];
function fakeQuery(table: string, log: ReadLog, filters: Filter[] = []): unknown {
  const rows = () => (TABLES[table] ?? []).filter((r) => filters.every((f) => f(r)));
  const next = (f?: Filter) => fakeQuery(table, log, f ? [...filters, f] : filters);
  return {
    select: () => next(),
    order: () => next(),
    eq: (col: string, val: unknown) => next((r) => r[col] === val),
    in: (col: string, vals: unknown[]) => next((r) => vals.includes(r[col])),
    then: (f: (v: { data: unknown; error: null }) => unknown) => {
      log.push(table);
      return Promise.resolve({ data: rows(), error: null }).then(f);
    },
  };
}

/** The ToolCtx a fake mcpCtx returns: fixture db, company o1, the given roles. */
export function fixtureCtx(roles: string[], log: ReadLog = []) {
  return {
    db: { from: (t: string) => fakeQuery(t, log) },
    orgId: "o1",
    userId: "u1",
    roles,
    currency: "EUR",
    orgName: "Empresa Ficticia",
  };
}
