// Background work through Inngest, from the screens: start a long task and get a notice when it ends, and
// tell Inngest when a lead was created or moved (enrichment and the follow-up sequence with waits).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { EV, JOB_LABEL } from "@/lib/inngest/events";

export const backgroundStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { inngestReady } = await import("@/lib/inngest/send.server");
    return { ready: await inngestReady(supabaseAdmin) };
  });

const JobIn = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("battlecard"), input: z.object({ competitor: z.string().trim().min(2).max(200), max: z.number().int().min(5).max(40) }), label: z.string().max(200).optional() }),
  z.object({ kind: z.literal("stakeholder_research"), input: z.object({ stakeholderId: z.string().uuid() }), label: z.string().max(200).optional() }),
  z.object({ kind: z.literal("account_signals"), input: z.object({ accountId: z.string().uuid() }), label: z.string().max(200).optional() }),
  z.object({ kind: z.literal("complete_account"), input: z.object({ accountId: z.string().uuid() }), label: z.string().max(200).optional() }),
  z.object({ kind: z.literal("drive_import"), input: z.object({ file: z.string().trim().min(5).max(500), section: z.enum(["company", "objections", "playbooks", "methodology", "campaigns", "skills", "rules"]) }), label: z.string().max(200).optional() }),
]);

export const startBackgroundJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobIn.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    // The ids the task will touch must belong to this company (the job then runs with the admin client).
    if (data.kind === "stakeholder_research") { const { data: s } = await ctx.db.from("stakeholders").select("id").eq("org_id", ctx.orgId).eq("id", data.input.stakeholderId).maybeSingle(); if (!s) throw new Error("No encuentro esa persona en esta empresa."); }
    if (data.kind === "account_signals" || data.kind === "complete_account") { const { data: a } = await ctx.db.from("accounts").select("id").eq("org_id", ctx.orgId).eq("id", data.input.accountId).maybeSingle(); if (!a) throw new Error("No encuentro esa cuenta en esta empresa."); }
    const target = "accountId" in data.input ? { target_type: "account", target_id: data.input.accountId } : "stakeholderId" in data.input ? { target_type: "stakeholder", target_id: data.input.stakeholderId } : {};
    // A second click on the same task for the same record follows the one already running.
    if ("target_id" in target) {
      const { data: running } = await ctx.db.from("background_jobs").select("id,kind,target_id,status").eq("org_id", ctx.orgId).eq("kind", data.kind).eq("target_id", target.target_id).in("status", ["queued", "running"]).limit(1);
      if (running?.[0]) return { jobId: running[0].id, reused: true };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { inngestReady, sendEvents } = await import("@/lib/inngest/send.server");
    const ready = await inngestReady(supabaseAdmin);
    if (!ready && data.kind !== "complete_account") throw new Error("El segundo plano no está disponible ahora mismo. Hazlo de la forma normal.");
    const { data: job, error } = await ctx.db.from("background_jobs").insert({ kind: data.kind, input: data.input, ...target, label: (data.label ?? JOB_LABEL[data.kind]).slice(0, 300), org_id: ctx.orgId, user_id: ctx.userId }).select("id").single();
    if (error) throw new Error(error.message);
    if (ready) await sendEvents([{ name: EV.jobRequested, data: { job_id: job.id } }]);
    else {
      // Without Inngest the task runs in this request; the screen does not wait for it and the notice still arrives.
      const { runBackgroundJob } = await import("@/lib/inngest/tasks.server");
      await runBackgroundJob(supabaseAdmin, job.id).catch(() => undefined);
    }
    return { jobId: job.id, reused: false };
  });

/** After a lead is created or saved: enrichment for new ones, and start/stop the follow-up sequence. */
export const leadTouched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const { data: lead } = await ctx.db.from("leads").select("id,stage,contacted_at,enriched_at,created_at").eq("org_id", ctx.orgId).eq("id", data.leadId).maybeSingle();
    if (!lead) return { queued: false };
    const { leadEvents } = await import("@/lib/inngest/lead-events");
    const { inngestReady, trySend } = await import("@/lib/inngest/send.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (await inngestReady(supabaseAdmin)) return { queued: await trySend(leadEvents(ctx.orgId, lead)) };
    // Without Inngest the new lead goes through its flow right here (the screen does not wait for it).
    const { shouldRunFlow } = await import("@/lib/lead-flow");
    if (!shouldRunFlow(lead)) return { queued: false };
    const { enrichLead } = await import("@/lib/inngest/tasks.server");
    await enrichLead(supabaseAdmin, ctx.orgId, lead.id, new Date(), { trigger: "automatic" });
    return { queued: false, ran: true };
  });

/** «Pasar por el flujo»: a member runs (or repeats) the new-lead flow now and gets the steps back. */
export const runLeadFlowNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    // RLS read first: the lead must belong to the caller's company before the admin client touches it.
    const { data: lead } = await ctx.db.from("leads").select("id,stage").eq("org_id", ctx.orgId).eq("id", data.leadId).maybeSingle();
    if (!lead) throw new Error("No encuentro ese lead en esta empresa.");
    if (lead.stage === "opportunity") throw new Error("Ya es una oportunidad: el flujo de lead nuevo no aplica.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enrichLead } = await import("@/lib/inngest/tasks.server");
    return enrichLead(supabaseAdmin, ctx.orgId, lead.id, new Date(), { force: true, trigger: "manual", userId: ctx.userId });
  });
