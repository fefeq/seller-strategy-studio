// Products and deal lines. Pure so the deal sheet, the catalogue and Métricas compute amount and
// margin exactly like the database trigger deal_lines_sync: amount = Σ quantity × price × (1 − discount),
// yearly (a monthly line counts twelve times); margin = amount − Σ quantity × cost, unknown if any line
// has no cost.

export type Billing = "monthly" | "annual" | "one_off";

export const BILLING_LABELS: Record<Billing, string> = { monthly: "Mensual", annual: "Anual", one_off: "Pago único" };
/** «/mes», «/año», «» to read next to a price. */
export const BILLING_SUFFIX: Record<Billing, string> = { monthly: "/mes", annual: "/año", one_off: "" };

export type Product = {
  id: string;
  name: string;
  description?: string;
  sku?: string | null;
  price: number | string;
  cost: number | string | null;
  billing: Billing | string;
  active: boolean;
};

export type DealLine = {
  id?: string;
  product_id?: string | null;
  name: string;
  quantity: number | string;
  unit_price: number | string;
  unit_cost: number | string | null;
  discount_pct: number | string;
  billing: Billing | string;
};

const n = (v: number | string | null | undefined) => (v == null || v === "" ? 0 : Number(v) || 0);
const periods = (b: string) => (b === "monthly" ? 12 : 1);
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Yearly revenue of one line (ACV contribution). */
export const lineRevenue = (l: DealLine) => n(l.quantity) * n(l.unit_price) * (1 - Math.min(100, Math.max(0, n(l.discount_pct))) / 100) * periods(String(l.billing));
/** Yearly cost of one line, or null when its cost is unknown. */
export const lineCost = (l: DealLine) => (l.unit_cost == null || l.unit_cost === "" ? null : n(l.quantity) * n(l.unit_cost) * periods(String(l.billing)));

export type DealTotals = { amount: number; cost: number | null; margin: number | null; marginPct: number | null; unknownCost: number };

export function dealTotals(lines: DealLine[]): DealTotals {
  const amount = round2(lines.reduce((s, l) => s + lineRevenue(l), 0));
  const costs = lines.map(lineCost);
  const unknownCost = costs.filter((c) => c == null).length;
  const cost = unknownCost ? null : round2(costs.reduce((s: number, c) => s + (c ?? 0), 0));
  const margin = cost == null ? null : round2(amount - cost);
  return { amount, cost, margin, marginPct: margin != null && amount > 0 ? (margin / amount) * 100 : null, unknownCost };
}

/** A new line from a catalogue product: its name, price, cost and billing copied as they are today. */
export function lineFromProduct(p: Product, quantity = 1): DealLine {
  return { product_id: p.id, name: p.name, quantity, unit_price: n(p.price), unit_cost: p.cost == null || p.cost === "" ? null : n(p.cost), discount_pct: 0, billing: p.billing as Billing };
}

/** Margin % of a product at list price, or null without cost. */
export const productMarginPct = (p: Product) => (p.cost == null || p.cost === "" || n(p.price) <= 0 ? null : ((n(p.price) - n(p.cost)) / n(p.price)) * 100);

/** Why a line or product value can't be saved, or null. */
export function checkLineField(field: "quantity" | "unit_price" | "unit_cost" | "discount_pct" | "price" | "cost", raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const label = { quantity: "Cantidad", unit_price: "Precio", unit_cost: "Coste", discount_pct: "Descuento", price: "Precio", cost: "Coste" }[field];
  const text = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (text === "") return field === "unit_cost" || field === "cost" ? { ok: true, value: null } : { ok: false, error: `«${label}» no puede quedar vacío.` };
  const v = Number(text);
  if (!Number.isFinite(v)) return { ok: false, error: `«${label}» tiene que ser un número.` };
  if (field === "quantity" && v <= 0) return { ok: false, error: "La cantidad tiene que ser mayor que 0." };
  if (v < 0) return { ok: false, error: `«${label}» no puede ser negativo.` };
  if (field === "discount_pct" && v > 100) return { ok: false, error: "El descuento tiene que estar entre 0 y 100 %." };
  return { ok: true, value: v };
}

export type MarginDeal = { stage: string; amount: number | string | null; gross_margin: number | string | null; segment_id: string | null; closed_at?: string | null; updated_at?: string };

/**
 * Gross margin % of the deals won with lines and known cost, overall and per segment, optionally only
 * those closed before `until` (a period's end). Weighted by amount: Σ margin / Σ amount.
 */
export function wonDealsMargin(deals: MarginDeal[], until?: Date): { all: { pct: number; deals: number } | null; bySegment: Record<string, { pct: number; deals: number }> } {
  const won = deals.filter((d) => d.stage === "won" && d.gross_margin != null && n(d.amount) > 0 && (!until || new Date(d.closed_at ?? d.updated_at ?? 0) < until));
  const agg = (list: MarginDeal[]) => {
    const amount = list.reduce((s, d) => s + n(d.amount), 0);
    return list.length && amount > 0 ? { pct: (list.reduce((s, d) => s + n(d.gross_margin), 0) / amount) * 100, deals: list.length } : null;
  };
  const bySegment: Record<string, { pct: number; deals: number }> = {};
  for (const seg of new Set(won.map((d) => d.segment_id).filter((x): x is string => !!x))) {
    const m = agg(won.filter((d) => d.segment_id === seg));
    if (m) bySegment[seg] = m;
  }
  return { all: agg(won), bySegment };
}
