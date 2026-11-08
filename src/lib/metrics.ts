export type Motion = "plg" | "inside" | "field" | "strategic";

type Range = [number, number | null];

/** Market reference per motion (Tunguz guide, amounts in USD). Used when no company segment covers an ACV. */
export const MOTIONS: Record<
  Motion,
  {
    label: string;
    cycle: string;
    team: string;
    cac: Range;
    payback: string;
    efficiency: string;
    quota: Range | null;
  }
> = {
  plg: {
    label: "Product-led / self-service",
    cycle: "Días a semanas",
    team: "Equipo mínimo: conversión y expansión",
    cac: [100, 500],
    payback: "3–6 meses",
    efficiency: "Tasas de conversión",
    quota: null,
  },
  inside: {
    label: "Inside sales",
    cycle: "1–3 meses",
    team: "2–3 SDR por AE",
    cac: [5000, 15000],
    payback: "6–12 meses",
    efficiency: "Cumplimiento de cuota",
    quota: [500000, 1000000],
  },
  field: {
    label: "Field sales",
    cycle: "3–6 meses",
    team: "1 SE por cada 2–3 AE",
    cac: [25000, 100000],
    payback: "12–24 meses",
    efficiency: "Win rate y tamaño de deal",
    quota: [1000000, 3000000],
  },
  strategic: {
    label: "Field sales + partners",
    cycle: "6–12+ meses",
    team: "AE + SE + partners / integradores",
    cac: [100000, null],
    payback: "24+ meses",
    efficiency: "Win rate, tamaño de deal y expansión",
    quota: null,
  },
};

/** Recommended GTM motion by annual contract value (USD). <5K PLG, 5K–50K inside, 50K–250K field, >250K strategic. */
export function recommendMotion(acv: number): Motion {
  if (acv < 5000) return "plg";
  if (acv < 50000) return "inside";
  if (acv <= 250000) return "field";
  return "strategic";
}

/**
 * Company segment covering an ACV: acv_min <= ACV <= acv_max (empty max = no upper limit, empty min = 0).
 * When two segments share a boundary, the one with the higher minimum wins.
 */
export function matchSegment<T extends { acv_min: number | null; acv_max: number | null }>(
  acv: number,
  segments: T[],
): T | undefined {
  return segments
    .filter((s) => acv >= Number(s.acv_min ?? 0) && (s.acv_max == null || acv <= Number(s.acv_max)))
    .sort((a, b) => Number(b.acv_min ?? 0) - Number(a.acv_min ?? 0))[0];
}

/**
 * Capacity per AE from the segment benchmarks:
 * deals/year = annual AE quota / ACV; opportunities/year = deals / win rate;
 * CAC payback (months) = CAC / (ACV × gross margin / 12). Missing inputs yield null.
 * Without a margin the payback assumes 100 % (`marginAssumed`); a margin of 0 % or below gives Infinity or a
 * negative payback (`marginNonPositive`). The flags only label the value, they never change it.
 */
export function capacityPlan(p: {
  acv: number;
  quota?: number | null;
  winRatePct?: number | null;
  cac?: number | null;
  grossMarginPct?: number | null;
}) {
  const acv = p.acv > 0 ? p.acv : 0;
  const dealsPerYear = acv && p.quota ? p.quota / acv : null;
  const oppsPerYear =
    dealsPerYear != null && p.winRatePct ? dealsPerYear / (p.winRatePct / 100) : null;
  const margin = (p.grossMarginPct ?? 100) / 100;
  const paybackMonths = acv && p.cac ? p.cac / ((acv * margin) / 12) : null;
  return {
    dealsPerYear,
    oppsPerYear,
    oppsPerMonth: oppsPerYear != null ? oppsPerYear / 12 : null,
    paybackMonths,
    marginAssumed: p.grossMarginPct == null,
    marginNonPositive: p.grossMarginPct != null && p.grossMarginPct <= 0,
  };
}

