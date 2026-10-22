// Org-scoped loaders. Every query filters org_id explicitly so they are safe with
// both the user's RLS client and the privileged server client (cron, Telegram).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { quarterOf } from "@/lib/metrics";
import type { SetupData } from "@/lib/setup-schema";
import type { Snapshot } from "@/lib/proactive/types";
import { readStaleDays } from "@/lib/stale";
import { readSla } from "@/lib/lead-funnel";
import { NOTES_UNTIL_MS } from "@/lib/call-notes";

export type Db = SupabaseClient<Database>;

export async function loadSetupData(db: Db, orgId: string): Promise<SetupData> {
  const [org, seg, icp, pos, pil, quo, acc, fit, deals] = await Promise.all([
    db.from("organizations").select("currency").eq("id", orgId).maybeSingle(),
    db.from("segments").select("name,acv_min,acv_max,win_rate_target,ae_quota").eq("org_id", orgId),
    db.from("icp_profiles").select("industries,company_size,why_fit,anti_icp").eq("org_id", orgId),
    db.from("positioning").select("*").eq("org_id", orgId).limit(1).maybeSingle(),
    db.from("messaging_pillars").select("title,message").eq("org_id", orgId),
    db.from("quotas").select("period,amount").eq("org_id", orgId),
    db.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    // Same three fields the account sheet saves as null when emptied, so an empty string never counts.
    db.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", orgId).not("segment_id", "is", null).not("industry", "is", null).neq("industry", "").not("size", "is", null).neq("size", ""),
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
    accountsWithFit: fit.count ?? 0,
    deals: deals.count ?? 0,
    quarter: quarterOf(new Date()),
  };
}

export async function loadSnapshot(db: Db, orgId: string, now = new Date()): Promise<Snapshot> {
  const [setup, deals, meetings, accounts, sh, regs, trials, segs, leads, leadSettings, stages, members] = await Promise.all([
    loadSetupData(db, orgId),
    db.from("deals").select("id,name,stage,amount,close_date,updated_at,created_at,closed_at,segment_id,owner_id,meddpicc,account_id").eq("org_id", orgId),
    db.from("meetings").select("id,title,scheduled_at,ai_brief,account_id,created_by,notes,call_notes").eq("org_id", orgId).gte("scheduled_at", new Date(now.getTime() - NOTES_UNTIL_MS).toISOString()),
    db.from("accounts").select("id,name,is_target,owner_id,created_at").eq("org_id", orgId),
    db.from("stakeholders").select("account_id,buying_role").eq("org_id", orgId),
    db.from("deal_registrations").select("id,account_name,status,expires_at").eq("org_id", orgId),
    db.from("trials").select("segment_id,signed_up_at,activated_at,converted_at,mrr").eq("org_id", orgId),
    db.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").eq("org_id", orgId),
    db.from("leads").select("id,company,stage,stage_entered_at,next_step_at,owner_id,account_id,contacted_at,contact_name").eq("org_id", orgId).in("stage", ["new", "contacted", "mql", "sql"]).limit(1000),
    db.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle(),
    db.from("deal_stages").select("key,label,position,kind,board_group,probability").eq("org_id", orgId),
    db.from("org_members").select("user_id,role").eq("org_id", orgId),
  ]);
  return {
    now, orgId, setup,
    stages: (stages.data ?? []) as import("@/lib/stages").Stage[],
    deals: (deals.data ?? []) as any,
    meetings: meetings.data ?? [],
    accounts: accounts.data ?? [],
    members: (members.data ?? []).map((m) => ({ user_id: m.user_id, role: String(m.role) })),
    stakeholders: sh.data ?? [],
    registrations: regs.data ?? [],
    trials: (trials.data ?? []) as any,
    segments: segs.data ?? [],
    leads: leads.data ?? [],
    leadSla: readSla(leadSettings.data?.sla),
    cycleDeals: (deals.data ?? []) as any,
    cycleSegments: segs.data ?? [],
    staleDays: readStaleDays(leadSettings.data?.sla),
  };
}

/**
 * Saves what the detectors found and closes what no longer applies. A pending suggestion the user worked
 * on with «Resolver» (touched) closes as done by the user ("approved"); the rest close as "resolved"
 * (solved on its own), so the metrics can tell them apart.
 */
export async function syncSuggestions(db: Db, orgId: string, found: import("@/lib/proactive/types").Suggestion[], touched: string[] = []) {
  if (found.length) {
    await db.from("suggestions").upsert(
      found.map((f) => ({ ...f, org_id: orgId, action: f.action as any })),
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
  }
  const keys = new Set(found.map((f) => f.dedupe_key));
  // The weekly report, the AI's setup questions and the «te han asignado cuentas» notices are not detectors: they stay until the user decides on them.
  const { data: open } = await db.from("suggestions").select("id,dedupe_key,status,title,body").eq("org_id", orgId).in("status", ["pending", "snoozed"]).not("detector", "in", "(weekly_report,setup_question,account_assigned)");
  // An open suggestion keeps its key but its numbers move (coverage, amounts): refresh its text so it
  // never contradicts the screen it links to.
  for (const u of staleTexts(open ?? [], found)) await db.from("suggestions").update({ title: u.title, body: u.body ?? "" }).eq("id", u.id);
  const { done, resolved } = splitClosed((open ?? []).filter((o) => !keys.has(o.dedupe_key)), touched);
  const at = new Date().toISOString();
  if (done.length) await db.from("suggestions").update({ status: "approved", updated_at: at }).in("id", done);
  if (resolved.length) await db.from("suggestions").update({ status: "resolved", updated_at: at }).in("id", resolved);
  // Wake up snoozed ones whose time has come.
  await db.from("suggestions").update({ status: "pending", snoozed_until: null }).eq("org_id", orgId).eq("status", "snoozed").lte("snoozed_until", new Date().toISOString());
}

/** Open suggestions whose detector now says something different (same key, new title or body). */
export function staleTexts(open: { id: string; dedupe_key: string; title: string | null; body: string | null }[], found: { dedupe_key: string; title: string; body: string | null }[]) {
  const byKey = new Map(found.map((f) => [f.dedupe_key, f]));
  return open.flatMap((o) => {
    const f = byKey.get(o.dedupe_key);
    return f && (f.title !== o.title || (f.body ?? null) !== (o.body ?? null)) ? [{ id: o.id, title: f.title, body: f.body ?? null }] : [];
  });
}

/** Splits suggestions that stopped applying: pending ones the user opened with «Resolver» → done by the user; the rest → solved on their own. */
export function splitClosed(stale: { id: string; status: string }[], touched: string[]) {
  const t = new Set(touched);
  const done = stale.filter((o) => o.status === "pending" && t.has(o.id)).map((o) => o.id);
  const resolved = stale.filter((o) => !done.includes(o.id)).map((o) => o.id);
  return { done, resolved };
}
