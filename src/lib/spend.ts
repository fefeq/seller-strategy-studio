// Spend ledger rules (SDD pausa-legal-linkedin-y-gasto, pieza B), pure and tested in spend.test.ts.
// An estimate exists only when real measured history of the same tool and currency exists; otherwise the
// answer is «sin dato» (null), never zero or an invented amount. Currencies are never added together and an
// unknown cost is reported as unknown, not as zero.

export type CostKind = "measured" | "estimate" | "unknown";

export type SpendRow = {
  cost: number | null;
  currency: string;
  cost_kind: CostKind;
  tool?: string | null;
  created_at?: string;
};

/** Median of the given amounts; null without samples (never zero). */
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export type Estimate = {
  /** Median of the comparable measured samples; null = «sin dato». */
  value: number | null;
  samples: number;
  period: { from: string; to: string } | null;
};

/**
 * Estimated cost of one operation of `tool` in `currency`, from the company's own history: only measured
 * charges of that same tool and currency count (estimates, other tools, other currencies and unknown costs
 * are not evidence of a price).
 */
export function estimateCost(rows: SpendRow[], tool: string, currency: string): Estimate {
  const samples = rows.filter(
    (r) =>
      r.tool === tool && r.currency === currency && r.cost_kind === "measured" && r.cost !== null,
  );
  const value = median(samples.map((r) => r.cost!));
  const dates = samples
    .map((r) => r.created_at)
    .filter((d): d is string => !!d)
    .sort();
  return {
    value,
    samples: samples.length,
    period: dates.length ? { from: dates[0]!, to: dates[dates.length - 1]! } : null,
  };
}

export type SpendTotals = {
  /** Sum per currency; currencies are never merged. */
  totals: Record<string, number>;
  /** How many rows carry an unknown cost. */
  unknown: number;
  /** False when any row has an unknown cost: the budget consumption is incomplete. */
  complete: boolean;
};

/** Monthly consumption grouped by currency; an unknown cost is counted apart, never as zero. */
export function spendTotals(rows: SpendRow[]): SpendTotals {
  const totals: Record<string, number> = {};
  let unknown = 0;
  for (const r of rows) {
    if (r.cost === null || r.cost_kind === "unknown") {
      unknown++;
      continue;
    }
    totals[r.currency] = (totals[r.currency] ?? 0) + r.cost;
  }
  return { totals, unknown, complete: unknown === 0 };
}