/** Pipeline coverage = open pipeline / quota. Healthy band is 3x–4x. */
export function coverage(openPipeline: number, quota: number) {
  const ratio = quota > 0 ? openPipeline / quota : 0;
  const status: "low" | "healthy" | "high" = ratio < 3 ? "low" : ratio <= 4 ? "healthy" : "high";
  return { ratio, status };
}

export function winRate(won: number, lost: number) {
  const total = won + lost;
  return total ? won / total : 0;
}

/** Forecast accuracy: actual within 10% of commit is considered accurate. */
export function forecastAccuracy(commit: number, actual: number) {
  const diff = commit > 0 ? (actual - commit) / commit : 0;
  return { diff, accurate: Math.abs(diff) <= 0.1 };
}

export function quarterOf(d: Date) {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function quarterRange(q: string) {
  const [y, n] = q.split("-Q").map(Number);
  const start = new Date(Date.UTC(y, (n - 1) * 3, 1));
  const end = new Date(Date.UTC(y, n * 3, 1));
  return { start, end };
}

type History = { deal_id: string; from_stage: string | null; to_stage: string; changed_at: string };

/** Average days spent in each stage, computed from stage-change history. Open stages count until `now`. */
export function daysInStage(history: History[], now = new Date()) {
  const byDeal = new Map<string, History[]>();
  for (const h of history) byDeal.set(h.deal_id, [...(byDeal.get(h.deal_id) ?? []), h]);
  const sums: Record<string, { total: number; n: number }> = {};
  for (const list of byDeal.values()) {
    list.sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    list.forEach((h, i) => {
      if (h.to_stage === "won" || h.to_stage === "lost") return;
      const end = list[i + 1] ? new Date(list[i + 1].changed_at) : now;
      const days = (end.getTime() - new Date(h.changed_at).getTime()) / 864e5;
      sums[h.to_stage] ??= { total: 0, n: 0 };
      sums[h.to_stage].total += days;
      sums[h.to_stage].n += 1;
    });
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v.total / v.n]));
}

/** Share of deals that ever reached stage i which also reached stage i+1 (or later). */
export function stageConversion(history: History[], order: string[]) {
  const reached = new Map<string, Set<string>>();
  for (const h of history) {
    const idx = order.indexOf(h.to_stage);
    if (idx < 0) continue;
    const set = reached.get(h.deal_id) ?? new Set<string>();
    for (let i = 0; i <= idx; i++) set.add(order[i]);
    reached.set(h.deal_id, set);
  }
  return order.slice(0, -1).map((s, i) => {
    let from = 0,
      to = 0;
    for (const set of reached.values()) {
      if (set.has(s)) {
        from++;
        if (set.has(order[i + 1])) to++;
      }
    }
    return { from: s, to: order[i + 1], rate: from ? to / from : 0, count: from };
  });
}

/** ABM engagement score from touches in the last 90 days, weighted by channel. */
export const TOUCH_WEIGHTS: Record<string, number> = {
  web_visit: 1,
  email: 2,
  linkedin: 2,
  direct_mail: 3,
  event: 5,
  call: 5,
  meeting: 8,
};
export function engagementScore(
  touches: { channel: string; occurred_at: string }[],
  now = new Date(),
) {
  const cutoff = now.getTime() - 90 * 864e5;
  return touches
    .filter((t) => new Date(t.occurred_at).getTime() >= cutoff)
    .reduce((s, t) => s + (TOUCH_WEIGHTS[t.channel] ?? 1), 0);
}

/** A partner registration conflicts if another active (pending/approved, not expired) one exists for the same account name. */
export function registrationConflict<
  R extends { account_name: string; status: string; expires_at: string | null; partner_id: string },
>(name: string, regs: R[], partnerId: string, today = new Date()) {
  const n = name.trim().toLowerCase();
  return regs.find(
    (r) =>
      r.account_name.trim().toLowerCase() === n &&
      r.partner_id !== partnerId &&
      (r.status === "pending" || r.status === "approved") &&
      (!r.expires_at || new Date(r.expires_at) >= today),
  );
}
