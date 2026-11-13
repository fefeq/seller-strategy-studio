// Nokko's Inngest functions and the serve handler, built on the first request (env is read then, never at
// module scope). Each step is retried on its own, so one failing company or provider does not stop the rest.
import { Inngest } from "inngest";
import { serve } from "inngest/edge";
import { EV } from "@/lib/inngest/events";

let handler: ((req: Request) => Promise<Response>) | null = null;
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const DAY = 86_400_000;

function build() {
  const inngest = new Inngest({ id: "nokko", signingKey: process.env["INNGEST_SIGNING_KEY"], isDev: false });

  const ping = inngest.createFunction({ id: "heartbeat", triggers: [{ event: EV.ping }], retries: 1 }, async ({ step }) => {
    await step.run("mark", async () => { const { markHeartbeat } = await import("@/lib/inngest/send.server"); await markHeartbeat(await admin()); });
  });

  const orgMaintenance = inngest.createFunction(
    { id: "org-maintenance", triggers: [{ event: EV.orgMaintenance }], retries: 3, concurrency: { limit: 5 }, idempotency: "event.data.org_id + '-' + event.data.hour" },
    async ({ event, step }) => {
      const orgId = event.data.org_id as string;
      const t = await import("@/lib/inngest/tasks.server");
      const suggestions = await step.run("suggestions", async () => t.maintainSuggestions(await admin(), orgId));
      const stripe = await step.run("stripe", async () => t.maintainStripe(await admin(), orgId));
      const posthog = await step.run("posthog", async () => t.maintainPosthog(await admin(), orgId));
      const signals = await step.run("signals", async () => t.maintainSignals(await admin(), orgId));
      const discoveries = await step.run("discoveries", async () => { const { discoverForOrg } = await import("@/lib/discoveries.server"); return discoverForOrg(await admin(), orgId); });
      const autopilot = await step.run("autopilot", async () => {
        const { autopilotForOrg } = await import("@/lib/autopilot.server");
        const db = await admin();
        const r = await autopilotForOrg(db, orgId);
        const { notifyAutopilot } = await import("@/lib/notices.server");
        await notifyAutopilot(db, orgId, r);
        // Durable step output is persisted by Inngest: never return private notes or spread the core result.
        return { researched: r.researched, prepped: r.prepped, cooling: r.cooling, noteCount: r.notes.length };
      });
      const leads = await step.run("leads-to-enrich", async () => t.leadsToEnrich(await admin(), orgId));
      if (leads.length) await step.run("queue-enrichment", async () => { const { sendEvents } = await import("@/lib/inngest/send.server"); await sendEvents(leads.map((id) => ({ name: EV.leadCreated, data: { org_id: orgId, lead_id: id } }))); });
      return { suggestions, stripe, posthog, signals, discoveries: discoveries.skipped ?? discoveries.added, autopilot, leads: leads.length };
    },
  );

  const leadEnrich = inngest.createFunction(
    { id: "lead-enrich", triggers: [{ event: EV.leadCreated }], retries: 2, concurrency: { limit: 2, key: "event.data.org_id" }, idempotency: "event.data.lead_id" },
    async ({ event, step }) => {
      await step.sleep("let-the-lead-settle", "1m"); // the person may still be editing the lead
      return step.run("enrich", async () => { const { enrichLead } = await import("@/lib/inngest/tasks.server"); return enrichLead(await admin(), event.data.org_id as string, event.data.lead_id as string); });
    },
  );

  const followup = inngest.createFunction(
    {
      id: "lead-followup", triggers: [{ event: EV.leadContacted }], retries: 2, idempotency: "event.data.lead_id + '-' + event.data.contacted_at",
      // Any move out of Contactado (or a new contact date) ends this sequence.
      cancelOn: [{ event: EV.leadChanged, if: "async.data.lead_id == event.data.lead_id && async.data.stage != 'contacted'" }, { event: EV.leadContacted, if: "async.data.lead_id == event.data.lead_id && async.data.contacted_at != event.data.contacted_at" }],
    },
    async ({ event, step }) => {
      const start = new Date(event.data.contacted_at as string).getTime();
      for (const day of [3, 7, 14, 21]) {
        await step.sleepUntil(`day-${day}`, new Date(start + day * DAY + 9 * 3_600_000));
        const r = await step.run(`step-day-${day}`, async () => { const { followupStep } = await import("@/lib/inngest/tasks.server"); return followupStep(await admin(), event.data.org_id as string, event.data.lead_id as string); });
        if (r.stop) return { stoppedAt: day };
      }
      return { done: true };
    },
  );

  const backgroundJob = inngest.createFunction(
    { id: "background-job", triggers: [{ event: EV.jobRequested }], retries: 2, concurrency: { limit: 4 }, idempotency: "event.data.job_id" },
    // Only the last attempt (retries: 2 → attempts 0, 1, 2) writes «failed», so a retried job leaves a single notice.
    async ({ event, step, attempt }) => step.run("run", async () => { const { runBackgroundJob } = await import("@/lib/inngest/tasks.server"); return runBackgroundJob(await admin(), event.data.job_id as string, { final: attempt >= 2 }); }),
  );

  // Parallel research runs take minutes: checked every 30 s until done, so results land with nobody watching.
  const parallelRun = inngest.createFunction(
    { id: "parallel-run", triggers: [{ event: EV.parallelRun }], retries: 2, idempotency: "event.data.research_id" },
    async ({ event, step }) => {
      for (let i = 0; i < 120; i++) {
        await step.sleep(`wait-${i}`, i < 4 ? "30s" : "60s");
        const r = await step.run(`check-${i}`, async () => { const { checkRun } = await import("@/lib/parallel-core"); return checkRun(null, event.data.research_id as string); });
        if (r.status !== "running") return r;
      }
      return { status: "timeout" };
    },
  );

  // Independent function on the same authenticated maintenance event: retries/denials of a custom play
  // cannot change the existing org-maintenance contract or replay unrelated automatic work.
  const customPlayMaintenance = inngest.createFunction(
    { id: "custom-play-maintenance", triggers: [{ event: EV.orgMaintenance }], retries: 0, concurrency: { limit: 1, key: "event.data.org_id" }, idempotency: "event.data.org_id + '-' + event.data.hour" },
    async ({ event, step }) => step.run("custom-plays", async () => {
      const { runActiveCustomPlays } = await import("@/lib/plays/custom/adapters.server");
      const r = await runActiveCustomPlays(await admin(), event.data.org_id as string);
      return { runs: r.runs, evidenceCount: r.evidenceCount, suggestionCount: r.suggestionCount, paused: r.paused };
    }),
  );
  return serve({ client: inngest, functions: [ping, orgMaintenance, customPlayMaintenance, leadEnrich, followup, backgroundJob, parallelRun], servePath: "/api/public/inngest" });
}

export function inngestHandler() {
  handler ??= build();
  return handler;
}
