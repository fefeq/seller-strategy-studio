// Background work through Inngest, from the screens: start a long task and get a notice when it ends, and
// tell Inngest when a lead was created or moved (enrichment and the follow-up sequence with waits).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

const label = z.string().max(200).optional();
const uuid = z.string().uuid();
const words = z.array(z.string().trim().min(1).max(120)).max(15).default([]);
const Cursor = z.union([
  z.object({ service: z.literal("apollo"), page: z.number().int().min(1).max(100) }),
  z.object({ service: z.literal("clay"), searchId: z.string().regex(/^[A-Za-z0-9_-]{4,80}$/) }),
]).nullable().optional();
const none = z.object({}).default({});

const JobIn = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("battlecard"), input: z.object({ competitor: z.string().trim().min(2).max(200), max: z.number().int().min(5).max(40) }), label }),
  z.object({ kind: z.literal("stakeholder_research"), input: z.object({ stakeholderId: uuid }), label }),
  z.object({ kind: z.literal("account_signals"), input: z.object({ accountId: uuid }), label }),
  z.object({ kind: z.literal("complete_account"), input: z.object({ accountId: uuid }), label }),
  z.object({ kind: z.literal("drive_import"), input: z.object({ file: z.string().trim().min(5).max(500), section: z.enum(["company", "objections", "playbooks", "methodology", "campaigns", "skills", "rules"]) }), label }),
  z.object({ kind: z.literal("key_people"), input: z.object({ accountId: uuid, titles: words, levels: z.array(z.string().max(20)).max(10).default([]), cursor: Cursor, prevJobId: uuid.optional() }), label }),
  z.object({ kind: z.literal("icp_companies"), input: z.object({ query: z.object({ keywords: words, countries: words, minEmployees: z.number().int().min(1).nullable().optional(), maxEmployees: z.number().int().min(1).nullable().optional() }), cursor: Cursor, prevJobId: uuid.optional() }), label }),
  z.object({ kind: z.literal("qualify_leads"), input: z.object({ ids: z.array(uuid).max(25).optional() }), label }),
  z.object({ kind: z.literal("discover"), input: none, label }),
  z.object({ kind: z.literal("autopilot_now"), input: none, label }),
  z.object({ kind: z.literal("weekly_report"), input: none, label }),
  z.object({ kind: z.literal("posthog_sync"), input: none, label }),
  z.object({ kind: z.literal("playbook_library"), input: none, label }),
  z.object({ kind: z.literal("debate"), input: z.object({ level: z.string().max(40), topic: z.string().trim().min(1).max(2000), subjectType: z.enum(["deal", "account", "artifact"]).nullable().optional(), subjectId: uuid.nullable().optional(), participants: z.array(z.string().max(60)).max(20).default([]) }), label }),
  z.object({ kind: z.literal("draft_artifact"), input: z.object({ kind: z.string().max(60), notes: z.string().max(6000).default(""), dealId: uuid.nullable().optional() }), label }),
  z.object({ kind: z.literal("deep_review"), input: z.object({ artifactId: uuid, method: z.string().max(40) }), label }),
  z.object({ kind: z.literal("account_research"), input: z.object({ accountId: uuid }), label }),
  z.object({ kind: z.literal("onboarding_read"), input: z.object({
    depth: z.enum(["express", "standard", "deep"]),
    url: z.string().trim().max(500).default(""),
    text: z.string().max(40_000).default(""),
    files: z.array(z.object({ filename: z.string().max(200), dataUrl: z.string().startsWith("data:").max(6_000_000) })).max(3).default([]),
  }).refine((i) => i.url || i.text.trim() || i.files.length, "Añade una web, texto o un documento"), label }),
  z.object({ kind: z.literal("drive_summaries"), input: z.object({ docs: z.array(z.object({ fileId: z.string().regex(/^[A-Za-z0-9_-]{5,200}$/), accountId: uuid.nullable() })).min(1).max(30) }), label }),
]);
export type JobArgs = z.infer<typeof JobIn>;

/** Company-wide tasks: one at a time per company, and only leadership may launch them. */
const ORG_WIDE = new Set(["discover", "autopilot_now", "weekly_report", "posthog_sync", "playbook_library"]);
const LEADERS = ["owner", "sales_leader"];

type Ctx = Awaited<ReturnType<typeof userCtx>>;

/** Who may launch it and whether the records it will touch belong to this company (the job then runs with the admin client). */
async function authorize(ctx: Ctx, data: JobArgs) {
  const has = (roles: string[]) => ctx.roles.some((r) => roles.includes(r));
  const inOrg = async (table: "accounts" | "stakeholders" | "gtm_artifacts" | "deals", id: string, what: string) => {
    const { data: row } = await ctx.db.from(table).select("id").eq("org_id", ctx.orgId).eq("id", id).maybeSingle();
    if (!row) throw new Error(`No encuentro ${what} en esta empresa.`);
  };
  if (ORG_WIDE.has(data.kind) && !has(LEADERS)) throw new Error("Solo el Owner o el Sales Leader pueden lanzarlo.");
  const i = data.input as Record<string, unknown>;
  if (typeof i.accountId === "string") await inOrg("accounts", i.accountId, "esa cuenta");
  if (typeof i.stakeholderId === "string") await inOrg("stakeholders", i.stakeholderId, "esa persona");
  if (typeof i.artifactId === "string") await inOrg("gtm_artifacts", i.artifactId, "ese documento");
  if (typeof i.dealId === "string") await inOrg("deals", i.dealId, "esa oportunidad");
  if (data.kind === "qualify_leads" && data.input.ids?.length) {
    const { data: rows } = await ctx.db.from("leads").select("id").eq("org_id", ctx.orgId).in("id", data.input.ids);
    if ((rows ?? []).length !== data.input.ids.length) throw new Error("Algún lead no es de esta empresa.");
  }
  if (data.kind === "debate") {
    const { canConvene, DEBATE_LEVELS } = await import("@/lib/bmad/teams");
    if (!(data.input.level in DEBATE_LEVELS)) throw new Error("Nivel no válido");
    if (!canConvene(data.input.level as never, ctx.roles)) throw new Error("Tu rol no puede convocar este nivel de debate");
    if (data.input.subjectId && data.input.subjectType) {
      const t = { deal: "deals", account: "accounts", artifact: "gtm_artifacts" } as const;
      await inOrg(t[data.input.subjectType], data.input.subjectId, "ese tema");
    }
  }
  if (data.kind === "draft_artifact") {
    const { ARTIFACTS } = await import("@/lib/bmad/workflows");
    if (!(data.input.kind in ARTIFACTS)) throw new Error("Tipo de documento no válido");
  }
  if (data.kind === "deep_review") {
    const { REVIEW_METHOD_TEXT } = await import("@/lib/bmad/debate-core");
    if (!REVIEW_METHOD_TEXT[data.input.method]) throw new Error("Método no válido");
  }
  if (data.kind === "drive_summaries") for (const d of data.input.docs) if (d.accountId) await inOrg("accounts", d.accountId, "esa cuenta");
}

