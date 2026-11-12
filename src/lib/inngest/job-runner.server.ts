// Runs one background_jobs row: picks the work by kind, reports steps, stores the result and notifies. Admin client, always filtered by company.
import type { Database } from "@/integrations/supabase/types";
import { JOB_LABEL, type JobKind } from "@/lib/inngest/events";
import type { Cursor } from "@/lib/orchestrator/search";
import type { DebateLevel } from "@/lib/bmad/teams";
import type { ArtifactKind } from "@/lib/bmad/workflows";
import type { Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<Database>;

// ---------------- Background jobs ----------------

class Cancelled extends Error {
  constructor() {
    super("cancelled");
  }
}

export type Job = Database["public"]["Tables"]["background_jobs"]["Row"];

// Job input was validated with zod (JobIn) when it was enqueued; these readers only narrow it back from jsonb.
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const cursorOf = (v: unknown): Cursor | null => (v && typeof v === "object" ? (v as Cursor) : null);

/** The launcher's context, rebuilt with the admin client (every core filters by the company). */
async function jobCtx(db: Admin, job: Job) {
  const [{ data: org }, { data: roles }] = await Promise.all([
    db
      .from("organizations")
      .select("name,company_name,currency")
      .eq("id", job.org_id)
      .maybeSingle(),
    db.from("org_members").select("role").eq("org_id", job.org_id).eq("user_id", job.user_id),
  ]);
  if (!roles?.length) throw new Error("Ya no perteneces a esta empresa.");
  return {
    db,
    orgId: job.org_id,
    userId: job.user_id,
    roles: roles.map((r) => r.role as string),
    currency: org?.currency ?? "EUR",
    orgName: org?.company_name?.trim() || org?.name || "tu empresa",
  };
}

/**
 * Runs one background job and leaves its result (title, body, link and whatever the screen needs) on the row; a
 * trigger turns the end into a notice and Telegram follows each person's preference. A cancelled job stops at
 * the next step. Only the last attempt writes «failed», so retries do not pile up notices.
 */
export async function runBackgroundJob(db: Admin, jobId: string, opts: { final?: boolean } = {}) {
  const final = opts.final ?? true;
  const { data: job } = await db.from("background_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job || job.status === "done" || job.status === "cancelled") return { skipped: true };
  if (job.cancel_requested) {
    await db
      .from("background_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", jobId);
    return { cancelled: true };
  }
  await db.from("background_jobs").update({ status: "running" }).eq("id", jobId);
  const step = async (s: string) => {
    const { data: j } = await db
      .from("background_jobs")
      .update({ step: s.slice(0, 200) })
      .eq("id", jobId)
      .select("cancel_requested")
      .maybeSingle();
    if (j?.cancel_requested) throw new Cancelled();
  };
  const scope = { orgId: job.org_id, userId: job.user_id };
  const input = (job.input ?? {}) as Record<string, unknown>;
  const now = new Date();
  try {
    const result = await runKind(db, job, input, scope, step, now);
    await step("Terminando");
    await db
      .from("background_jobs")
      .update({
        status: "done",
        result: result as unknown as Json,
        step: null,
        finished_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", jobId);
    const { deliverJobNotice } = await import("@/lib/notices.server");
    await deliverJobNotice(db, jobId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Cancelled) {
      await db
        .from("background_jobs")
        .update({ status: "cancelled", step: null, finished_at: new Date().toISOString() })
        .eq("id", jobId);
      return { cancelled: true };
    }
    const { errorText } = await import("@/lib/errors");
    // Never the error's text: it may quote a prompt with the team's rules (SDD-20261109-rules-in-ai-readers, CA-6).
    const { safeErrorLog } = await import("@/lib/agent/safe-error-log");
    console.error("background job failed", job.kind, safeErrorLog(e));
    if (!final) {
      await db.from("background_jobs").update({ step: "Reintentando…" }).eq("id", jobId);
      throw e;
    }
    const { jobLink } = await import("@/lib/jobs");
    await db
      .from("background_jobs")
      .update({
        status: "failed",
        step: null,
        error: errorText(e),
        result: { link: jobLink(job.kind, input) },
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    const { deliverJobNotice } = await import("@/lib/notices.server");
    await deliverJobNotice(db, jobId);
    throw e;
  }
}

export type Result = {
  title: string;
  body?: string | null;
  link: string;
  needs_decision?: boolean;
  [k: string]: unknown;
};

async function runKind(
  db: Admin,
  job: Job,
  input: Record<string, unknown>,
  scope: { orgId: string; userId: string },
  step: (s: string) => Promise<void>,
  now: Date,
): Promise<Result> {
  switch (job.kind as JobKind) {
    case "battlecard": {
      const { battlecardCore } = await import("@/lib/apify-core");
      await step("Leyendo reseñas");
      const b = await battlecardCore(db, String(input.competitor), Number(input.max) || 20, scope);
      const { data, error } = await db
        .from("knowledge_docs")
        .insert({
          org_id: job.org_id,
          section: "objections",
          title: b.title,
          body: b.markdown,
          scope: "team",
          created_by: job.user_id,
          updated_by: job.user_id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        title: `${b.title} guardada en Objeciones y battlecards`,
        link: `/hub?doc=${data.id}`,
      };
    }
    case "stakeholder_research": {
      const { researchStakeholderCore } = await import("@/lib/ai-core");
      const { data: s } = await db
        .from("stakeholders")
        .select("account_id")
        .eq("org_id", job.org_id)
        .eq("id", String(input.stakeholderId))
        .maybeSingle();
      if (!s) throw new Error("No encuentro esa persona en esta empresa.");
      await step("Investigando");
      const r = await researchStakeholderCore(db, String(input.stakeholderId), scope);
      // A failed read of the rules is said in the notice (CA-5); with a correct read the result is today's.
      const { RULES_READ_FAILED } = await import("@/lib/knowledge-rules");
      return {
        title: `Research de ${r.name} listo`,
        ...(r.rulesRead ? {} : { body: RULES_READ_FAILED }),
        link: `/accounts/${s.account_id}?tab=stakeholders`,
      };
    }
    case "account_signals": {
      const { refreshSignalsCore } = await import("@/lib/web-research-core");
      await step("Buscando novedades");
      const r = await refreshSignalsCore(db, String(input.accountId), scope);
      return {
        title: r.added.length
          ? `${r.added.length} ${r.added.length === 1 ? "novedad nueva" : "novedades nuevas"} en la cuenta`
          : "Sin novedades con interés comercial en el último mes",
        link: `/accounts/${input.accountId}?tab=signals`,
      };
    }
    case "drive_import": {
      const { importToKnowledge } = await import("@/lib/drive-core");
      // The launcher's roles as they are now (admin client, no RLS): Reglas only for the Owner or a Sales Leader (NK-0095).
      const c = await jobCtx(db, job);
      await step("Importando");
      const r = await importToKnowledge(
        { db, orgId: job.org_id, userId: job.user_id },
        String(input.file),
        String(input.section),
        c.roles,
      );
      return { title: `«${r.title}» importado al hub`, link: `/hub?doc=${r.docId}` };
    }
    case "complete_account": {
      const accountId = String(input.accountId);
      const { data: acc } = await db
        .from("accounts")
        .select("id,name")
        .eq("org_id", job.org_id)
        .eq("id", accountId)
        .maybeSingle();
      if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
      const c = await jobCtx(db, job);
      const { completeAccount, applyAutoChanges } = await import("@/lib/orchestrator/runner");
      const { completeNotice } = await import("@/lib/jobs");
      await step("Buscando datos");
      const out = await completeAccount(c, accountId, "manual");
      await step("Guardando");
      const written = out.blocked
        ? []
        : await applyAutoChanges(c, accountId, out.changes, now.toISOString());
      return {
        ...completeNotice(acc, out, written),
        review: out.changes.filter((ch) => !ch.empty && ch.proposed),
      };
    }
    case "key_people": {
      const accountId = String(input.accountId);
      const { data: acc } = await db
        .from("accounts")
        .select("id,name")
        .eq("org_id", job.org_id)
        .eq("id", accountId)
        .maybeSingle();
      if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
      const c = await jobCtx(db, job);
      const { findKeyPeople } = await import("@/lib/orchestrator/runner");
      const { peopleNotice, appendRows } = await import("@/lib/jobs");
      await step("Buscando personas");
      const out = await findKeyPeople(
        c,
        {
          accountId,
          titles: strs(input.titles),
          levels: strs(input.levels),
          cursor: cursorOf(input.cursor),
        },
        "manual",
      );
      const prev = input.prevJobId
        ? ((
            await db
              .from("background_jobs")
              .select("result")
              .eq("org_id", job.org_id)
              .eq("id", String(input.prevJobId))
              .maybeSingle()
          ).data?.result as { search?: { rows: typeof out.rows } } | null)
        : null;
      const rows = prev?.search?.rows
        ? appendRows(prev.search.rows, out.rows, (r) => r.key)
        : out.rows;
      const search = { ...out, rows };
      return {
        ...peopleNotice(acc, { ...out, rows: input.prevJobId ? out.rows : rows }),
        search,
        criteria: { titles: input.titles ?? [], levels: input.levels ?? [] },
      };
    }
    case "icp_companies": {
      const c = await jobCtx(db, job);
      const { findIcpCompanies } = await import("@/lib/orchestrator/runner");
      const { companiesNotice, appendRows } = await import("@/lib/jobs");
      await step("Buscando empresas");
      const out = await findIcpCompanies(
        c,
        {
          query: (input.query ?? {}) as Parameters<typeof findIcpCompanies>[1]["query"],
          cursor: cursorOf(input.cursor),
        },
        "manual",
      );
      const prev = input.prevJobId
        ? ((
            await db
              .from("background_jobs")
              .select("result")
              .eq("org_id", job.org_id)
              .eq("id", String(input.prevJobId))
              .maybeSingle()
          ).data?.result as { search?: { rows: typeof out.rows } } | null)
        : null;
      const rows = prev?.search?.rows
        ? appendRows(prev.search.rows, out.rows, (r) => r.domain ?? r.name)
        : out.rows;
      return {
        ...companiesNotice({ ...out, rows: input.prevJobId ? out.rows : rows }),
        search: { ...out, rows },
        query: input.query ?? {},
      };
    }
    case "qualify_leads": {
      const { qualifyLeadCore } = await import("@/lib/lead-qualify.server");
      const { JevError } = await import("@/lib/jev.server");
      const { errorText } = await import("@/lib/errors");
      const qual = await import("@/lib/lead-qualification");
      const { qualifyNotice } = await import("@/lib/jobs");
      let ids: string[] = Array.isArray(input.ids) ? input.ids.map(String).slice(0, 25) : [];
      if (!ids.length) {
        const { data: rows } = await db
          .from("leads")
          .select("id")
          .eq("org_id", job.org_id)
          .is("qualified_at", null)
          .in("stage", ["new", "contacted", "mql", "sql"])
          .order("created_at", { ascending: false })
          .limit(25);
        ids = (rows ?? []).map((r) => r.id);
      }
      const { data: st } = await db
        .from("lead_settings")
        .select("qualification")
        .eq("org_id", job.org_id)
        .maybeSingle();
      const settings = qual.readQualSettings(st?.qualification);
      const { data: stages } = ids.length
        ? await db.from("leads").select("id,stage").eq("org_id", job.org_id).in("id", ids)
        : { data: [] as { id: string; stage: string }[] };
      const stageOf = new Map((stages ?? []).map((l) => [l.id, l.stage]));
      const out = { done: 0, failed: 0, error: null as string | null, moves: 0 };
      for (const [i, id] of ids.entries()) {
        await step(`Lead ${i + 1} de ${ids.length}`);
        try {
          const q = await qualifyLeadCore(db, job.org_id, id, now);
          out.done += 1;
          if (qual.qualificationView(q, settings, stageOf.get(id) ?? "new").move) out.moves += 1;
        } catch (e) {
          out.failed += 1;
          out.error = e instanceof JevError ? e.message : errorText(e);
          if (e instanceof JevError && [401, 402, 403, 404, 429].includes(e.status)) break;
        }
      }
      return { ...qualifyNotice(out), ...out, ids };
    }
    case "discover": {
      const { discoverForOrg } = await import("@/lib/discoveries.server");
      const { normalizeScope, scopeLabel } = await import("@/lib/discoveries");
      const scope = normalizeScope(input);
      await step(`Buscando ${scopeLabel(scope)}`);
      const r = await discoverForOrg(db, job.org_id, now, {
        force: true,
        trigger: "manual",
        userId: job.user_id,
        scope,
      });
      const n = r.added.company + r.added.contact + r.added.competitor;
      const parts = [
        r.added.company && `${r.added.company} ${r.added.company === 1 ? "empresa" : "empresas"}`,
        r.added.contact && `${r.added.contact} ${r.added.contact === 1 ? "contacto" : "contactos"}`,
        r.added.competitor &&
          `${r.added.competitor} ${r.added.competitor === 1 ? "competidor" : "competidores"}`,
      ].filter(Boolean);
      return {
        title: n
          ? `Descubiertos: ${parts.join(", ")} para revisar`
          : "Descubiertos: nada nuevo esta vez",
        body: r.notes.length ? r.notes.slice(0, 3).join(" ") : null,
        link: "/discoveries",
        needs_decision: n > 0,
        added: r.added,
        notes: r.notes,
      };
    }
    case "autopilot_now": {
      const { autopilotForOrg } = await import("@/lib/autopilot.server");
      await step("Investigando, preparando reuniones y repasando cuentas");
      const r = await autopilotForOrg(db, job.org_id, now);
      const parts = [
        r.researched && `investigué ${r.researched} ${r.researched === 1 ? "cuenta" : "cuentas"}`,
        r.prepped && `preparé ${r.prepped} ${r.prepped === 1 ? "reunión" : "reuniones"}`,
        r.cooling &&
          `repasé ${r.cooling} ${r.cooling === 1 ? "cuenta que se enfría" : "cuentas que se enfrían"}`,
      ].filter(Boolean);
      return {
        title: parts.length
          ? `Piloto automático: ${parts.join(", ")}`
          : "Piloto automático: no había nada pendiente",
        body: r.notes.length ? r.notes.slice(0, 3).join(" ") : null,
        link: "/home",
        ...r,
      };
    }
    case "weekly_report": {
      const { saveWeeklyReportNow } = await import("@/lib/weekly-report.server");
      await step("Preparando el informe");
      const r = await saveWeeklyReportNow(db, job.org_id, now);
      return { title: r.title, link: "/inbox" };
    }
    case "posthog_sync": {
      const { syncPosthogOrg } = await import("@/lib/posthog-sync.server");
      await step("Leyendo PostHog");
      const r = await syncPosthogOrg(db, job.org_id, now);
      if (!r.ok) throw new Error(r.error ?? "No he podido leer PostHog.");
      const bits = [
        r.trials && `${r.trials.added} pruebas nuevas y ${r.trials.updated} actualizadas`,
        r.usage && `uso de ${r.usage.matched} de ${r.usage.companies} empresas enlazado a cuentas`,
      ].filter(Boolean);
      return {
        title: "PostHog leído",
        body: bits.join(" · ") || null,
        link: "/integrations",
        sync: r,
      };
    }
    case "playbook_library": {
      const { createLibraryCore } = await import("@/lib/playbooks/library-core");
      const r = await createLibraryCore(await jobCtx(db, job), step);
      if (r.skipped)
        return { title: "Ya tenías todas las jugadas de la biblioteca", link: "/hub", ...r };
      const adapted = r.created.filter((x) => x.adapted).length;
      const body = r.hasContext
        ? `${adapted} adaptados a tu empresa.`
        : "Sin contexto aprobado: van con el texto base. Completa el posicionamiento y vuelve a lanzarlo para adaptarlos.";
      return {
        title: `${r.created.length} jugadas añadidas al hub`,
        // The library's mensaje is RULES_READ_FAILED when the rules could not be read (CA-7).
        body: "mensaje" in r && r.mensaje ? `${body} ${r.mensaje}` : body,
        link: "/hub",
        ...r,
      };
    }
    case "debate": {
      const { runDebateCore } = await import("@/lib/bmad/debate-core");
      const r = await runDebateCore(
        await jobCtx(db, job),
        {
          level: input.level as DebateLevel,
          topic: String(input.topic),
          subjectType: str(input.subjectType),
          subjectId: str(input.subjectId),
          participants: strs(input.participants),
        },
        step,
      );
      return {
        title: `Debate listo: ${String(input.topic).slice(0, 120)}`,
        body: r.actions ? `${r.actions} acciones propuestas para convertir en tareas.` : null,
        link: `/debates?debate=${r.id}`,
        debateId: r.id,
      };
    }
    case "draft_artifact": {
      const { draftArtifactCore } = await import("@/lib/bmad/drafting");
      const { ARTIFACTS } = await import("@/lib/bmad/workflows");
      await step("Redactando");
      const r = await draftArtifactCore(await jobCtx(db, job), {
        kind: input.kind as ArtifactKind,
        notes: String(input.notes ?? ""),
        dealId: str(input.dealId),
      });
      return {
        title: `Borrador listo: ${(ARTIFACTS as Record<string, { label: string }>)[String(input.kind)]?.label ?? "documento"}. Revísalo y apruébalo.`,
        link: `/cycle?artifact=${r.id}`,
        needs_decision: true,
        artifactId: r.id,
      };
    }
    case "deep_review": {
      const { deepReviewCore } = await import("@/lib/bmad/debate-core");
      await step("Revisando");
      const r = await deepReviewCore(await jobCtx(db, job), {
        artifactId: String(input.artifactId),
        method: String(input.method),
      });
      const high = r.findings.filter((f) => f.severity === "alta").length;
      return {
        title: `Revisión a fondo lista: ${r.findings.length} hallazgos${high ? `, ${high} de severidad alta` : ""}`,
        body: r.summary.slice(0, 400),
        link: `/cycle?artifact=${input.artifactId}`,
        needs_decision: true,
        review: r,
      };
    }
    case "account_research": {
      const accountId = String(input.accountId);
      const { data: acc } = await db
        .from("accounts")
        .select("id,name")
        .eq("org_id", job.org_id)
        .eq("id", accountId)
        .maybeSingle();
      if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
      const c = await jobCtx(db, job);
      const { researchAccountCore } = await import("@/lib/web-research-core");
      const { trackedRun } = await import("@/lib/orchestrator/runner");
      await step("Leyendo la web y las noticias");
      const r = await trackedRun(c, "research_account", "manual", () =>
        researchAccountCore(db, accountId, scope),
      );
      return {
        title: `${acc.name}: investigación lista. Elige qué pasar al plan de cuenta.`,
        body: r.via || null,
        link: `/accounts/${accountId}?tab=plan&research=1`,
        needs_decision: true,
        research: r,
      };
    }
    case "drive_summaries": {
      const { summarizeDoc } = await import("@/lib/drive-core");
      const docs = (Array.isArray(input.docs) ? input.docs : []).slice(0, 30) as {
        fileId: string;
        accountId: string | null;
      }[];
      const s = { db, orgId: job.org_id, userId: job.user_id };
      let done = 0;
      let failed = 0;
      for (const [i, d] of docs.entries()) {
        await step(`Documento ${i + 1} de ${docs.length}`);
        try {
          await summarizeDoc(s, String(d.fileId), d.accountId ? String(d.accountId) : null);
          done++;
        } catch (e) {
          failed++;
          const { safeErrorLog } = await import("@/lib/agent/safe-error-log");
          console.error("drive summary failed", d.fileId, safeErrorLog(e));
        }
      }
      return {
        title: `${done} ${done === 1 ? "documento resumido" : "documentos resumidos"} de Drive`,
        body: failed ? `${failed} no se pudieron leer.` : null,
        link: "/hub?tab=drive",
        done,
        failed,
      };
    }
    case "onboarding_read": {
      const { runOnboardingRead } = await import("@/lib/onboarding.server");
      const r = await runOnboardingRead(await jobCtx(db, job), input, step);
      // Documents are only needed for the reading: do not keep megabytes of them on the job row.
      if (Array.isArray(input.files) && input.files.length)
        await db
          .from("background_jobs")
          .update({
            input: {
              ...input,
              files: input.files.map((f: { filename: string }) => ({
                filename: f.filename,
                dataUrl: "",
              })),
            } as unknown as Json,
          })
          .eq("id", job.id);
      return r;
    }
    default:
      throw new Error(`Tarea desconocida: ${JOB_LABEL[job.kind as JobKind] ?? job.kind}`);
  }
}
