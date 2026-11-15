// Server-only half of the background jobs launched from the screens (background.functions.ts imports it inside its
// handlers): who may launch a job, the company checks, creating the row and handing it to Inngest. It lives apart so the
// client bundle, which imports the server functions, never pulls getRequest or the admin client (NK-0095 build fix).
import type { userCtx } from "@/lib/agent.functions";
import type { JobArgs } from "@/lib/background.functions";
import { EV, JOB_LABEL } from "@/lib/inngest/events";

/** Company-wide tasks: one at a time per company, and only leadership may launch them. */
const ORG_WIDE = new Set([
  "discover",
  "autopilot_now",
  "weekly_report",
  "posthog_sync",
  "playbook_library",
]);
const LEADERS = ["owner", "sales_leader"];

type Ctx = Awaited<ReturnType<typeof userCtx>>;

/** Who may launch it and whether the records it will touch belong to this company (the job then runs with the admin client). */
export async function authorize(ctx: Ctx, data: JobArgs) {
  const has = (roles: string[]) => ctx.roles.some((r) => roles.includes(r));
  const inOrg = async (
    table: "accounts" | "stakeholders" | "gtm_artifacts" | "deals",
    id: string,
    what: string,
  ) => {
    const { data: row } = await ctx.db
      .from(table)
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("id", id)
      .maybeSingle();
    if (!row) throw new Error(`No encuentro ${what} en esta empresa.`);
  };
  if (ORG_WIDE.has(data.kind) && !has(LEADERS))
    throw new Error("Solo el Owner o el Sales Leader pueden lanzarlo.");
  // Reglas is what the whole team's agent obeys (NK-0095): refused before the job exists; the runner checks again.
  if (data.kind === "drive_import") {
    const { checkImportAllowed } = await import("@/lib/drive-core");
    checkImportAllowed(data.input.section, ctx.roles);
  }
  const i = data.input as Record<string, unknown>;
  if (typeof i.accountId === "string") await inOrg("accounts", i.accountId, "esa cuenta");
  if (typeof i.stakeholderId === "string")
    await inOrg("stakeholders", i.stakeholderId, "esa persona");
  if (typeof i.artifactId === "string") await inOrg("gtm_artifacts", i.artifactId, "ese documento");
  if (typeof i.dealId === "string") await inOrg("deals", i.dealId, "esa oportunidad");
  if (data.kind === "qualify_leads" && data.input.ids?.length) {
    const { data: rows } = await ctx.db
      .from("leads")
      .select("id")
      .eq("org_id", ctx.orgId)
      .in("id", data.input.ids);
    if ((rows ?? []).length !== data.input.ids.length)
      throw new Error("Algún lead no es de esta empresa.");
  }
  if (data.kind === "discover" && data.input.icpIds?.length) {
    const { data: rows } = await ctx.db
      .from("icp_profiles")
      .select("id")
      .eq("org_id", ctx.orgId)
      .in("id", data.input.icpIds);
    if ((rows ?? []).length !== data.input.icpIds.length)
      throw new Error("Algún ICP no es de esta empresa.");
  }
  if (data.kind === "debate") {
    const { canConvene, DEBATE_LEVELS } = await import("@/lib/bmad/teams");
    if (!(data.input.level in DEBATE_LEVELS)) throw new Error("Nivel no válido");
    if (!canConvene(data.input.level as never, ctx.roles))
      throw new Error("Tu rol no puede convocar este nivel de debate");
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
  if (data.kind === "drive_summaries")
    for (const d of data.input.docs)
      if (d.accountId) await inOrg("accounts", d.accountId, "esa cuenta");
}

function targetOf(data: JobArgs): { target_type?: string; target_id?: string } {
  const i = data.input as Record<string, unknown>;
  if (typeof i.accountId === "string") return { target_type: "account", target_id: i.accountId };
  if (typeof i.stakeholderId === "string")
    return { target_type: "stakeholder", target_id: i.stakeholderId };
  if (typeof i.artifactId === "string") return { target_type: "artifact", target_id: i.artifactId };
  return {};
}

async function onPublishedSite() {
  try {
    // Loaded lazily: the agent registry (also in the client graph) imports this module dynamically (E3 build fix).
    const { getRequest } = await import("@tanstack/react-start/server");
    return /(^|\.)nokko\.ai$|^seller-strategy-studio\.lovable\.app$/.test(
      new URL(getRequest().url).hostname,
    );
  } catch {
    return false;
  }
}

/** Creates the job and hands it to Inngest; without Inngest it runs in this request (the screen does not wait). */
export async function enqueue(ctx: Ctx, data: JobArgs, retryOf: string | null = null) {
  await authorize(ctx, data);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = targetOf(data);
  const paging = "prevJobId" in data.input && !!data.input.prevJobId;
  // A second click on the same task follows the one already running: same record, the whole company for
  // company-wide tasks, or the same person for the rest.
  if (!paging) {
    let q = supabaseAdmin
      .from("background_jobs")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("kind", data.kind)
      .in("status", ["queued", "running"]);
    if (target.target_id) q = q.eq("target_id", target.target_id);
    else if (!ORG_WIDE.has(data.kind)) q = q.eq("user_id", ctx.userId);
    if (target.target_id || ORG_WIDE.has(data.kind) || data.kind === "qualify_leads") {
      const { data: running } = await q.limit(1);
      if (running?.[0]) return { jobId: running[0].id, reused: true };
    }
  }
  const { inngestReady, sendEvents } = await import("@/lib/inngest/send.server");
  // Inngest calls the published site, so only the published site hands work to it; the preview runs its own code.
  const ready = (await onPublishedSite()) && (await inngestReady(supabaseAdmin));
  const { data: job, error } = await ctx.db
    .from("background_jobs")
    .insert({
      kind: data.kind,
      input: data.input as never,
      ...target,
      label: (data.label ?? JOB_LABEL[data.kind]).slice(0, 300),
      org_id: ctx.orgId,
      user_id: ctx.userId,
      retry_of: retryOf,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const sent = ready
    ? await sendEvents([{ name: EV.jobRequested, data: { job_id: job.id } }])
        .then(() => true)
        .catch(() => false)
    : false;
  if (!sent) {
    const { runBackgroundJob } = await import("@/lib/inngest/tasks.server");
    await runBackgroundJob(supabaseAdmin, job.id).catch(() => undefined);
  }
  return { jobId: job.id, reused: false };
}
