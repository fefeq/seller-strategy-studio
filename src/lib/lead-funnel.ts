// Lead stages, delay rules and the full Lead → Ganado funnel. Pure so the Leads screen,
// the Métricas funnel, the agent and the proactive engine all count the same way.

export const LEAD_STAGES = [
  { id: "new", label: "Nuevo" },
  { id: "contacted", label: "Contactado" },
  { id: "mql", label: "MQL" },
  { id: "sql", label: "SQL" },
  { id: "opportunity", label: "Oportunidad" },
] as const;
export const DISQUALIFIED = { id: "disqualified", label: "Descartado" } as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["id"] | "disqualified";
export const OPEN_LEAD_STAGES = ["new", "contacted", "mql", "sql"] as const;
export type OpenLeadStage = (typeof OPEN_LEAD_STAGES)[number];
export type LeadSla = Record<OpenLeadStage, number>;

/** Days a lead may stay in each stage before it counts as delayed. */
export const DEFAULT_LEAD_SLA: LeadSla = { new: 1, contacted: 3, mql: 5, sql: 7 };

export const leadStageLabel = (s: string) => (s === DISQUALIFIED.id ? DISQUALIFIED.label : LEAD_STAGES.find((x) => x.id === s)?.label ?? s);
export const isOpenLeadStage = (s: string): s is OpenLeadStage => (OPEN_LEAD_STAGES as readonly string[]).includes(s);

