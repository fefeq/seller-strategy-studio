// Org-scoped loaders. Every query filters org_id explicitly so they are safe with
// both the user's RLS client and the privileged server client (cron, Telegram).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { quarterOf } from "@/lib/metrics";
import type { SetupData } from "@/lib/setup-schema";
import type { Snapshot } from "@/lib/proactive/types";
import { readSla } from "@/lib/lead-funnel";

export type Db = SupabaseClient<Database>;

export async function loadSetupData(db: Db, orgId: string): Promise<SetupData> {
  const [org, seg, icp, pos, pil, quo, acc, deals] = await Promise.all([
    db.from("organizations").select("currency").eq("id", orgId).maybeSingle(),
    db.from("segments").select("name,acv_min,acv_max,win_rate_target,ae_quota").eq("org_id", orgId),
    db.from("icp_profiles").select("industries,company_size,why_fit,anti_icp").eq("org_id", orgId),
    db.from("positioning").select("*").eq("org_id", orgId).limit(1).maybeSingle(),
    db.from("messaging_pillars").select("title,message").eq("org_id", orgId),
    db.from("quotas").select("period,amount").eq("org_id", orgId),
    db.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    db.from("deals").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);
  return {
    currency: org.data?.currency ?? null,
    segments: (seg.data ?? []) as SetupData["segments"],
    icps: icp.data ?? [],
    positioning: (pos.data as any) ?? null,
    pillars: pil.data ?? [],
    quotas: (quo.data ?? []).map((q) => ({ period: q.period, amount: Number(q.amount) })),
    accounts: acc.count ?? 0,
    deals: deals.count ?? 0,
    quarter: quarterOf(new Date()),
  };
}

export async function loadSnapshot(db: Db, orgId: string, now = new Date()): Promise<Snapshot> {
  const [setup, deals, meetings, accounts, sh, regs, trials, segs, leads, leadSettings] = await Promise.all([
    loadSetupData(db, orgId),
    db.from("deals").select("id,name,stage,amount,close_date,updated_at,owner_id,meddpicc,account_id").eq("org_id", orgId),
    db.from("meetings").select("id,title,scheduled_at,ai_brief,account_id,created_by").eq("org_id", orgId).gte("scheduled_at", now.toISOString()),
    db.from("accounts").select("id,name,is_target,owner_id").eq("org_id", orgId),
    db.from("stakeholders").select("account_id,buying_role").eq("org_id", orgId),
    db.from("deal_registrations").select("id,account_name,status,expires_at").eq("org_id", orgId),
    db.from("trials").select("segment_id,signed_up_at,activated_at,converted_at,mrr").eq("org_id", orgId),
    db.from("segments").select("id,name").eq("org_id", orgId),
    db.from("leads").select("id,company,stage,stage_entered_at,next_step_at,owner_id,account_id").eq("org_id", orgId).in("stage", ["new", "contacted", "mql", "sql"]).limit(1000),
    db.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle(),
  ]);
  return {
    now, orgId, setup,
    deals: (deals.data ?? []) as any,
    meetings: meetings.data ?? [],
    accounts: accounts.data ?? [],
    stakeholders: sh.data ?? [],
    registrations: regs.data ?? [],
    trials: (trials.data ?? []) as any,
    segments: segs.data ?? [],
    leads: leads.data ?? [],
    leadSla: readSla(leadSettings.data?.sla),
  };
}

/** Upserts detected suggestions (keeps dismissed/approved state) and resolves pending ones no longer detected. */
export async function syncSuggestions(db: Db, orgId: string, found: import("@/lib/proactive/types").Suggestion[]) {
  if (found.length) {
    await db.from("suggestions").upsert(
      found.map((f) => ({ ...f, org_id: orgId, action: f.action as any })),
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
  }
  const keys = new Set(found.map((f) => f.dedupe_key));
  const { data: open } = await db.from("suggestions").select("id,dedupe_key").eq("org_id", orgId).in("status", ["pending", "snoozed"]);
  const stale = (open ?? []).filter((o) => !keys.has(o.dedupe_key)).map((o) => o.id);
  if (stale.length) await db.from("suggestions").update({ status: "resolved", updated_at: new Date().toISOString() }).in("id", stale);
  // Wake up snoozed ones whose time has come.
  await db.from("suggestions").update({ status: "pending", snoozed_until: null }).eq("org_id", orgId).eq("status", "snoozed").lte("snoozed_until", new Date().toISOString());
}
