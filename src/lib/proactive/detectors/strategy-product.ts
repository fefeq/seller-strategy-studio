// F1 · Product and price rules: CA-18 repeated discount or free line, CA-20 active product never sold. No AI (CA-24).
// CA-19: price suggestions carry the cause prefix «price:», which only roles that may see prices read (see canViewStrategy).
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";
import { DAY, type Detector } from "../types";

export const MIN_REPEATS = 3;
export const PRICE_CAUSE_PREFIX = "price:";
export const UNSOLD_DAYS = 365;

export const productRepeatedDiscount: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  const deals = new Map(d.deals.map((x) => [x.id, x]));
  return d.products.flatMap((p) => {
    const lines = d.lines.filter((l) => l.product_id === p.id && deals.has(l.deal_id));
    const dealsOfProduct = new Set(lines.map((l) => l.deal_id));
    const groups = new Map<string, { label: string; ids: Set<string> }>();
    for (const l of lines) {
      const key = Number(l.unit_price) === 0 ? "free" : Number(l.discount_pct) > 0 ? `discount:${Number(l.discount_pct)}` : null;
      if (!key) continue;
      const g = groups.get(key) ?? { label: key === "free" ? "línea sin coste para el cliente" : `descuento del ${Number(l.discount_pct)} %`, ids: new Set() };
      g.ids.add(l.deal_id);
      groups.set(key, g);
    }
    return [...groups].filter(([, g]) => g.ids.size >= MIN_REPEATS).map(([key, g]) => buildStrategySuggestion({
      element: "product_price", kind: "change", action_type: "strategy_change", cause: `${PRICE_CAUSE_PREFIX}${key}:${p.id}`, priority: 3,
      title: `«${p.name}» se repite con ${g.label} en ${g.ids.size} deals`,
      body: `Un mismo ${g.label} en varios deals del producto indica que el precio o el catálogo quizá no reflejan lo que se vende. Revisa el precio o el catálogo.`,
      evidence: [{ table: "products", id: p.id, label: p.name }, ...[...g.ids].map((id) => ({ table: "deals", id, label: deals.get(id)!.name }))],
      sample_size: dealsOfProduct.size + 1, link: "/products",
    }));
  });
};

/** CA-20: an active product that no deal line used in the last year. Only judged once the product is a year old. */
export const productUnsold: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  const since = s.now.getTime() - UNSOLD_DAYS * DAY;
  const dealIds = new Set(d.deals.filter((x) => new Date(x.created_at).getTime() >= since).map((x) => x.id));
  const sold = new Set(d.lines.filter((l) => l.product_id && dealIds.has(l.deal_id)).map((l) => l.product_id));
  return d.products.filter((p) => p.active && !sold.has(p.id) && new Date(p.created_at).getTime() <= since).map((p) => buildStrategySuggestion({
    element: "product_price", kind: "validate", action_type: "strategy_change", cause: `catalog:unsold:${p.id}`, priority: 3,
    title: `«${p.name}» no aparece en ningún deal del último año`,
    body: `Es un producto activo sin ventas ni propuestas en 12 meses. Revisa si sigue a la venta.`,
    evidence: [{ table: "products", id: p.id, label: p.name }], sample_size: Math.max(1, dealIds.size), link: "/products",
  }));
};
