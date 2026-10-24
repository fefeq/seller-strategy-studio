// The work Inngest runs, as plain functions (each one is a retried step in functions.server.ts). They use the
// admin client and always filter by the company; who may start them is checked where the event is sent.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { cleanDomain } from "@/lib/leads";
import { JOB_LABEL, type JobKind } from "@/lib/inngest/events";

type Admin = SupabaseClient<Database>;
const HOURS = 3_600_000;

// ---------------- Per-company maintenance (was one sequential hourly loop) ----------------

export async function maintainSuggestions(db: Admin, orgId: string) {
  const { loadSnapshot, syncSuggestions } = await import("@/lib/org-data");
  const { detect } = await import("@/lib/proactive");
  const found = detect(await loadSnapshot(db, orgId));
  await syncSuggestions(db, orgId, found);
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
export async function leadsToEnrich(db: Admin, orgId: string, now = new Date(), max = 10) {
  const { data } = await db.from("leads").select("id").eq("org_id", orgId).is("enriched_at", null).gte("created_at", new Date(now.getTime() - 48 * HOURS).toISOString()).order("created_at", { ascending: false }).limit(max);
  return (data ?? []).map((l) => l.id);
}

// ---------------- Lead enrichment ----------------

/**
 * The full flow of a new lead: find or create its account → complete the company (orchestrator: Apollo, then Clay)
 * → news → key people (Apollo free search, then Clay) → Jev qualification and the proposed stage, which waits
 * for approval in Sugerencias. Each step is recorded in leads.flow; a failing step never stops the next one.
 * Runs once per lead (enriched_at) unless a person repeats it (force).
 */
export async function enrichLead(db: Admin, orgId: string, leadId: string, now = new Date(), opts: { force?: boolean; trigger?: "manual" | "automatic"; userId?: string | null } = {}) {
  const { shouldRunFlow, corporateDomain, pickKeyPeople, flowLines } = await import("@/lib/lead-flow");
  type LeadFlow = import("@/lib/lead-flow").LeadFlow;
  const { data: lead } = await db.from("leads").select("id,company,email,account_id,owner_id,enriched_at,contact_name,stage").eq("org_id", orgId).eq("id", leadId).maybeSingle();
  if (!lead || !shouldRunFlow(lead, opts.force)) return { skipped: true };
  const trigger = opts.trigger ?? "automatic";
  const flow: LeadFlow = { at: now.toISOString(), steps: {}, people: [] };
  const emailDomain = corporateDomain(lead.email);
  const actor = opts.userId ?? lead.owner_id ?? (await db.from("org_members").select("user_id").eq("org_id", orgId).eq("role", "owner").limit(1).maybeSingle()).data?.user_id ?? null;
  const { data: org } = await db.from("organizations").select("currency").eq("id", orgId).maybeSingle();
  const ctx = { db: db as any, orgId, userId: actor as string, roles: ["owner"], currency: (org as { currency?: string } | null)?.currency ?? "EUR" };

  // 1 · Account: by corporate domain, else by exact name, else created from the lead.
  let accountId = lead.account_id;
  let created = false;
  if (!accountId && emailDomain) {
    const { data } = await db.from("accounts").select("id,domain").eq("org_id", orgId).ilike("domain", `%${emailDomain.replace(/[%_\\]/g, "")}%`).limit(20);
    accountId = (data ?? []).find((a) => cleanDomain(a.domain) === emailDomain)?.id ?? null;
  }
  if (!accountId && lead.company.trim()) {
    const { data } = await db.from("accounts").select("id,name").eq("org_id", orgId).ilike("name", lead.company.trim().replace(/[%_\\]/g, (c) => `\\${c}`)).limit(5);
    accountId = (data ?? []).find((a) => a.name.trim().toLowerCase() === lead.company.trim().toLowerCase())?.id ?? null;
  }
  if (!accountId && lead.company.trim()) {
    const { data, error } = await db.from("accounts").insert({ org_id: orgId, name: lead.company.trim().slice(0, 200), domain: emailDomain, owner_id: lead.owner_id, created_by: actor }).select("id").single();
    if (error) console.error("lead flow account", error.message);
    else { accountId = data.id; created = true; }
  }
  if (accountId && !lead.account_id) await db.from("leads").update({ account_id: accountId }).eq("org_id", orgId).eq("id", leadId);
  flow.steps.account = accountId
    ? { status: "done", note: created ? `Cuenta creada${emailDomain ? ` con ${emailDomain}` : ""}.` : "Enlazado a su cuenta." }
    : { status: "skipped", note: "Sin nombre de empresa: no hay cuenta que crear." };

  let fit: number | null = null;
  const lines: string[] = [];
  const acc = accountId ? (await db.from("accounts").select("id,name,domain,industry,size,country,notes,segment_id,tier,signals_checked_at").eq("org_id", orgId).eq("id", accountId).single()).data : null;
  if (acc && !acc.domain && emailDomain) { await db.from("accounts").update({ domain: emailDomain }).eq("org_id", orgId).eq("id", acc.id); acc.domain = emailDomain; }

  // 2 · Company data through the orchestrator (budget-aware; fills only empty fields).
  if (!acc) flow.steps.complete = { status: "skipped", note: "Sin cuenta." };
  else if (!acc.domain) flow.steps.complete = { status: "skipped", note: "Sin dominio (email personal o vacío): añade la web de la empresa y repite." };
  else if (trigger === "automatic" && (await db.from("lead_settings").select("auto_enrich").eq("org_id", orgId).maybeSingle()).data?.auto_enrich === false)
    flow.steps.complete = { status: "skipped", note: "Completado automático desactivado en esta empresa: pulsa «Repetir el flujo» para hacerlo a mano." };
  else {
    try {
      const { completeAccount, applyAutoChanges } = await import("@/lib/orchestrator/runner");
      const r = await completeAccount(ctx, acc.id, trigger);
      if (r.blocked) flow.steps.complete = { status: "blocked", note: r.blocked };
      else {
        const written = await applyAutoChanges(ctx, acc.id, r.changes, now.toISOString());
        for (const ch of r.changes) if (written.includes(ch.field)) (acc as Record<string, unknown>)[ch.field] = ch.proposed;
        const names = written.map((k) => ({ industry: "sector", size: "tamaño", country: "país", notes: "descripción", linkedin_url: "LinkedIn" } as Record<string, string>)[k] ?? k);
        flow.steps.complete = { status: "done", note: names.length ? `Completado ${names.join(", ")}${r.sources ? ` (${r.sources})` : ""}.` : r.found ? "Ya tenía los datos." : "Los servicios no encontraron la empresa." };
      }
    } catch (e) { flow.steps.complete = { status: "failed", note: (e as Error).message.slice(0, 200) }; }
  }

  if (acc?.domain && process.env["FIRECRAWL_API_KEY"] && (!acc.signals_checked_at || now.getTime() - new Date(acc.signals_checked_at).getTime() > 7 * 24 * HOURS)) {
    try {
      const { refreshSignalsCore } = await import("@/lib/web-research-core");
      const r = await refreshSignalsCore(db, acc.id, { orgId, userId: "" });
      if (r.added.length) lines.push(`${r.added.length} ${r.added.length === 1 ? "novedad reciente" : "novedades recientes"}: ${r.added.slice(0, 2).map((s) => s.title).join(" · ")}.`);
    } catch (e) { console.error("lead flow signals", (e as Error).message); }
  }

  // 3 · Key people (search only: revealing contacts costs credits and stays a person's decision).
  if (!acc?.domain) flow.steps.people = { status: "skipped", note: "Sin dominio de empresa." };
  else {
    try {
      const { findKeyPeople } = await import("@/lib/orchestrator/runner");
      const r = await findKeyPeople(ctx, { accountId: acc.id }, trigger);
      if (r.blocked) flow.steps.people = { status: "blocked", note: r.blocked };
      else {
        flow.people = pickKeyPeople(r.rows.map((p) => ({ name: p.name, title: p.title, linkedin: p.linkedin })), lead.contact_name);
        flow.steps.people = flow.people.length
          ? { status: "done", note: `${flow.people.map((p) => `${p.name}${p.title ? ` (${p.title})` : ""}`).join(" · ")}${r.masked ? ". Añádelas al mapa desde la cuenta para ver su contacto" : ""}.` }
          : { status: "done", note: "No se han encontrado personas clave." };
      }
    } catch (e) { flow.steps.people = { status: "failed", note: (e as Error).message.slice(0, 200) }; }
  }

  if (acc) {
    const [{ data: icps }, { data: segs }] = await Promise.all([
      db.from("icp_profiles").select("id,segment_id,industries,company_size,geography,anti_icp,min_employees,max_employees,search_keywords").eq("org_id", orgId),
      db.from("segments").select("id,name").eq("org_id", orgId),
    ]);
    const { scoreAccount } = await import("@/lib/scoring");
    fit = scoreAccount({ ...acc, lastActivityAt: null, openDeals: 0 }, (icps ?? []) as any, now, new Map((segs ?? []).map((s) => [s.id, s.name]))).fit.score;
    lines.unshift(fit === null ? "Sin datos para medir el encaje con el ICP: completa sector y tamaño." : `Encaje con el ICP: ${fit} sobre 100.`);
  }

  // 4 · AI proposal with the completed account; the stage move is only proposed (approve in Sugerencias).
  let proposal: { label: string; total: number } | null = null;
  let action: { tool: string; args: Record<string, unknown> } | null = null;
  try {
    const [{ qualifyLeadCore }, qual] = await Promise.all([import("@/lib/lead-qualify.server"), import("@/lib/lead-qualification")]);
    const q = await qualifyLeadCore(db, orgId, leadId, now);
    const { data: st } = await db.from("lead_settings").select("qualification").eq("org_id", orgId).maybeSingle();
    const v = qual.qualificationView(q, qual.readQualSettings(st?.qualification), lead.stage);
    proposal = { label: qual.PROPOSAL_LABEL[v.proposal], total: v.total };
    flow.steps.proposal = { status: "done", note: `${v.total} sobre 100 → ${qual.PROPOSAL_LABEL[v.proposal]}. ${v.reason}${v.review ? " Revísalo: la IA no lo tiene claro." : ""}` };
    if (v.move) action = { tool: "update_lead", args: { lead_id: leadId, stage: v.move, ...(v.move === "disqualified" ? { disqualified_reason: v.reason } : {}) } };
  } catch (e) { flow.steps.proposal = { status: "failed", note: (e as Error).message.slice(0, 200) }; }

  const row = {
    org_id: orgId, detector: "lead_enriched", dedupe_key: `lead_enriched:${leadId}`, priority: (fit !== null && fit >= 70) || action?.args.stage === "sql" ? 2 : 3,
    title: `Lead nuevo: ${lead.company}${lead.contact_name ? ` (${lead.contact_name})` : ""}${proposal ? ` · ${proposal.label} (${proposal.total})` : fit !== null ? ` · encaje ${fit}` : ""}`.slice(0, 200),
    body: [...flowLines(flow), ...lines].join("\n"), link: `/leads?lead=${leadId}`, action: action as any, user_id: lead.owner_id,
  };
  // A repeat refreshes the pending proposal; the first run never revives a dismissed one.
  if (opts.force) {
    const { data: prev } = await db.from("suggestions").select("id,status").eq("org_id", orgId).eq("dedupe_key", row.dedupe_key).maybeSingle();
    if (prev) await db.from("suggestions").update({ title: row.title, body: row.body, action: row.action, priority: row.priority, status: "pending" }).eq("id", prev.id);
    else await db.from("suggestions").insert(row);
  } else await db.from("suggestions").upsert(row, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
  await db.from("leads").update({ enriched_at: now.toISOString(), flow: flow as any }).eq("org_id", orgId).eq("id", leadId);
  return { accountId, fit, steps: flow.steps };
}

// ---------------- Follow-up sequence with waits ----------------

/** The suggestion for one follow-up step if the lead still waits in Contactado; null when the sequence must stop. */
export async function followupStep(db: Admin, orgId: string, leadId: string, now = new Date()) {
  const { loadSnapshot } = await import("@/lib/org-data");
  const { followupSequence } = await import("@/lib/proactive/detectors/followup-sequence");
  const snap = await loadSnapshot(db, orgId, now);
  const lead = (snap.leads ?? []).find((l) => l.id === leadId);
  if (!lead || lead.stage !== "contacted") return { stop: true as const };
  const found = followupSequence({ ...snap, leads: [lead] });
  if (found.length) await db.from("suggestions").upsert(found.map((f) => ({ ...f, org_id: orgId, action: f.action as any })), { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
  return { stop: false as const, created: found.length };
}

// ---------------- Background jobs ----------------

class Cancelled extends Error { constructor() { super("cancelled"); } }

type Job = Database["public"]["Tables"]["background_jobs"]["Row"];

/** The launcher's context, rebuilt with the admin client (every core filters by the company). */
async function jobCtx(db: Admin, job: Job) {
  const [{ data: org }, { data: roles }] = await Promise.all([
    db.from("organizations").select("name,company_name,currency").eq("id", job.org_id).maybeSingle(),
    db.from("org_members").select("role").eq("org_id", job.org_id).eq("user_id", job.user_id),
  ]);
  if (!roles?.length) throw new Error("Ya no perteneces a esta empresa.");
  return { db: db as any, orgId: job.org_id, userId: job.user_id, roles: roles.map((r) => r.role as string), currency: org?.currency ?? "EUR", orgName: org?.company_name?.trim() || org?.name || "tu empresa" };
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
  if (job.cancel_requested) { await db.from("background_jobs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", jobId); return { cancelled: true }; }
  await db.from("background_jobs").update({ status: "running" }).eq("id", jobId);
  const step = async (s: string) => {
    const { data: j } = await db.from("background_jobs").update({ step: s.slice(0, 200) }).eq("id", jobId).select("cancel_requested").maybeSingle();
    if (j?.cancel_requested) throw new Cancelled();
  };
  const scope = { orgId: job.org_id, userId: job.user_id };
  const input = (job.input ?? {}) as Record<string, any>;
  const now = new Date();
  try {
    const result = await runKind(db, job, input, scope, step, now);
    await step("Terminando");
    await db.from("background_jobs").update({ status: "done", result: result as any, step: null, finished_at: new Date().toISOString(), error: null }).eq("id", jobId);
    const { deliverJobNotice } = await import("@/lib/notices.server");
    await deliverJobNotice(db, jobId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Cancelled) {
      await db.from("background_jobs").update({ status: "cancelled", step: null, finished_at: new Date().toISOString() }).eq("id", jobId);
      return { cancelled: true };
    }
    const { errorText } = await import("@/lib/errors");
    console.error("background job failed", job.kind, (e as Error)?.message ?? e);
    if (!final) { await db.from("background_jobs").update({ step: "Reintentando…" }).eq("id", jobId); throw e; }
    await db.from("background_jobs").update({ status: "failed", step: null, error: errorText(e), finished_at: new Date().toISOString() }).eq("id", jobId);
    const { deliverJobNotice } = await import("@/lib/notices.server");
    await deliverJobNotice(db, jobId);
    throw e;
  }
}

type Result = { title: string; body?: string | null; link: string; needs_decision?: boolean; [k: string]: unknown };

async function runKind(db: Admin, job: Job, input: Record<string, any>, scope: { orgId: string; userId: string }, step: (s: string) => Promise<void>, now: Date): Promise<Result> {
  switch (job.kind as JobKind) {
    case "battlecard": {
      const { battlecardCore } = await import("@/lib/apify-core");
      await step("Leyendo reseñas");
      const b = await battlecardCore(db, String(input.competitor), Number(input.max) || 20, scope);
      const { data, error } = await db.from("knowledge_docs").insert({ org_id: job.org_id, section: "objections", title: b.title, body: b.markdown, scope: "team", created_by: job.user_id, updated_by: job.user_id }).select("id").single();
      if (error) throw new Error(error.message);
      return { title: `${b.title} guardada en Objeciones y battlecards`, link: `/hub?doc=${data.id}` };
    }
    case "stakeholder_research": {
      const { researchStakeholderCore } = await import("@/lib/ai-core");
      const { data: s } = await db.from("stakeholders").select("account_id").eq("org_id", job.org_id).eq("id", String(input.stakeholderId)).maybeSingle();
      if (!s) throw new Error("No encuentro esa persona en esta empresa.");
      await step("Investigando");
      const r = await researchStakeholderCore(db, String(input.stakeholderId), scope);
      return { title: `Research de ${r.name} listo`, link: `/accounts/${s.account_id}?tab=stakeholders` };
    }
    case "account_signals": {
      const { refreshSignalsCore } = await import("@/lib/web-research-core");
      await step("Buscando novedades");
      const r = await refreshSignalsCore(db, String(input.accountId), scope);
      return { title: r.added.length ? `${r.added.length} ${r.added.length === 1 ? "novedad nueva" : "novedades nuevas"} en la cuenta` : "Sin novedades con interés comercial en el último mes", link: `/accounts/${input.accountId}?tab=signals` };
    }
    case "drive_import": {
      const { importToKnowledge } = await import("@/lib/drive-core");
      await step("Importando");
      const r = await importToKnowledge({ db: db as any, orgId: job.org_id, userId: job.user_id }, String(input.file), String(input.section));
      return { title: `«${r.title}» importado al hub`, link: `/hub?doc=${r.docId}` };
    }
    case "complete_account": {
      const accountId = String(input.accountId);
      const { data: acc } = await db.from("accounts").select("id,name").eq("org_id", job.org_id).eq("id", accountId).maybeSingle();
      if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
      const c = await jobCtx(db, job);
      const { completeAccount, applyAutoChanges } = await import("@/lib/orchestrator/runner");
      const { completeNotice } = await import("@/lib/jobs");
      await step("Buscando datos");
      const out = await completeAccount(c, accountId, "manual");
      await step("Guardando");
      const written = out.blocked ? [] : await applyAutoChanges(c, accountId, out.changes, now.toISOString());
      return { ...completeNotice(acc, out, written as any), review: out.changes.filter((ch) => !ch.empty && ch.proposed) };
    }
    case "key_people": {
      const accountId = String(input.accountId);
      const { data: acc } = await db.from("accounts").select("id,name").eq("org_id", job.org_id).eq("id", accountId).maybeSingle();
      if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
      const c = await jobCtx(db, job);
      const { findKeyPeople } = await import("@/lib/orchestrator/runner");
      const { peopleNotice, appendRows } = await import("@/lib/jobs");
      await step("Buscando personas");
      const out = await findKeyPeople(c, { accountId, titles: input.titles ?? [], levels: input.levels ?? [], cursor: input.cursor ?? null }, "manual");
      const prev = input.prevJobId ? (await db.from("background_jobs").select("result").eq("org_id", job.org_id).eq("id", String(input.prevJobId)).maybeSingle()).data?.result as { search?: { rows: typeof out.rows } } | null : null;
      const rows = prev?.search?.rows ? appendRows(prev.search.rows, out.rows, (r) => r.key) : out.rows;
      const search = { ...out, rows };
      return { ...peopleNotice(acc, { ...out, rows: input.prevJobId ? out.rows : rows }), search, criteria: { titles: input.titles ?? [], levels: input.levels ?? [] } };
    }
    case "icp_companies": {
      const c = await jobCtx(db, job);
      const { findIcpCompanies } = await import("@/lib/orchestrator/runner");
      const { companiesNotice, appendRows } = await import("@/lib/jobs");
      await step("Buscando empresas");
      const out = await findIcpCompanies(c, { query: input.query ?? {}, cursor: input.cursor ?? null }, "manual");
      const prev = input.prevJobId ? (await db.from("background_jobs").select("result").eq("org_id", job.org_id).eq("id", String(input.prevJobId)).maybeSingle()).data?.result as { search?: { rows: typeof out.rows } } | null : null;
      const rows = prev?.search?.rows ? appendRows(prev.search.rows, out.rows, (r) => r.domain ?? r.name) : out.rows;
      return { ...companiesNotice({ ...out, rows: input.prevJobId ? out.rows : rows }), search: { ...out, rows }, query: input.query ?? {} };
    }
    case "qualify_leads": {
      const { qualifyLeadCore } = await import("@/lib/lead-qualify.server");
      const { JevError } = await import("@/lib/jev.server");
      const { errorText } = await import("@/lib/errors");
      const qual = await import("@/lib/lead-qualification");
      const { qualifyNotice } = await import("@/lib/jobs");
      let ids: string[] = Array.isArray(input.ids) ? input.ids.map(String).slice(0, 25) : [];
      if (!ids.length) {
        const { data: rows } = await db.from("leads").select("id").eq("org_id", job.org_id).is("qualified_at", null).in("stage", ["new", "contacted", "mql", "sql"]).order("created_at", { ascending: false }).limit(25);
        ids = (rows ?? []).map((r) => r.id);
      }
      const { data: st } = await db.from("lead_settings").select("qualification").eq("org_id", job.org_id).maybeSingle();
      const settings = qual.readQualSettings(st?.qualification);
      const { data: stages } = ids.length ? await db.from("leads").select("id,stage").eq("org_id", job.org_id).in("id", ids) : { data: [] as { id: string; stage: string }[] };
      const stageOf = new Map((stages ?? []).map((l) => [l.id, l.stage]));
      const out = { done: 0, failed: 0, error: null as string | null, moves: 0 };
      for (const [i, id] of ids.entries()) {
        await step(`Lead ${i + 1} de ${ids.length}`);
        try {
          const q = await qualifyLeadCore(db, job.org_id, id, now);
          out.done += 1;
          if (qual.qualificationView(q, settings, (stageOf.get(id) ?? "new") as any).move) out.moves += 1;
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
      await step("Buscando empresas, contactos y competidores");
      const r = await discoverForOrg(db, job.org_id, now, { force: true, trigger: "manual", userId: job.user_id });
      const n = r.added.company + r.added.contact + r.added.competitor;
      const parts = [r.added.company && `${r.added.company} ${r.added.company === 1 ? "empresa" : "empresas"}`, r.added.contact && `${r.added.contact} ${r.added.contact === 1 ? "contacto" : "contactos"}`, r.added.competitor && `${r.added.competitor} ${r.added.competitor === 1 ? "competidor" : "competidores"}`].filter(Boolean);
      return { title: n ? `Descubiertos: ${parts.join(", ")} para revisar` : "Descubiertos: nada nuevo esta vez", body: r.notes.length ? r.notes.slice(0, 3).join(" ") : null, link: "/discoveries", needs_decision: n > 0, added: r.added, notes: r.notes };
    }
    case "autopilot_now": {
      const { autopilotForOrg } = await import("@/lib/autopilot.server");
      await step("Investigando, preparando reuniones y repasando cuentas");
      const r = await autopilotForOrg(db, job.org_id, now);
      const parts = [r.researched && `investigué ${r.researched} ${r.researched === 1 ? "cuenta" : "cuentas"}`, r.prepped && `preparé ${r.prepped} ${r.prepped === 1 ? "reunión" : "reuniones"}`, r.cooling && `repasé ${r.cooling} ${r.cooling === 1 ? "cuenta que se enfría" : "cuentas que se enfrían"}`].filter(Boolean);
      return { title: parts.length ? `Piloto automático: ${parts.join(", ")}` : "Piloto automático: no había nada pendiente", body: r.notes.length ? r.notes.slice(0, 3).join(" ") : null, link: "/home", ...r };
    }
    case "weekly_report": {
      const { saveWeeklyReportNow } = await import("@/lib/weekly-report.server");
      await step("Preparando el informe");
      const r = await saveWeeklyReportNow(db as any, job.org_id, now);
      return { title: r.title, link: "/inbox" };
    }
    case "posthog_sync": {
      const { syncPosthogOrg } = await import("@/lib/posthog-sync.server");
      await step("Leyendo PostHog");
      const r = await syncPosthogOrg(db, job.org_id, now);
      if (!r.ok) throw new Error(r.error ?? "No he podido leer PostHog.");
      const bits = [r.trials && `${r.trials.added} pruebas nuevas y ${r.trials.updated} actualizadas`, r.usage && `uso de ${r.usage.matched} de ${r.usage.companies} empresas enlazado a cuentas`].filter(Boolean);
      return { title: "PostHog leído", body: bits.join(" · ") || null, link: "/integrations", sync: r };
    }
    case "playbook_library": {
      const { createLibraryCore } = await import("@/lib/playbooks/library-core");
      const r = await createLibraryCore(await jobCtx(db, job), step);
      if (r.skipped) return { title: "Ya tenías todos los playbooks de Nokko", link: "/hub", ...r };
      const adapted = r.created.filter((x) => x.adapted).length;
      return { title: `${r.created.length} playbooks añadidos al hub`, body: r.hasContext ? `${adapted} adaptados a tu empresa.` : "Sin contexto aprobado: van con el texto base. Completa el posicionamiento y vuelve a lanzarlo para adaptarlos.", link: "/hub", ...r };
    }
    case "debate": {
      const { runDebateCore } = await import("@/lib/bmad/debate-core");
      const r = await runDebateCore(await jobCtx(db, job), { level: input.level, topic: String(input.topic), subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null, participants: input.participants ?? [] }, step);
      return { title: `Debate listo: ${String(input.topic).slice(0, 120)}`, body: r.actions ? `${r.actions} acciones propuestas para convertir en tareas.` : null, link: `/debates?debate=${r.id}`, debateId: r.id };
    }
    case "draft_artifact": {
      const { draftArtifactCore } = await import("@/lib/bmad/drafting");
      const { ARTIFACTS } = await import("@/lib/bmad/workflows");
      await step("Redactando");
      const r = await draftArtifactCore(await jobCtx(db, job), { kind: input.kind, notes: String(input.notes ?? ""), dealId: input.dealId ?? null });
      return { title: `Borrador listo: ${(ARTIFACTS as Record<string, { label: string }>)[input.kind]?.label ?? "documento"}. Revísalo y apruébalo.`, link: `/cycle?artifact=${r.id}`, needs_decision: true, artifactId: r.id };
    }
    case "deep_review": {
      const { deepReviewCore } = await import("@/lib/bmad/debate-core");
      await step("Revisando");
      const r = await deepReviewCore(await jobCtx(db, job), { artifactId: String(input.artifactId), method: String(input.method) });
      const high = r.findings.filter((f) => f.severity === "alta").length;
      return { title: `Revisión a fondo lista: ${r.findings.length} hallazgos${high ? `, ${high} de severidad alta` : ""}`, body: r.summary.slice(0, 400), link: `/cycle?artifact=${input.artifactId}`, needs_decision: true, review: r };
    }
    case "account_research": {
      const accountId = String(input.accountId);
      const { data: acc } = await db.from("accounts").select("id,name").eq("org_id", job.org_id).eq("id", accountId).maybeSingle();
      if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
      const c = await jobCtx(db, job);
      const { researchAccountCore } = await import("@/lib/web-research-core");
      const { trackedRun } = await import("@/lib/orchestrator/runner");
      await step("Leyendo la web y las noticias");
      const r = await trackedRun(c, "research_account", "manual", () => researchAccountCore(db as any, accountId, scope));
      return { title: `${acc.name}: investigación lista. Elige qué pasar al plan de cuenta.`, body: r.via || null, link: `/accounts/${accountId}?tab=plan&research=1`, needs_decision: true, research: r };
    }
    case "drive_summaries": {
      const { summarizeDoc } = await import("@/lib/drive-core");
      const docs = (Array.isArray(input.docs) ? input.docs : []).slice(0, 30) as { fileId: string; accountId: string | null }[];
      const s = { db: db as any, orgId: job.org_id, userId: job.user_id };
      let done = 0; let failed = 0;
      for (const [i, d] of docs.entries()) {
        await step(`Documento ${i + 1} de ${docs.length}`);
        try { await summarizeDoc(s, String(d.fileId), d.accountId ? String(d.accountId) : null); done++; }
        catch (e) { failed++; console.error("drive summary failed", d.fileId, (e as Error).message); }
      }
      return { title: `${done} ${done === 1 ? "documento resumido" : "documentos resumidos"} de Drive`, body: failed ? `${failed} no se pudieron leer.` : null, link: "/hub?tab=drive", done, failed };
    }
    default: throw new Error(`Tarea desconocida: ${JOB_LABEL[job.kind as JobKind] ?? job.kind}`);
  }
}
