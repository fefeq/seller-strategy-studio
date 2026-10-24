// Finanzas (pure; tested in finance.test.ts). Ported from the Finance Dashboard engines (revenue-forecast,
// month-status, invoice-entry) and rebuilt on Nokko's own data: plans are the company's products, the
// sales-led part of the forecast is the weighted open pipeline, plan vs real reads the segment budgets and
// acquisition costs feed CAC. Nothing here does I/O.

export type MonthId = string; // YYYY-MM
export type CostCategory = "people" | "marketing" | "sales" | "tools" | "infra" | "cogs" | "other";
export const COST_CATEGORIES: Record<CostCategory, string> = {
  people: "Equipo", marketing: "Marketing", sales: "Ventas", tools: "Herramientas", infra: "Infraestructura", cogs: "Coste de servir", other: "Otros",
};
/** Acquisition (CAC) and cost to serve, as the rest of Nokko counts them. */
export const ACQUISITION: CostCategory[] = ["marketing", "sales"];
export const COST_TO_SERVE: CostCategory[] = ["cogs", "infra"];

export type CostLine = { name: string; category: string; amount: number; starts_on: string; ends_on: string | null; segment_id: string | null };
export type Plan = { id: string; name: string; price: number; billing: string };
export type PlanAssumption = { customers: number; adds: number; churn_pct: number; annual_share_pct: number };
export type OpenDeal = { amount: number | null; probability: number | null; close_date: string | null; stage: string };
export type Invoice = { amount: number; issued_on: string; due_on: string | null; paid_on: string | null };
export type MonthClose = { month: string; revenue: number | null; costs: number | null; cash_end: number | null; closed_at: string | null };
export type BudgetRow = { period: string; plan_revenue: number | null; plan_cost_to_serve: number | null; plan_acquisition: number | null };

const r2 = (n: number) => Math.round(n * 100) / 100;

