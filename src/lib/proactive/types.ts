import type { SetupData } from "@/lib/setup-schema";

export type Snapshot = {
  now: Date;
  orgId: string;
  setup: SetupData;
  /** Setup steps the company postponed and the latest change in setup data. Optional so older snapshots still work. */
  setupSnoozes?: { step_id: string; snoozed_until: string }[];
  setupActivityAt?: string | null;
  /** Each person's onboarding row (step and last change). Optional so older snapshots still work; absent = no reminder (NK-0009). */
  onboarding?: { user_id: string; step: string; updated_at: string }[];
  deals: {
    id: string;
    name: string;
    stage: string;
    amount: number | null;
    close_date: string | null;
    updated_at: string;
    owner_id: string | null;
    meddpicc: Record<string, unknown> | null;
    account_id: string | null;
  }[];
  /** Upcoming meetings and those of the last 7 days (for the call-notes reminder). */
  meetings: {
    id: string;
    title: string;
    scheduled_at: string | null;
    ai_brief: string | null;
    account_id: string | null;
    created_by: string | null;
    notes?: string | null;
    call_notes?: unknown;
  }[];
  accounts: {
    id: string;
    name: string;
    is_target: boolean;
    owner_id: string | null;
    created_at?: string;
  }[];
  /** Who is on the team (for the account assignment reminder). Optional so older snapshots still work. */
  members?: { user_id: string; role: string }[];
  stakeholders: { account_id: string; buying_role: string | null }[];
  registrations: { id: string; account_name: string; status: string; expires_at: string | null }[];
  trials: {
    segment_id: string | null;
    signed_up_at: string;
    activated_at: string | null;
    converted_at: string | null;
    mrr: number | null;
  }[];
  segments: {
    id: string;
    name: string;
    cac_target?: number | null;
    payback_months?: number | null;
  }[];
  /** Open leads (Nuevo…SQL) and the company's stage limits; optional so older snapshots still work. */
  leads?: {
    id: string;
    company: string;
    stage: string;
    stage_entered_at: string;
    next_step_at: string | null;
    owner_id: string | null;
    account_id: string | null;
    contacted_at?: string | null;
    contact_name?: string | null;
  }[];
  leadSla?: import("@/lib/lead-funnel").LeadSla;
  /** For the cold-deal threshold: every deal with its dates and segment, the segments with ACV ranges, and the company override. Optional so older snapshots still work. */
  cycleDeals?: (import("@/lib/segment-coverage").DealLike & { id: string })[];
  cycleSegments?: import("@/lib/segment-coverage").SegLike[];
  staleDays?: number | null;
  /** The company's deal stages; the default seven when missing. */
  stages?: import("@/lib/stages").Stage[];
  /** Account news signals found in the last 14 days (Firecrawl). Optional so older snapshots still work. */
  signals?: {
    id: string;
    account_id: string;
    title: string;
    kind: string;
    summary: string;
    relevance: string;
    url: string;
    found_at: string;
  }[];
  /** Product usage per company domain from the company's PostHog. Optional so older snapshots still work. */
  /** Extra data for the strategic rules (SDD-20261027 F1). Optional so older snapshots still work; without it no strategic rule fires. */
  strategy?: StrategyData;
  usage?: {
    domain: string;
    account_id: string | null;
    active_users_7d: number;
    active_users_prev_7d: number;
  }[];
  /**
   * What the domain proposal needs (NK-0012 CA-7): every account's domain and the emails of the contacts linked to an account
   * (people, stakeholders and open leads). Optional so older snapshots still work; without it the rule does not fire. Loaded only when
   * asked for (`loadSnapshot` option `fitKey`), so the per-lead follow-up does not pay for it.
   */
  fitKey?: FitKeyData;
  /** Plays the company paused (ids from src/lib/plays/catalog.ts): detect() skips the rules that belong to them. Optional: without it every rule runs. */
  disabledPlays?: string[];
};

export type FitKeyData = {
  accounts: { id: string; domain: string | null }[];
  contacts: { account_id: string; email: string | null }[];
};

export type StrategyData = {
  icps: {
    id: string;
    name: string;
    industries: string | null;
    company_size: string | null;
    geography: string | null;
    countries: string[];
    anti_icp: string | null;
    segment_id: string | null;
    created_at: string;
  }[];
  accounts: {
    id: string;
    name: string;
    industry: string | null;
    size: string | null;
    country: string | null;
    segment_id: string | null;
    tier: string | null;
  }[];
  deals: {
    id: string;
    name: string;
    stage: string;
    amount: number | null;
    account_id: string | null;
    segment_id: string | null;
    close_date: string | null;
    created_at: string;
    closed_at: string | null;
    updated_at: string;
    lost_reason: string | null;
    lost_competitor: string | null;
  }[];
  history: { deal_id: string; from_stage: string | null; to_stage: string; changed_at: string }[];
  products: { id: string; name: string; active: boolean; created_at: string }[];
  lines: {
    id: string;
    deal_id: string;
    product_id: string | null;
    name: string;
    discount_pct: number;
    unit_price: number;
    created_at: string;
  }[];
  /** Acquisition costs entered per segment (cac_costs). */
  costs: { segment_id: string | null; period: string }[];
  /** Planned revenue per segment and quarter (segment_budget_quarters), the target the coverage is measured against. */
  experiments?: import("@/lib/experiments").ExperimentLike[];
  budgets: { segment_id: string; period: string; plan_revenue: number | null }[];
};

export type SuggestionAction = { tool: string; args: Record<string, unknown> };

export type Suggestion = {
  detector: string;
  dedupe_key: string;
  priority: 1 | 2 | 3;
  title: string;
  body: string;
  link: string | null;
  action: SuggestionAction | null;
  user_id: string | null;
  /** Only strategic suggestions (strategy_* detectors, F0/F1). */
  strategy?: import("@/lib/strategy-suggestions").StrategyMeta;
};

export type Detector = (s: Snapshot) => Suggestion[];

export const DAY = 86_400_000;
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const OPEN = (stage: string) => stage !== "won" && stage !== "lost";