export function readSla(raw: unknown): LeadSla {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_LEAD_SLA };
  for (const k of OPEN_LEAD_STAGES) {
    const n = Number(o[k]);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

export type LeadRow = {
  id: string;
  stage: string;
  created_at: string;
  stage_entered_at: string;
  contacted_at: string | null;
  mql_at: string | null;
  sql_at: string | null;
  opportunity_at: string | null;
  disqualified_at?: string | null;
  next_step_at: string | null;
  deal_id: string | null;
  segment_id?: string | null;
  source?: string | null;
};
export type DealOutcome = { id: string; stage: string; closed_at: string | null };

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export type LeadDelay = {
  late: boolean;
  /** stalled = more days in the stage than allowed; followup = next-step date already passed. */
  reasons: ("stalled" | "followup")[];
  daysInStage: number;
  limit: number | null;
  followupOverdueDays: number;
};

/** A lead is delayed when it stays longer than its stage limit, when its follow-up date has passed, or both. */
export function leadDelay(lead: Pick<LeadRow, "stage" | "stage_entered_at" | "next_step_at">, sla: LeadSla, now = new Date()): LeadDelay {
  const daysInStage = Math.max(0, (now.getTime() - new Date(lead.stage_entered_at).getTime()) / DAY);
  if (!isOpenLeadStage(lead.stage)) return { late: false, reasons: [], daysInStage, limit: null, followupOverdueDays: 0 };
  const limit = sla[lead.stage];
  const reasons: LeadDelay["reasons"] = [];
  if (daysInStage > limit) reasons.push("stalled");
  let followupOverdueDays = 0;
  if (lead.next_step_at && lead.next_step_at < isoDay(now)) {
    reasons.push("followup");
    followupOverdueDays = Math.round((new Date(`${isoDay(now)}T00:00:00Z`).getTime() - new Date(`${lead.next_step_at}T00:00:00Z`).getTime()) / DAY);
  }
  return { late: reasons.length > 0, reasons, daysInStage, limit, followupOverdueDays };
}

export function delayText(d: LeadDelay) {
  const parts: string[] = [];
  if (d.reasons.includes("stalled")) parts.push(`${Math.floor(d.daysInStage)} días en la etapa (máx. ${d.limit})`);
  if (d.reasons.includes("followup")) parts.push(`seguimiento vencido hace ${d.followupOverdueDays} ${d.followupOverdueDays === 1 ? "día" : "días"}`);
  return parts.join(" · ");
}

// ---------- Funnel ----------

export const FUNNEL_STEPS = [
  { id: "lead", label: "Leads" },
  { id: "contacted", label: "Contactado" },
  { id: "mql", label: "MQL" },
  { id: "sql", label: "SQL" },
  { id: "opportunity", label: "Oportunidad" },
  { id: "won", label: "Ganado" },
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number]["id"];

/** When the lead reached a funnel step (null if it never did). Ganado comes from its deal. */
export function reachedAt(lead: LeadRow, step: FunnelStep, deals: Map<string, DealOutcome>): string | null {
  switch (step) {
    case "lead": return lead.created_at;
    case "contacted": return lead.contacted_at;
    case "mql": return lead.mql_at;
    case "sql": return lead.sql_at;
    case "opportunity": return lead.opportunity_at;
    case "won": {
      const d = lead.deal_id ? deals.get(lead.deal_id) : undefined;
      return d?.stage === "won" ? d.closed_at ?? lead.opportunity_at : null;
    }
  }
}

const BACKFILLED: Partial<Record<FunnelStep, FunnelStep>> = { contacted: "mql", mql: "sql", sql: "opportunity" };

/**
 * Whether the lead really went through a step. The database stamps every earlier step when a lead
 * enters or jumps straight to a later one (a CSV row that arrives as Oportunidad gets contacted_at,
 * mql_at and sql_at all at the same instant). A step stamped at the very same instant as the next
 * one was skipped, not passed: counting it shows a 100 % funnel nobody went through.
 */
export function passedThrough(lead: LeadRow, step: FunnelStep, deals: Map<string, DealOutcome>): boolean {
  const at = reachedAt(lead, step, deals);
  if (!at) return false;
  const next = BACKFILLED[step];
  if (!next) return true;
  const nextAt = reachedAt(lead, next, deals);
  return !(nextAt && new Date(nextAt).getTime() === new Date(at).getTime());
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export type FunnelResult = {
  total: number;
  disqualified: number;
  /**
   * count = leads that passed through the step; direct = those that entered the funnel at this step
   * (they skipped the one before); fromPrev = share of the previous step's leads that went on to this one.
   */
  steps: { id: FunnelStep; label: string; count: number; direct: number; fromPrev: number | null; fromStart: number }[];
  /** Median days from entry to each step, among leads that reached it. */
  medianDays: Record<"mql" | "sql" | "opportunity" | "won", number | null>;
};

/** Leads that entered (created_at) within [start, end). */
export function leadCohort<T extends Pick<LeadRow, "created_at">>(leads: T[], start: Date, end: Date): T[] {
  return leads.filter((l) => { const t = new Date(l.created_at).getTime(); return t >= start.getTime() && t < end.getTime(); });
}

export function leadFunnel(leads: LeadRow[], deals: DealOutcome[] | Map<string, DealOutcome>): FunnelResult {
  const map = deals instanceof Map ? deals : new Map(deals.map((d) => [d.id, d]));
  const total = leads.length;
  const steps = FUNNEL_STEPS.map((s, i) => {
    const here = leads.filter((l) => passedThrough(l, s.id, map));
    const before = i === 0 ? null : FUNNEL_STEPS[i - 1].id;
    const prevCount = before == null ? null : leads.filter((l) => passedThrough(l, before, map)).length;
    const continued = before == null ? here.length : here.filter((l) => passedThrough(l, before, map)).length;
    return {
      id: s.id, label: s.label, count: here.length,
      direct: before == null ? 0 : here.length - continued,
      fromPrev: prevCount == null ? null : prevCount ? continued / prevCount : 0,
      fromStart: total ? here.length / total : 0,
    };
  });
  const days = (step: FunnelStep) => median(leads.flatMap((l) => {
    const at = reachedAt(l, step, map);
    return at ? [Math.max(0, (new Date(at).getTime() - new Date(l.created_at).getTime()) / DAY)] : [];
  }));
  return {
    total,
    disqualified: leads.filter((l) => l.stage === DISQUALIFIED.id).length,
    steps,
    medianDays: { mql: days("mql"), sql: days("sql"), opportunity: days("opportunity"), won: days("won") },
  };
}

export type FunnelGroup = { key: string; total: number; counts: Record<FunnelStep, number>; toOpportunity: number; toWon: number };

/** Same funnel split by any key (segment, source…), biggest groups first. */
export function funnelBy(leads: LeadRow[], deals: DealOutcome[], key: (l: LeadRow) => string): FunnelGroup[] {
  const map = new Map(deals.map((d) => [d.id, d]));
  const groups = new Map<string, LeadRow[]>();
  for (const l of leads) { const k = key(l); groups.set(k, [...(groups.get(k) ?? []), l]); }
  return [...groups.entries()].map(([k, ls]) => {
    const f = leadFunnel(ls, map);
    const counts = Object.fromEntries(f.steps.map((s) => [s.id, s.count])) as Record<FunnelStep, number>;
    return { key: k, total: f.total, counts, toOpportunity: f.total ? counts.opportunity / f.total : 0, toWon: f.total ? counts.won / f.total : 0 };
  }).sort((a, b) => b.total - a.total);
}