function targetOf(data: JobArgs): { target_type?: string; target_id?: string } {
  const i = data.input as Record<string, unknown>;
  if (typeof i.accountId === "string") return { target_type: "account", target_id: i.accountId };
  if (typeof i.stakeholderId === "string") return { target_type: "stakeholder", target_id: i.stakeholderId };
  if (typeof i.artifactId === "string") return { target_type: "artifact", target_id: i.artifactId };
  return {};
}

function onPublishedSite() {
  try { return /(^|\.)nokko\.ai$|^seller-strategy-studio\.lovable\.app$/.test(new URL(getRequest().url).hostname); } catch { return false; }
}

/** Creates the job and hands it to Inngest; without Inngest it runs in this request (the screen does not wait). */
async function enqueue(ctx: Ctx, data: JobArgs, retryOf: string | null = null) {
  await authorize(ctx, data);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = targetOf(data);
  const paging = "prevJobId" in data.input && !!data.input.prevJobId;
  // A second click on the same task follows the one already running: same record, the whole company for
  // company-wide tasks, or the same person for the rest.
  if (!paging) {
    let q = supabaseAdmin.from("background_jobs").select("id").eq("org_id", ctx.orgId).eq("kind", data.kind).in("status", ["queued", "running"]);
    if (target.target_id) q = q.eq("target_id", target.target_id);
    else if (!ORG_WIDE.has(data.kind)) q = q.eq("user_id", ctx.userId);
    if (target.target_id || ORG_WIDE.has(data.kind) || data.kind === "qualify_leads") {
      const { data: running } = await q.limit(1);
      if (running?.[0]) return { jobId: running[0].id, reused: true };
    }
  }
  const { inngestReady, sendEvents } = await import("@/lib/inngest/send.server");
  // Inngest calls the published site, so only the published site hands work to it; the preview runs its own code.
  const ready = onPublishedSite() && (await inngestReady(supabaseAdmin));
  const { data: job, error } = await ctx.db.from("background_jobs").insert({ kind: data.kind, input: data.input as never, ...target, label: (data.label ?? JOB_LABEL[data.kind]).slice(0, 300), org_id: ctx.orgId, user_id: ctx.userId, retry_of: retryOf }).select("id").single();
  if (error) throw new Error(error.message);
  const sent = ready ? await sendEvents([{ name: EV.jobRequested, data: { job_id: job.id } }]).then(() => true).catch(() => false) : false;
  if (!sent) {
    const { runBackgroundJob } = await import("@/lib/inngest/tasks.server");
    await runBackgroundJob(supabaseAdmin, job.id).catch(() => undefined);
  }
  return { jobId: job.id, reused: false };
}

export const startBackgroundJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobIn.parse(d))
  .handler(async ({ data, context }) => enqueue(await userCtx(context.supabase as Db, context.userId), data));

/** «Cancelar»: a queued job never starts; a running one stops at its next step (what it already did stays). */
export const cancelBackgroundJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    // RLS: a person only reads (and so only cancels) their own jobs.
    const { data: job } = await ctx.db.from("background_jobs").select("id,status").eq("id", data.jobId).eq("user_id", ctx.userId).maybeSingle();
    if (!job) throw new Error("No encuentro esa tarea.");
    if (!["queued", "running"].includes(job.status)) return { status: job.status };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (job.status === "queued") await supabaseAdmin.from("background_jobs").update({ status: "cancelled", cancel_requested: true, finished_at: new Date().toISOString() }).eq("id", job.id).eq("status", "queued");
    else await supabaseAdmin.from("background_jobs").update({ cancel_requested: true, step: "Cancelando…" }).eq("id", job.id);
    return { status: job.status === "queued" ? "cancelled" : "cancelling" };
  });

/** «Reintentar» a failed or cancelled job with the same input. */
export const retryBackgroundJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const { data: job } = await ctx.db.from("background_jobs").select("id,kind,input,label,status,org_id").eq("id", data.jobId).eq("user_id", ctx.userId).maybeSingle();
    if (!job) throw new Error("No encuentro esa tarea.");
    if (job.org_id !== ctx.orgId) throw new Error("Esa tarea es de otra empresa: cambia a ella para reintentarla.");
    if (!["failed", "cancelled"].includes(job.status)) throw new Error("Solo se reintenta lo que falló o se canceló.");
    const args = JobIn.parse({ kind: job.kind, input: job.input, label: job.label || undefined });
    return enqueue(ctx, args, job.id);
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
