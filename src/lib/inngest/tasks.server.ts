// The work Inngest runs, as plain functions (each one is a retried step in functions.server.ts). They use the
// admin client and always filter by the company; who may start them is checked where the event is sent.
// Lead enrichment/follow-ups live in lead-tasks.server.ts and the background-job runner in job-runner.server.ts;
// they are re-exported here so callers keep one entry point.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
const HOURS = 3_600_000;

// ---------------- Per-company maintenance (was one sequential hourly loop) ----------------

export async function maintainSuggestions(db: Admin, orgId: string) {
  const { loadSnapshot, syncSuggestions } = await import("@/lib/org-data");
  const { detect } = await import("@/lib/proactive");
  const snap = await loadSnapshot(db, orgId);
  const found = detect(snap);
  await syncSuggestions(db, orgId, found, [], { onboardingSeen: (snap.onboarding ?? []).map((o) => o.user_id) });
  return { detected: found.length };
}

export async function maintainStripe(db: Admin, orgId: string, now = new Date()) {
  const { SYNC_EVERY_HOURS, syncStripeOrg } = await import("@/lib/stripe/sync.server");
  const { data: c } = await db.from("stripe_connections").select("last_synced_at").eq("org_id", orgId).maybeSingle();
  if (!c || (c.last_synced_at && now.getTime() - new Date(c.last_synced_at).getTime() < SYNC_EVERY_HOURS * HOURS)) return { skipped: true };
  await db.from("stripe_connections").update({ last_synced_at: now.toISOString() }).eq("org_id", orgId);
  return syncStripeOrg(db, orgId, now);
}

export async function maintainPosthog(db: Admin, orgId: string, now = new Date()) {
  const { SYNC_EVERY_HOURS, syncPosthogOrg } = await import("@/lib/posthog-sync.server");
  const { data: c } = await db.from("posthog_connections").select("last_synced_at").eq("org_id", orgId).maybeSingle();
  if (!c || (c.last_synced_at && now.getTime() - new Date(c.last_synced_at).getTime() < SYNC_EVERY_HOURS * HOURS)) return { skipped: true };
  await db.from("posthog_connections").update({ last_synced_at: now.toISOString() }).eq("org_id", orgId);
  const r = await syncPosthogOrg(db, orgId, now);
  return { ok: r.ok, error: r.error };
}

/** News for a few of the company's ABM target accounts (each at most weekly). */
export async function maintainSignals(db: Admin, orgId: string, now = new Date(), max = 3) {
  if (!process.env["FIRECRAWL_API_KEY"]) return { skipped: true };
  const { accountsToRefresh } = await import("@/lib/web-research");
  const { refreshSignalsCore } = await import("@/lib/web-research-core");
  const { data } = await db.from("accounts").select("id,domain,is_target,signals_checked_at").eq("org_id", orgId).eq("is_target", true).not("domain", "is", null).limit(500);
  let added = 0;
  for (const a of accountsToRefresh(data ?? [], now, max)) {
    try { added += (await refreshSignalsCore(db, a.id, { orgId, userId: "" })).added.length; }
    catch (e) { console.error("signal refresh failed", a.id, (e as Error).message); if (/créditos|saldo/.test((e as Error).message)) break; }
  }
  return { added };
}

/** New leads of the last two days not enriched yet (the hourly sweep behind the instant events). */

export { leadsToEnrich, enrichLead, followupStep } from "@/lib/inngest/lead-tasks.server";
export { runBackgroundJob } from "@/lib/inngest/job-runner.server";
