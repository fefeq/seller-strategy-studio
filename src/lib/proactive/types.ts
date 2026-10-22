import type { SetupData } from "@/lib/setup-schema";

export type Snapshot = {
  now: Date;
  orgId: string;
  setup: SetupData;
  deals: { id: string; name: string; stage: string; amount: number | null; close_date: string | null; updated_at: string; owner_id: string | null; meddpicc: Record<string, unknown> | null; account_id: string | null }[];
  meetings: { id: string; title: string; scheduled_at: string | null; ai_brief: string | null; account_id: string | null; created_by: string | null }[];
  accounts: { id: string; name: string; is_target: boolean; owner_id: string | null }[];
  stakeholders: { account_id: string; buying_role: string | null }[];
  registrations: { id: string; account_name: string; status: string; expires_at: string | null }[];
  trials: { segment_id: string | null; signed_up_at: string; activated_at: string | null; converted_at: string | null; mrr: number | null }[];
  segments: { id: string; name: string }[];
  /** Open leads (Nuevo…SQL) and the company's stage limits; optional so older snapshots still work. */
  leads?: { id: string; company: string; stage: string; stage_entered_at: string; next_step_at: string | null; owner_id: string | null; account_id: string | null; contacted_at?: string | null; contact_name?: string | null }[];
  leadSla?: import("@/lib/lead-funnel").LeadSla;
  /** For the cold-deal threshold: every deal with its dates and segment, the segments with ACV ranges, and the company override. Optional so older snapshots still work. */
  cycleDeals?: (import("@/lib/segment-coverage").DealLike & { id: string })[];
  cycleSegments?: import("@/lib/segment-coverage").SegLike[];
  staleDays?: number | null;
  /** The company's deal stages; the default seven when missing. */
  stages?: import("@/lib/stages").Stage[];
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
};

export type Detector = (s: Snapshot) => Suggestion[];

export const DAY = 86_400_000;
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const OPEN = (stage: string) => stage !== "won" && stage !== "lost";
