import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { digestMessage, urgentMessage } from "@/lib/telegram-suggestions";

const BATCH = 100;

export const Route = createFileRoute("/api/public/jobs/proactive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = (await request.json().catch(() => ({}))) as { kind?: string };
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

        // Single-flight lease.
        const lockName = `proactive:${body.kind ?? "hourly"}`;
        const now = new Date();
        await db.from("job_locks").upsert({ name: lockName }, { onConflict: "name", ignoreDuplicates: true });
        const { data: got } = await db.from("job_locks").update({ locked_until: new Date(now.getTime() + 5 * 60_000).toISOString() })
          .eq("name", lockName).or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`).select("name");
        if (!got?.length) return Response.json({ skipped: "locked" });

        try {
          if (body.kind === "digest") return Response.json(await sendDigests(db));
          // Telegram notices held by someone's night silence go out once it ends.
          { const { flushHeldNotices } = await import("@/lib/notices.server"); await flushHeldNotices(db, now); }
          const { data: orgs } = await db.from("organizations").select("id").is("archived_at", null).order("created_at").limit(BATCH);
          // Inngest answers a ping each hour; while its heartbeat is fresh, each company runs as its own
          // background job with retries (one failing company never blocks the rest). Otherwise, inline as before.
          const { EV, hourKey } = await import("@/lib/inngest/events");
          const { inngestReady, sendEvents, trySend } = await import("@/lib/inngest/send.server");
          await trySend([{ name: EV.ping, data: { at: now.toISOString() } }]);
          if (await inngestReady(db, now)) {
            const queued = await sendEvents((orgs ?? []).map((o) => ({ name: EV.orgMaintenance, data: { org_id: o.id, hour: hourKey(now) } }))).then(() => true).catch((e) => { console.error("inngest dispatch failed", e); return false; });
            if (queued) {
              await notifyUrgent(db);
              const { runWeeklyReports } = await import("@/lib/weekly-report.server");
              const weekly = await runWeeklyReports(db, now).catch((e) => { console.error("weekly reports failed", e); return null; });
              const daily = await runDaily(db, now);
              return Response.json({ orgs: orgs?.length ?? 0, mode: "background", weekly, daily });
            }
          }
          const { loadSnapshot, syncSuggestions } = await import("@/lib/org-data");
          const { detect } = await import("@/lib/proactive");
          let total = 0;
          for (const o of orgs ?? []) {
            try {
              const found = detect(await loadSnapshot(db, o.id));
              await syncSuggestions(db, o.id, found);
              total += found.length;
            } catch (e) { console.error("proactive org failed", o.id, e); }
          }
          // New leads through their flow (account, company data, key people, AI proposal): a few per company and run.
          const { leadsToEnrich, enrichLead } = await import("@/lib/inngest/tasks.server");
          let leadFlows = 0;
          for (const o of orgs ?? []) {
            for (const id of await leadsToEnrich(db, o.id, now, 3).catch(() => [] as string[])) {
              try { await enrichLead(db, o.id, id, now); leadFlows++; } catch (e) { console.error("lead flow failed", id, e); }
            }
          }
          // Autopilot: research new accounts, prepare tomorrow's meetings, review cooling accounts (bounded per company).
          const { autopilotForOrg } = await import("@/lib/autopilot.server");
          for (const o of orgs ?? []) {
            try { const r = await autopilotForOrg(db, o.id, now); const { notifyAutopilot } = await import("@/lib/notices.server"); await notifyAutopilot(db, o.id, r, now); } catch (e) { console.error("autopilot failed", o.id, e); }
          }
          // «Descubiertos»: each company's weekly search (self-guarded, at most one company per run inline).
          const { discoverForOrg } = await import("@/lib/discoveries.server");
          for (const o of orgs ?? []) {
            try { const r = await discoverForOrg(db, o.id, now); if (!r.skipped) break; } catch (e) { console.error("discoveries failed", o.id, e); }
          }
          await notifyUrgent(db);
          // Monday morning: this week's pipeline report for every company (idempotent, once per week).
          const { runWeeklyReports } = await import("@/lib/weekly-report.server");
          const weekly = await runWeeklyReports(db, now).catch((e) => { console.error("weekly reports failed", e); return null; });
          // Stripe: every connected company, at most every few hours.
          const { runStripeSyncs } = await import("@/lib/stripe/sync.server");
          const stripe = await runStripeSyncs(db, now).catch((e) => { console.error("stripe syncs failed", e); return null; });
          // News signals (Firecrawl) for a few ABM target accounts per run, each at most weekly.
          const { runSignalRefresh } = await import("@/lib/web-research-core");
          const signals = await runSignalRefresh(db, now).catch((e) => { console.error("signal refresh failed", e); return null; });
          // Each company's PostHog (product usage and sign-ups), at most every few hours.
          const { runPosthogSyncs } = await import("@/lib/posthog-sync.server");
          const posthog = await runPosthogSyncs(db, now).catch((e) => { console.error("posthog syncs failed", e); return null; });
          const daily = await runDaily(db, now);
          return Response.json({ orgs: orgs?.length ?? 0, mode: "inline", detected: total, leadFlows, weekly, stripe, signals, posthog, daily });
        } finally {
          await db.from("job_locks").update({ locked_until: null, last_run_at: new Date().toISOString() }).eq("name", lockName);
        }
      },
    },
  },
});

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Each person's daily briefing email at their hour (8:00 local by default), once per day. */
async function runDaily(db: Admin, now: Date) {
  const { runDailyEmails } = await import("@/lib/daily-email.server");
  return runDailyEmails(db, now).catch((e) => { console.error("daily emails failed", e); return null; });
}

/** Pushes new priority-1 suggestions to linked Telegram users (once per suggestion). */
async function notifyUrgent(db: Admin) {
  const { telegramConfigured, sendText } = await import("@/lib/telegram.server");
  if (!telegramConfigured()) return;
  const { data: links } = await db.from("channel_links").select("user_id,chat_id").eq("channel", "telegram").not("chat_id", "is", null);
  for (const l of links ?? []) {
    const { data: prof } = await db.from("profiles").select("current_org_id").eq("id", l.user_id).maybeSingle();
    if (!prof?.current_org_id) continue;
    const { data: urgent } = await db.from("suggestions").select("id,title,body,action,strategy").eq("org_id", prof.current_org_id).eq("status", "pending").eq("priority", 1).is("notified_at", null).or(`user_id.is.null,user_id.eq.${l.user_id}`).limit(3);
    // «Te han asignado N cuentas» goes to its person too, though it is not urgent.
    const { data: assigned } = await db.from("suggestions").select("id,title,body,action,strategy").eq("org_id", prof.current_org_id).eq("status", "pending").eq("detector", "account_assigned").eq("user_id", l.user_id).is("notified_at", null).limit(3);
    for (const s of [...(urgent ?? []), ...(assigned ?? [])]) {
      try {
        const m = urgentMessage(s);
        await sendText(l.chat_id!, m.text, m.buttons);
        await db.from("suggestions").update({ notified_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e) { console.error("notify failed", e); }
    }
  }
}

/** Daily digest: top 3 pending suggestions per linked user. */
async function sendDigests(db: Admin) {
  const { telegramConfigured, sendText } = await import("@/lib/telegram.server");
  const { digest } = await import("@/lib/proactive");
  if (!telegramConfigured()) return { sent: 0, reason: "telegram not connected" };
  const { data: links } = await db.from("channel_links").select("user_id,chat_id").eq("channel", "telegram").eq("daily_digest", true).not("chat_id", "is", null);
  let sent = 0;
  for (const l of links ?? []) {
    const { data: prof } = await db.from("profiles").select("current_org_id,full_name").eq("id", l.user_id).maybeSingle();
    if (!prof?.current_org_id) continue;
    const { data: items } = await db.from("suggestions").select("id,title,priority,created_at,strategy").eq("org_id", prof.current_org_id).eq("status", "pending").or(`user_id.is.null,user_id.eq.${l.user_id}`).limit(50);
    const top = digest(items ?? [], 3);
    const name = prof.full_name?.split(" ")[0] ?? "";
    const m = digestMessage(top, name);
    try {
      await sendText(l.chat_id!, m.text, m.buttons);
      sent++;
    } catch (e) { console.error("digest failed", e); }
  }
  return { sent };
}
