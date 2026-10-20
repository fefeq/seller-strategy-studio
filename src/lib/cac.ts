// Real CAC per segment and quarter from entered acquisition costs. Pure so the dashboard, MCP and tests agree.

export const CAC_CHANNELS = ["Paid media", "Eventos", "Outbound / SDR", "Contenido y SEO", "Partners", "Equipo comercial", "Herramientas", "Otros"];

export type CostLike = { segment_id: string | null; channel: string; amount: number | string };

export type SegmentCac = {
  /** Costs entered directly for the segment. */
  direct: number;
  /** Share of shared (no-segment) costs assigned to the segment. */
  shared: number;
  cost: number;
  customers: number;
  /** cost / new customers; null without customers or without costs. */
  cac: number | null;
};

/**
 * Shared costs (segment_id null) are split by each segment's share of new customers in the quarter;
 * when nobody was won, they are split equally so the cost is never lost.
 */
export function segmentCac(costs: CostLike[], customersBySegment: Record<string, number>, segmentIds: string[]): Record<string, SegmentCac> {
  const sharedTotal = costs.filter((c) => !c.segment_id).reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalCustomers = segmentIds.reduce((s, id) => s + (customersBySegment[id] ?? 0), 0);
  const out: Record<string, SegmentCac> = {};
  for (const id of segmentIds) {
    const direct = costs.filter((c) => c.segment_id === id).reduce((s, c) => s + Number(c.amount || 0), 0);
    const customers = customersBySegment[id] ?? 0;
    const shared = !segmentIds.length ? 0 : totalCustomers ? sharedTotal * (customers / totalCustomers) : sharedTotal / segmentIds.length;
    const cost = direct + shared;
    out[id] = { direct, shared, cost, customers, cac: customers > 0 && cost > 0 ? cost / customers : null };
  }
  return out;
}

/** Cost per channel (all segments + shared), largest first, with its share of the total. */
export function costByChannel(costs: CostLike[]) {
  const map = new Map<string, number>();
  for (const c of costs) map.set(c.channel, (map.get(c.channel) ?? 0) + Number(c.amount || 0));
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()].filter(([, v]) => v > 0).map(([channel, amount]) => ({ channel, amount, share: total ? amount / total : 0 })).sort((a, b) => b.amount - a.amount);
}

/** Previous quarter label: 2026-Q1 → 2025-Q4. */
export function previousQuarter(q: string) {
  const [y, n] = q.split("-Q").map(Number);
  return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`;
}

/** The given quarter and the previous n-1, oldest first (for left-to-right tables). */
export function quartersUpTo(q: string, n = 4) {
  const out = [q];
  while (out.length < n) out.unshift(previousQuarter(out[0]));
  return out;
}

/** Channel × quarter totals (all segments), with the shared (common) part of each quarter kept apart. */
export function channelQuarterTable(costs: (CostLike & { period: string })[], quarters: string[]) {
  const inQ = costs.filter((c) => quarters.includes(c.period));
  const sum = (xs: typeof inQ) => xs.reduce((s, c) => s + Number(c.amount || 0), 0);
  const channels = [...new Set(inQ.map((c) => c.channel))];
  const rows = channels
    .map((channel) => {
      const byQuarter = Object.fromEntries(quarters.map((q) => [q, sum(inQ.filter((c) => c.channel === channel && c.period === q))]));
      return { channel, byQuarter, total: Object.values(byQuarter).reduce((s, v) => s + v, 0) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const total = Object.fromEntries(quarters.map((q) => [q, sum(inQ.filter((c) => c.period === q))]));
  const shared = Object.fromEntries(quarters.map((q) => [q, sum(inQ.filter((c) => c.period === q && !c.segment_id))]));
  return { rows, total, shared };
}