export const isMonthId = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export function monthOf(d: string | Date): MonthId {
  if (typeof d === "string" && /^\d{4}-\d{2}/.test(d)) return d.slice(0, 7);
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function addMonths(m: MonthId, n: number): MonthId {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export const monthRange = (start: MonthId, n: number) => Array.from({ length: n }, (_, i) => addMonths(start, i));
export function quarterMonths(q: string): MonthId[] {
  const [y, k] = q.split("-Q");
  return monthRange(`${y}-${String((Number(k) - 1) * 3 + 1).padStart(2, "0")}`, 3);
}
export const quarterOfMonth = (m: MonthId) => `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`;
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const monthLabel = (m: MonthId) => `${MONTHS_ES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

/** A cost line counts in every month from its start to its end (inclusive). */
export function monthlyCost(lines: CostLine[], m: MonthId, only?: CostCategory[]) {
  let total = 0;
  const byCategory: Partial<Record<CostCategory, number>> = {};
  for (const l of lines) {
    if (monthOf(l.starts_on) > m || (l.ends_on && monthOf(l.ends_on) < m)) continue;
    const cat = (l.category in COST_CATEGORIES ? l.category : "other") as CostCategory;
    if (only && !only.includes(cat)) continue;
    total += Number(l.amount) || 0;
    byCategory[cat] = (byCategory[cat] ?? 0) + (Number(l.amount) || 0);
  }
  return { total: r2(total), byCategory };
}

/** Monthly price of a plan: annual plans spread over twelve months; one-off products are not recurring. */
export const monthlyPrice = (p: Plan) => (p.billing === "annual" ? p.price / 12 : p.billing === "monthly" ? p.price : 0);
export const recurringPlans = (plans: Plan[]) => plans.filter((p) => monthlyPrice(p) > 0);

export type PlanRow = { month: MonthId; customers: number; revenue: number; cash: number };
type Factor = { adds: number; churn: number };

/**
 * The plan model (one row per month). Monthly customers pay every month; annual ones (the annual share of a
 * monthly plan, or every customer of an annual plan) earn a twelfth a month. Cash: a new annual customer pays
 * twelve months when signing (with the annual discount on monthly plans); the annual base renews spread over the year.
 */
export function projectPlans(plans: Plan[], assumptions: Record<string, PlanAssumption | undefined>, start: MonthId, horizon: number, discountPct: number, f: Factor = { adds: 1, churn: 1 }): PlanRow[] {
  const rows = monthRange(start, horizon).map((month) => ({ month, customers: 0, revenue: 0, cash: 0 }));
  for (const p of recurringPlans(plans)) {
    const a = assumptions[p.id];
    if (!a) continue;
    const price = monthlyPrice(p);
    const share = p.billing === "annual" ? 1 : Math.min(1, Math.max(0, a.annual_share_pct / 100));
    const annualPrice = p.billing === "annual" ? price : price * (1 - discountPct / 100);
    const churn = Math.min(1, Math.max(0, (a.churn_pct / 100) * f.churn));
    const adds = Math.max(0, a.adds * f.adds);
    let monthly = a.customers * (1 - share);
    let annual = a.customers * share;
    rows.forEach((row, i) => {
      if (i > 0) { monthly = monthly * (1 - churn) + adds * (1 - share); annual = annual * (1 - churn) + adds * share; }
      const newAnnual = i > 0 ? adds * share : 0;
      row.customers += monthly + annual;
      row.revenue += monthly * price + annual * annualPrice;
      row.cash += monthly * price + annual * annualPrice + newAnnual * annualPrice * 11;
    });
  }
  return rows.map((r) => ({ month: r.month, customers: Math.round(r.customers), revenue: r2(r.revenue), cash: r2(r.cash) }));
}

/** Sales-led part: each open deal adds its ACV/12 × probability from its close month on. Deals without date or amount are left out (counted). */
export function pipelineMrr(deals: OpenDeal[], start: MonthId, horizon: number, factor = 1) {
  const months = monthRange(start, horizon);
  const mrr = months.map(() => 0);
  let undated = 0;
  for (const d of deals) {
    if (d.stage === "won" || d.stage === "lost") continue;
    if (!d.close_date || !d.amount) { if (d.amount) undated++; continue; }
    const from = Math.max(0, months.indexOf(monthOf(d.close_date)) === -1 ? (monthOf(d.close_date) < start ? 0 : horizon) : months.indexOf(monthOf(d.close_date)));
    const v = (Number(d.amount) / 12) * ((d.probability ?? 0) / 100) * factor;
    for (let i = from; i < horizon; i++) mrr[i] += v;
  }
  return { mrr: mrr.map(r2), undated };
}

export type ForecastInput = {
  plans: Plan[]; assumptions: Record<string, PlanAssumption | undefined>; discountPct: number;
  deals: OpenDeal[]; includePipeline: boolean; lines: CostLine[];
  openingCash: number; start: MonthId; horizon: number; spreadPct: number;
};
export type ForecastMonth = { month: MonthId; revenue: number; plans: number; pipeline: number; costs: number; net: number; cash: { low: number; base: number; high: number } };

/** Revenue, costs and cash month by month, with a low/high band (adds, churn and pipeline moved by the spread). */
export function forecast(i: ForecastInput) {
  const s = Math.min(0.9, Math.max(0, i.spreadPct / 100));
  const run = (f: Factor, pipeF: number) => {
    const plans = projectPlans(i.plans, i.assumptions, i.start, i.horizon, i.discountPct, f);
    const pipe = i.includePipeline ? pipelineMrr(i.deals, i.start, i.horizon, pipeF) : { mrr: plans.map(() => 0), undated: 0 };
    return { plans, pipe };
  };
  const base = run({ adds: 1, churn: 1 }, 1);
  const low = run({ adds: 1 - s, churn: 1 + s }, 1 - s);
  const high = run({ adds: 1 + s, churn: 1 - s }, 1 + s);
  const cash = { low: i.openingCash, base: i.openingCash, high: i.openingCash };
  const months: ForecastMonth[] = base.plans.map((p, k) => {
    const costs = monthlyCost(i.lines, p.month).total;
    cash.base += p.cash + base.pipe.mrr[k] - costs;
    cash.low += low.plans[k].cash + low.pipe.mrr[k] - costs;
    cash.high += high.plans[k].cash + high.pipe.mrr[k] - costs;
    const revenue = r2(p.revenue + base.pipe.mrr[k]);
    return { month: p.month, revenue, plans: p.revenue, pipeline: base.pipe.mrr[k], costs, net: r2(revenue - costs), cash: { low: r2(cash.low), base: r2(cash.base), high: r2(cash.high) } };
  });
  const runway = (key: "low" | "base" | "high") => { const k = months.findIndex((m) => m.cash[key] < 0); return k === -1 ? null : k; };
  return {
    months,
    undated: base.pipe.undated,
    runway: { low: runway("low"), base: runway("base"), high: runway("high") },
    summary: {
      mrrStart: months[0]?.revenue ?? 0,
      mrrEnd: months[months.length - 1]?.revenue ?? 0,
      burnStart: months[0] ? r2(months[0].costs - months[0].revenue) : 0,
      cashEnd: months[months.length - 1]?.cash.base ?? i.openingCash,
    },
  };
}

/** Months of cash at the current burn; null when the company does not burn. */
export function runwayMonths(cash: number, burn: number): number | null {
  if (burn <= 0) return null;
  return Math.max(0, Math.floor(cash / burn));
}

export type AgingBucket = "current" | "d30" | "d60" | "d90" | "over90";
export const AGING_LABEL: Record<AgingBucket, string> = { current: "Sin vencer", d30: "1–30 días", d60: "31–60 días", d90: "61–90 días", over90: "Más de 90 días" };
const DAY = 86_400_000;
const dayOf = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

/** Unpaid invoices by days overdue (a missing due date counts as 30 days after issue). */
export function arAging(invoices: Invoice[], today: string) {
  const buckets: Record<AgingBucket, { count: number; amount: number }> = { current: { count: 0, amount: 0 }, d30: { count: 0, amount: 0 }, d60: { count: 0, amount: 0 }, d90: { count: 0, amount: 0 }, over90: { count: 0, amount: 0 } };
  let open = 0;
  for (const inv of invoices) {
    if (inv.paid_on) continue;
    const due = inv.due_on ? dayOf(inv.due_on) : dayOf(inv.issued_on) + 30 * DAY;
    const late = Math.floor((dayOf(today) - due) / DAY);
    const b: AgingBucket = late <= 0 ? "current" : late <= 30 ? "d30" : late <= 60 ? "d60" : late <= 90 ? "d90" : "over90";
    buckets[b].count++; buckets[b].amount = r2(buckets[b].amount + Number(inv.amount));
    open = r2(open + Number(inv.amount));
  }
  return { buckets, open, overdue: r2(open - buckets.current.amount) };
}

export type MonthStatus = "closed" | "open" | "projected";
export function monthStatus(m: MonthId, closes: MonthClose[], today: MonthId): MonthStatus {
  if (closes.some((c) => c.month === m && c.closed_at)) return "closed";
  return m > today ? "projected" : "open";
}

/** Real figures of a month: a closed month uses what was closed; otherwise invoices issued and the active cost lines. */
export function actualMonth(m: MonthId, invoices: Invoice[], closes: MonthClose[], lines: CostLine[]) {
  const c = closes.find((x) => x.month === m && x.closed_at);
  const invoiced = r2(invoices.filter((x) => monthOf(x.issued_on) === m).reduce((s, x) => s + Number(x.amount), 0));
  const collected = r2(invoices.filter((x) => x.paid_on && monthOf(x.paid_on) === m).reduce((s, x) => s + Number(x.amount), 0));
  const cost = monthlyCost(lines, m);
  return {
    revenue: c?.revenue != null ? Number(c.revenue) : invoiced,
    costs: c?.costs != null ? Number(c.costs) : cost.total,
    collected,
    acquisition: monthlyCost(lines, m, ACQUISITION).total,
    costToServe: monthlyCost(lines, m, COST_TO_SERVE).total,
    source: c ? ("closed" as const) : ("live" as const),
  };
}

export type Variance = { key: "revenue" | "cost_to_serve" | "acquisition" | "margin"; label: string; plan: number; actual: number; diff: number; good: boolean };

/** Quarter plan (segment budgets) against real (invoices or closed months, cost lines by category). */
export function planVsActual(quarter: string, budgets: BudgetRow[], invoices: Invoice[], closes: MonthClose[], lines: CostLine[]): { rows: Variance[]; hasPlan: boolean } {
  const b = budgets.filter((x) => x.period === quarter);
  const sum = (k: keyof BudgetRow) => r2(b.reduce((s, x) => s + (Number(x[k]) || 0), 0));
  const plan = { revenue: sum("plan_revenue"), cost_to_serve: sum("plan_cost_to_serve"), acquisition: sum("plan_acquisition") };
  const months = quarterMonths(quarter).map((m) => actualMonth(m, invoices, closes, lines));
  const actual = {
    revenue: r2(months.reduce((s, m) => s + m.revenue, 0)),
    cost_to_serve: r2(months.reduce((s, m) => s + m.costToServe, 0)),
    acquisition: r2(months.reduce((s, m) => s + m.acquisition, 0)),
  };
  const row = (key: Variance["key"], label: string, p: number, a: number, moreIsGood: boolean): Variance => ({ key, label, plan: p, actual: a, diff: r2(a - p), good: moreIsGood ? a >= p : a <= p });
  return {
    hasPlan: b.length > 0,
    rows: [
      row("revenue", "Ingresos", plan.revenue, actual.revenue, true),
      row("cost_to_serve", "Coste de servir", plan.cost_to_serve, actual.cost_to_serve, false),
      row("acquisition", "Captación", plan.acquisition, actual.acquisition, false),
      row("margin", "Margen tras captación", r2(plan.revenue - plan.cost_to_serve - plan.acquisition), r2(actual.revenue - actual.cost_to_serve - actual.acquisition), true),
    ],
  };
}

export const CAC_CHANNEL: Partial<Record<CostCategory, string>> = { marketing: "Finanzas · Marketing", sales: "Finanzas · Ventas" };

/** Acquisition cost lines of a quarter as CAC rows (channel × segment or shared), ready to upsert into cac_costs. */
export function cacRowsFor(lines: CostLine[], quarter: string) {
  const out = new Map<string, { segment_id: string | null; channel: string; amount: number }>();
  for (const m of quarterMonths(quarter)) for (const cat of ACQUISITION) {
    for (const l of lines.filter((x) => x.category === cat)) {
      const v = monthlyCost([l], m).total;
      if (!v) continue;
      const k = `${l.segment_id ?? ""}|${cat}`;
      const cur = out.get(k) ?? { segment_id: l.segment_id, channel: CAC_CHANNEL[cat]!, amount: 0 };
      cur.amount = r2(cur.amount + v);
      out.set(k, cur);
    }
  }
  return [...out.values()];
}

/** Cost-to-serve lines tied to a segment, summed for the quarter (real cost to serve in the segment budget). */
export function costToServeFor(lines: CostLine[], quarter: string) {
  const out = new Map<string, number>();
  for (const m of quarterMonths(quarter)) for (const l of lines) {
    if (!l.segment_id || !COST_TO_SERVE.includes(l.category as CostCategory)) continue;
    out.set(l.segment_id, r2((out.get(l.segment_id) ?? 0) + monthlyCost([l], m).total));
  }
  return [...out.entries()].map(([segment_id, amount]) => ({ segment_id, amount }));
}

/** Headline of the Finanzas screen: a conclusion from the data, the section name when there is none. */
export function financeHeadline(x: { configured: boolean; burn: number; runway: number | null; cash: number }, money: (n: number) => string): string {
  if (!x.configured) return "Finanzas";
  if (x.burn <= 0) return `Generas caja: ${money(-x.burn)} al mes`;
  if (x.runway == null) return "Finanzas";
  return x.runway === 0 ? "Sin caja al ritmo actual de gasto" : `Caja para ${x.runway} ${x.runway === 1 ? "mes" : "meses"} al ritmo actual`;
}
