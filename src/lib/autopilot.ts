// Autopilot (pure, tested): which accounts Nokko researches on its own, which meetings it prepares the day
// before and which accounts are cooling down. The work itself is in autopilot.server.ts.
import { missingKey } from "@/lib/fit-key";

const DAY = 86_400_000;
export const AUTOPILOT_LIMITS = { research: 2, prep: 5, cooling: 3 };
export const COOLING_DEFAULT_DAYS = 21;

/** New accounts (last 14 days) with a corporate domain (personal mail is not one) that Nokko has not researched yet, newest first. */
export function accountsToResearch(
  accounts: {
    id: string;
    domain: string | null;
    created_at: string;
    auto_researched_at: string | null;
  }[],
  now = new Date(),
  max = AUTOPILOT_LIMITS.research,
) {
  return accounts
    .filter(
      (a) =>
        !a.auto_researched_at &&
        !missingKey("cuenta", a, "research_account").length &&
        now.getTime() - new Date(a.created_at).getTime() <= 14 * DAY,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, max);
}

/** Meetings in the next 36 hours with no call prep yet, soonest first. */
export function meetingsToPrep(
  meetings: { id: string; scheduled_at: string | null; ai_brief: string | null }[],
  now = new Date(),
  max = AUTOPILOT_LIMITS.prep,
) {
  return meetings
    .filter((m) => {
      if (!m.scheduled_at || (m.ai_brief ?? "").trim()) return false;
      const t = new Date(m.scheduled_at).getTime() - now.getTime();
      return t > 0 && t <= 1.5 * DAY;
    })
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    .slice(0, max);
}

export type CoolingInput = {
  accounts: {
    id: string;
    name: string;
    is_target: boolean;
    tier: string | null;
    owner_id: string | null;
    created_at: string;
  }[];
  /** Every dated activity per account: touches, calls, past meetings, deal updates. */
  activity: { account_id: string | null; at: string | null }[];
  openDeals: { account_id: string | null; name: string; amount: number | null }[];
  thresholdDays?: number | null;
};
export type CoolingAccount = {
  id: string;
  name: string;
  owner_id: string | null;
  idleDays: number;
  lastAt: string | null;
  openDeals: { name: string; amount: number | null }[];
};

/**
 * Accounts that matter (target, tier A or with an open deal) and have had no activity for longer than the
 * threshold (company override, else 21 days). Never-touched accounts count from their creation. Coldest first.
 */
export function coolingAccounts(
  i: CoolingInput,
  now = new Date(),
  max = AUTOPILOT_LIMITS.cooling,
): CoolingAccount[] {
  const days = i.thresholdDays && i.thresholdDays > 0 ? i.thresholdDays : COOLING_DEFAULT_DAYS;
  const last = new Map<string, string>();
  for (const a of i.activity) {
    if (!a.account_id || !a.at || a.at > now.toISOString()) continue;
    if ((last.get(a.account_id) ?? "") < a.at) last.set(a.account_id, a.at);
  }
  const deals = new Map<string, { name: string; amount: number | null }[]>();
  for (const d of i.openDeals)
    if (d.account_id)
      deals.set(d.account_id, [
        ...(deals.get(d.account_id) ?? []),
        { name: d.name, amount: d.amount },
      ]);
  return i.accounts
    .filter((a) => a.is_target || a.tier === "A" || deals.has(a.id))
    .map((a) => {
      const lastAt = last.get(a.id) ?? null;
      const idleDays = Math.floor(
        (now.getTime() - new Date(lastAt ?? a.created_at).getTime()) / DAY,
      );
      return {
        id: a.id,
        name: a.name,
        owner_id: a.owner_id,
        idleDays,
        lastAt,
        openDeals: deals.get(a.id) ?? [],
      };
    })
    .filter((a) => a.idleDays >= days)
    .sort((a, b) => b.idleDays - a.idleDays)
    .slice(0, max);
}

/** Monday (UTC) of the week, for one cooling review per account and week. */
export function weekKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
