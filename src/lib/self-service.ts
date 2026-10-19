// Self-service (PLG) funnel: signup → activation → paid, measured as a cohort of
// trials that signed up inside the selected period.

export type Trial = {
  segment_id: string | null;
  signed_up_at: string;
  activated_at: string | null;
  converted_at: string | null;
  mrr: number | string | null;
};

export type FunnelStats = {
  signups: number;
  activated: number;
  paid: number;
  activationRate: number; // activated / signups
  trialToPaid: number; // paid / signups
  activatedToPaid: number; // paid among activated / activated
  medianDaysToActivate: number | null;
  medianDaysToPurchase: number | null;
  newMrr: number;
};

const DAY = 86_400_000;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const days = (from: string, to: string) => Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / DAY);

export function funnelStats(trials: Trial[]): FunnelStats {
  const signups = trials.length;
  const act = trials.filter((t) => t.activated_at);
  const paid = trials.filter((t) => t.converted_at);
  const paidActivated = paid.filter((t) => t.activated_at).length;
  return {
    signups,
    activated: act.length,
    paid: paid.length,
    activationRate: signups ? act.length / signups : 0,
    trialToPaid: signups ? paid.length / signups : 0,
    activatedToPaid: act.length ? paidActivated / act.length : 0,
    medianDaysToActivate: median(act.map((t) => days(t.signed_up_at, t.activated_at!))),
    medianDaysToPurchase: median(paid.map((t) => days(t.signed_up_at, t.converted_at!))),
    newMrr: paid.reduce((s, t) => s + (Number(t.mrr) || 0), 0),
  };
}

/** Trials whose signup falls in [start, end). */
export function cohort<T extends Pick<Trial, "signed_up_at">>(trials: T[], start: Date, end: Date): T[] {
  return trials.filter((t) => { const d = new Date(t.signed_up_at); return d >= start && d < end; });
}

export type SegmentFunnel = FunnelStats & { segment_id: string | null };

/** One funnel per segment (null = sin segmento), largest cohort first. */
export function funnelBySegment(trials: Trial[]): SegmentFunnel[] {
  const groups = new Map<string | null, Trial[]>();
  for (const t of trials) {
    const k = t.segment_id ?? null;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([segment_id, list]) => ({ segment_id, ...funnelStats(list) }))
    .sort((a, b) => b.signups - a.signups);
}

/** Parses a date cell (YYYY-MM-DD or DD/MM/YYYY). Returns ISO string or null. */
export function parseDateCell(v?: string | null): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const eu = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const d = eu ? new Date(Date.UTC(+eu[3], +eu[2] - 1, +eu[1])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
