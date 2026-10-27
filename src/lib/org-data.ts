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
import { fetchAll } from "@/lib/fetch-all";
import type { Json } from "@/integrations/supabase/types";
import { jsonObject } from "@/lib/json";

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
    positioning: pos.data ? (({ copy_status: _copy, field_sources: _fs, ...p }) => p)(pos.data) : null,
    pillars: pil.data ?? [],
    quotas: (quo.data ?? []).map((q) => ({ period: q.period, amount: Number(q.amount) })),
    accounts: acc.count ?? 0,
    deals: deals.count ?? 0,
    quarter: quarterOf(new Date()),
  };
}

/** Extra reads for the strategic rules (F1). A failed read leaves its list empty: a rule never fires on data it could not read. */
async function loadStrategyData(db: Db, orgId: string): Promise<import("@/lib/proactive/types").StrategyData> {
  const [icps, accounts, deals, history, products, lines, costs, budgets] = await Promise.all([
    db.from("icp_profiles").select("id,name,industries,company_size,geography,countries,anti_icp,segment_id,created_at").eq("org_id", orgId),
    fetchAll((a, b) => db.from("accounts").select("id,name,industry,size,country,segment_id,tier").eq("org_id", orgId).order("id").range(a, b)).then((r) => ({ data: r.rows })),
    fetchAll((a, b) => db.from("deals").select("id,name,stage,amount,account_id,segment_id,close_date,created_at,closed_at,updated_at,lost_reason,lost_competitor").eq("org_id", orgId).order("id").range(a, b)).then((r) => ({ data: r.rows })),
    fetchAll((a, b) => db.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at").eq("org_id", orgId).order("changed_at").range(a, b)).then((r) => ({ data: r.rows })),
    db.from("products").select("id,name,active,created_at").eq("org_id", orgId),
    fetchAll((a, b) => db.from("deal_lines").select("id,deal_id,product_id,name,discount_pct,unit_price,created_at").eq("org_id", orgId).order("id").range(a, b)).then((r) => ({ data: r.rows })),
    db.from("cac_costs").select("segment_id,period").eq("org_id", orgId),
    db.from("segment_budget_quarters").select("segment_id,period,plan_revenue").eq("org_id", orgId),
  ]);
  return {
    icps: (icps.data ?? []).map((i) => ({ ...i, countries: i.countries ?? [] })),
    accounts: accounts.data ?? [], deals: deals.data ?? [], history: history.data ?? [], products: products.data ?? [],
    lines: (lines.data ?? []).map((l) => ({ ...l, discount_pct: Number(l.discount_pct), unit_price: Number(l.unit_price) })),
    costs: costs.data ?? [], budgets: budgets.data ?? [],
  };
}

export async function loadSnapshot(db: Db, orgId: string, now = new Date()): Promise<Snapshot> {
  const [setup, deals, meetings, accounts, sh, regs, trials, segs, leads, leadSettings, stages, members, signals, usage] = await Promise.all([
    loadSetupData(db, orgId),
    fetchAll((a, b) => db.from("deals").select("id,name,stage,amount,close_date,updated_at,created_at,closed_at,segment_id,owner_id,meddpicc,account_id").eq("org_id", orgId).order("id").range(a, b)).then((r) => ({ data: r.rows, error: null })),
    db.from("meetings").select("id,title,scheduled_at,ai_brief,account_id,created_by,notes,call_notes").eq("org_id", orgId).gte("scheduled_at", new Date(now.getTime() - NOTES_UNTIL_MS).toISOString()),
    fetchAll((a, b) => db.from("accounts").select("id,name,is_target,owner_id,created_at").eq("org_id", orgId).order("id").range(a, b)).then((r) => ({ data: r.rows, error: null })),
    db.from("stakeholders").select("account_id,buying_role").eq("org_id", orgId),
    db.from("deal_registrations").select("id,account_name,status,expires_at").eq("org_id", orgId),
    db.from("trials").select("segment_id,signed_up_at,activated_at,converted_at,mrr").eq("org_id", orgId),
    db.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").eq("org_id", orgId),
    fetchAll((a, b) => db.from("leads").select("id,company,stage,stage_entered_at,next_step_at,owner_id,account_id,contacted_at,contact_name").eq("org_id", orgId).in("stage", ["new", "contacted", "mql", "sql"]).order("id").range(a, b)).then((r) => ({ data: r.rows, error: null })),
    db.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle(),
    db.from("deal_stages").select("key,label,position,kind,board_group,probability").eq("org_id", orgId),
    db.from("org_members").select("user_id,role").eq("org_id", orgId),
    db.from("account_signals").select("id,account_id,title,kind,summary,relevance,url,found_at").eq("org_id", orgId).gte("found_at", new Date(now.getTime() - 14 * 86_400_000).toISOString()).limit(200),
    db.from("product_usage").select("domain,account_id,active_users_7d,active_users_prev_7d").eq("org_id", orgId).order("active_users_7d", { ascending: false }).limit(500),
  ]);
  const strategy = await loadStrategyData(db, orgId);
  return {
    now, orgId, setup, strategy,
    stages: (stages.data ?? []) as import("@/lib/stages").Stage[],
    deals: (deals.data ?? []).map((d) => ({ ...d, meddpicc: jsonObject(d.meddpicc) })),
    meetings: meetings.data ?? [],
    accounts: accounts.data ?? [],
    members: (members.data ?? []).map((m) => ({ user_id: m.user_id, role: String(m.role) })),
    stakeholders: sh.data ?? [],
    registrations: regs.data ?? [],
    trials: trials.data ?? [],
    segments: segs.data ?? [],
    leads: leads.data ?? [],
    leadSla: readSla(leadSettings.data?.sla),
    cycleDeals: (deals.data ?? []).map((d) => ({ ...d, meddpicc: jsonObject(d.meddpicc) })),
    cycleSegments: segs.data ?? [],
    staleDays: readStaleDays(leadSettings.data?.sla),
    signals: signals.data ?? [],
    usage: usage.data ?? [],
  };
}

/**
 * Saves what the detectors found and closes what no longer applies. A pending suggestion the user worked
 * on with «Resolver» (touched) closes as done by the user ("approved"); the rest close as "resolved"
 * (solved on its own), so the metrics can tell them apart.
 */
export async function syncSuggestions(db: Db, orgId: string, found: import("@/lib/proactive/types").Suggestion[], touched: string[] = []) {
  // Strategic suggestions (strategy_* detectors) carry evidence and keep their own decisions: they are written, reopened and
  // left alone by syncStrategySuggestions (CA-5, CA-6) and never auto-closed here.
  const { isStrategySuggestion, syncStrategySuggestions, STRATEGY_DETECTOR_LIKE } = await import("@/lib/strategy-core");
  const strategic = found.filter(isStrategySuggestion);
  found = found.filter((f) => !isStrategySuggestion(f));
  await syncStrategySuggestions(db, orgId, strategic);
  if (found.length) {
    await db.from("suggestions").upsert(
      found.map((f) => ({ ...f, org_id: orgId, action: f.action as unknown as Json })),
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
  }
  const keys = new Set(found.map((f) => f.dedupe_key));
  // The weekly report, the AI's setup questions and the «te han asignado cuentas» notices are not detectors: they stay until the user decides on them.
  const { data: open } = await db.from("suggestions").select("id,dedupe_key,status,title,body").eq("org_id", orgId).in("status", ["pending", "snoozed"]).not("detector", "in", "(weekly_report,setup_question,account_assigned,lead_enriched,discoveries,account_researched,meeting_prepped,account_cooling,field_proposal)").not("detector", "like", STRATEGY_DETECTOR_LIKE);
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
