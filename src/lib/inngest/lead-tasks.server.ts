// Lead flow run by Inngest: enrichment (account, key people, qualification) and the follow-up sequence. Admin client, always filtered by company.
import { cleanDomain } from "@/lib/leads";
import type { Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { missingKey } from "@/lib/fit-key";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

type Admin = SupabaseClient<Database>;
const HOURS = 3_600_000;

export async function leadsToEnrich(db: Admin, orgId: string, now = new Date(), max = 10) {
  const { data } = await db
    .from("leads")
    .select("id")
    .eq("org_id", orgId)
    .is("enriched_at", null)
    .gte("created_at", new Date(now.getTime() - 48 * HOURS).toISOString())
    .order("created_at", { ascending: false })
    .limit(max);
  return (data ?? []).map((l) => l.id);
}

// ---------------- Lead enrichment ----------------

/**
 * The full flow of a new lead: find or create its account → complete the company (orchestrator: Apollo, then Clay)
 * → news → key people (Apollo free search, then Clay) → Jev qualification and the proposed stage, which waits
 * for approval in Sugerencias. Each step is recorded in leads.flow; a failing step never stops the next one.
 * Runs once per lead (enriched_at) unless a person repeats it (force).
 */
export async function enrichLead(
  db: Admin,
  orgId: string,
  leadId: string,
  now = new Date(),
  opts: { force?: boolean; trigger?: "manual" | "automatic"; userId?: string | null } = {},
) {
  const { shouldRunFlow, corporateDomain, pickKeyPeople, flowLines } =
    await import("@/lib/lead-flow");
  type LeadFlow = import("@/lib/lead-flow").LeadFlow;
  const { data: lead } = await db
    .from("leads")
    .select("id,company,email,account_id,owner_id,enriched_at,contact_name,stage")
    .eq("org_id", orgId)
    .eq("id", leadId)
    .maybeSingle();
  if (!lead || !shouldRunFlow(lead, opts.force)) return { skipped: true };
  const trigger = opts.trigger ?? "automatic";
  const flow: LeadFlow = { at: now.toISOString(), steps: {}, people: [] };
  const emailDomain = corporateDomain(lead.email);
  const actor =
    opts.userId ??
    lead.owner_id ??
    (
      await db
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle()
    ).data?.user_id ??
    null;
  const { data: org } = await db
    .from("organizations")
    .select("currency")
    .eq("id", orgId)
    .maybeSingle();
  const ctx = {
    db,
    orgId,
    userId: actor as string,
    roles: ["owner"],
    currency: (org as { currency?: string } | null)?.currency ?? "EUR",
  };

  // 1 · Account: by corporate domain, else by exact name, else created from the lead.
  let accountId = lead.account_id;
  let created = false;
  if (!accountId && emailDomain) {
    const { data } = await db
      .from("accounts")
      .select("id,domain")
      .eq("org_id", orgId)
      .ilike("domain", `%${emailDomain.replace(/[%_\\]/g, "")}%`)
      .limit(20);
    accountId = (data ?? []).find((a) => cleanDomain(a.domain) === emailDomain)?.id ?? null;
  }
  if (!accountId && lead.company.trim()) {
    const { data } = await db
      .from("accounts")
      .select("id,name")
      .eq("org_id", orgId)
      .ilike(
        "name",
        lead.company.trim().replace(/[%_\\]/g, (c) => `\\${c}`),
      )
      .limit(5);
    accountId =
      (data ?? []).find((a) => a.name.trim().toLowerCase() === lead.company.trim().toLowerCase())
        ?.id ?? null;
  }
  if (!accountId && lead.company.trim()) {
    const { data, error } = await db
      .from("accounts")
      .insert({
        org_id: orgId,
        name: lead.company.trim().slice(0, 200),
        domain: emailDomain,
        owner_id: lead.owner_id,
        created_by: actor,
      })
      .select("id")
      .single();
    if (error) console.error("lead flow account", safeErrorLog(error));
    else {
      accountId = data.id;
      created = true;
    }
  }
  if (accountId && !lead.account_id)
    await db.from("leads").update({ account_id: accountId }).eq("org_id", orgId).eq("id", leadId);
  flow.steps.account = accountId
    ? {
        status: "done",
        note: created
          ? `Cuenta creada${emailDomain ? ` con ${emailDomain}` : ""}.`
          : "Enlazado a su cuenta.",
      }
    : { status: "skipped", note: "Sin nombre de empresa: no hay cuenta que crear." };

  let fit: number | null = null;
  const lines: string[] = [];
  const acc = accountId
    ? (
        await db
          .from("accounts")
          .select("id,name,domain,industry,size,country,notes,segment_id,tier,signals_checked_at")
          .eq("org_id", orgId)
          .eq("id", accountId)
          .single()
      ).data
    : null;
  if (acc && !acc.domain && emailDomain) {
    await db.from("accounts").update({ domain: emailDomain }).eq("org_id", orgId).eq("id", acc.id);
    acc.domain = emailDomain;
  }

  // 2 · Company data through the orchestrator (budget-aware; fills only empty fields).
  if (!acc) flow.steps.complete = { status: "skipped", note: "Sin cuenta." };
  else if (missingKey("lead", { account: acc }).length)
    flow.steps.complete = {
      status: "skipped",
      note: "Sin dominio (email personal o vacío): añade la web de la empresa y repite.",
    };
  else if (
    trigger === "automatic" &&
    (await db.from("lead_settings").select("auto_enrich").eq("org_id", orgId).maybeSingle()).data
      ?.auto_enrich === false
  )
    flow.steps.complete = {
      status: "skipped",
      note: "Completado automático desactivado en esta empresa: pulsa «Repetir el flujo» para hacerlo a mano.",
    };
  else {
    try {
      const { completeAccount, applyAutoChanges } = await import("@/lib/orchestrator/runner");
      const r = await completeAccount(ctx, acc.id, trigger);
      if (r.blocked) flow.steps.complete = { status: "blocked", note: r.blocked };
      else {
        const written = await applyAutoChanges(ctx, acc.id, r.changes, now.toISOString());
        for (const ch of r.changes)
          if (written.includes(ch.field)) (acc as Record<string, unknown>)[ch.field] = ch.proposed;
        const names = written.map(
          (k) =>
            (
              ({
                industry: "sector",
                size: "tamaño",
                country: "país",
                notes: "descripción",
                linkedin_url: "LinkedIn",
              }) as Record<string, string>
            )[k] ?? k,
        );
        flow.steps.complete = {
          status: "done",
          note: names.length
            ? `Completado ${names.join(", ")}${r.sources ? ` (${r.sources})` : ""}.`
            : r.found
              ? "Ya tenía los datos."
              : "Los servicios no encontraron la empresa.",
        };
      }
    } catch (e) {
      flow.steps.complete = { status: "failed", note: (e as Error).message.slice(0, 200) };
    }
  }

  if (
    acc?.domain &&
    process.env["FIRECRAWL_API_KEY"] &&
    (!acc.signals_checked_at ||
      now.getTime() - new Date(acc.signals_checked_at).getTime() > 7 * 24 * HOURS)
  ) {
    try {
      const { refreshSignalsCore } = await import("@/lib/web-research-core");
      const r = await refreshSignalsCore(db, acc.id, { orgId, userId: "" });
      if (r.added.length)
        lines.push(
          `${r.added.length} ${r.added.length === 1 ? "novedad reciente" : "novedades recientes"}: ${r.added
            .slice(0, 2)
            .map((s) => s.title)
            .join(" · ")}.`,
        );
    } catch (e) {
      console.error("lead flow signals", safeErrorLog(e));
    }
  }

  // 3 · Key people (search only: revealing contacts costs credits and stays a person's decision).
  if (!acc || missingKey("lead", { account: acc }).length)
    flow.steps.people = { status: "skipped", note: "Sin dominio de empresa." };
  else {
    try {
      const { findKeyPeople } = await import("@/lib/orchestrator/runner");
      const r = await findKeyPeople(ctx, { accountId: acc.id }, trigger);
      if (r.blocked) flow.steps.people = { status: "blocked", note: r.blocked };
      else {
        flow.people = pickKeyPeople(
          r.rows.map((p) => ({ name: p.name, title: p.title, linkedin: p.linkedin })),
          lead.contact_name,
        );
        flow.steps.people = flow.people.length
          ? {
              status: "done",
              note: `${flow.people.map((p) => `${p.name}${p.title ? ` (${p.title})` : ""}`).join(" · ")}${r.masked ? ". Añádelas al mapa desde la cuenta para ver su contacto" : ""}.`,
            }
          : { status: "done", note: "No se han encontrado personas clave." };
      }
    } catch (e) {
      flow.steps.people = { status: "failed", note: (e as Error).message.slice(0, 200) };
    }
  }

  if (acc) {
    const [{ data: icps }, { data: segs }] = await Promise.all([
      db
        .from("icp_profiles")
        .select(
          "id,segment_id,industries,company_size,geography,anti_icp,min_employees,max_employees,search_keywords",
        )
        .eq("org_id", orgId),
      db.from("segments").select("id,name").eq("org_id", orgId),
    ]);
    const { scoreAccount } = await import("@/lib/scoring");
    fit = scoreAccount(
      { ...acc, lastActivityAt: null, openDeals: 0 },
      icps ?? [],
      now,
      new Map((segs ?? []).map((s) => [s.id, s.name])),
    ).fit.score;
    lines.unshift(
      fit === null
        ? "Sin datos para medir el encaje con el ICP: completa sector y tamaño."
        : `Encaje con el ICP: ${fit} sobre 100.`,
    );
  }

  // 4 · AI proposal with the completed account; the stage move is only proposed (approve in Sugerencias).
  let proposal: { label: string; total: number } | null = null;
  let action: { tool: string; args: Record<string, unknown> } | null = null;
  try {
    const [{ qualifyLeadCore }, qual] = await Promise.all([
      import("@/lib/lead-qualify.server"),
      import("@/lib/lead-qualification"),
    ]);
    const q = await qualifyLeadCore(db, orgId, leadId, now);
    const { data: st } = await db
      .from("lead_settings")
      .select("qualification")
      .eq("org_id", orgId)
      .maybeSingle();
    const v = qual.qualificationView(q, qual.readQualSettings(st?.qualification), lead.stage);
    proposal = { label: qual.PROPOSAL_LABEL[v.proposal], total: v.total };
    flow.steps.proposal = {
      status: "done",
      note: `${v.total} sobre 100 → ${qual.PROPOSAL_LABEL[v.proposal]}. ${v.reason}${v.review ? " Revísalo: la IA no lo tiene claro." : ""}`,
    };
    if (v.move)
      action = {
        tool: "update_lead",
        args: {
          lead_id: leadId,
          stage: v.move,
          ...(v.move === "disqualified" ? { disqualified_reason: v.reason } : {}),
        },
      };
  } catch (e) {
    flow.steps.proposal = { status: "failed", note: (e as Error).message.slice(0, 200) };
  }

  const row = {
    org_id: orgId,
    detector: "lead_enriched",
    dedupe_key: `lead_enriched:${leadId}`,
    priority: (fit !== null && fit >= 70) || action?.args.stage === "sql" ? 2 : 3,
    title:
      `Lead nuevo: ${lead.company}${lead.contact_name ? ` (${lead.contact_name})` : ""}${proposal ? ` · ${proposal.label} (${proposal.total})` : fit !== null ? ` · encaje ${fit}` : ""}`.slice(
        0,
        200,
      ),
    body: [...flowLines(flow), ...lines].join("\n"),
    link: `/leads?lead=${leadId}`,
    action: action as unknown as Json,
    user_id: lead.owner_id,
  };
  // A repeat refreshes the pending proposal; the first run never revives a dismissed one.
  if (opts.force) {
    const { data: prev } = await db
      .from("suggestions")
      .select("id,status")
      .eq("org_id", orgId)
      .eq("dedupe_key", row.dedupe_key)
      .maybeSingle();
    if (prev)
      await db
        .from("suggestions")
        .update({
          title: row.title,
          body: row.body,
          action: row.action,
          priority: row.priority,
          status: "pending",
        })
        .eq("id", prev.id);
    else await db.from("suggestions").insert(row);
  } else
    await db
      .from("suggestions")
      .upsert(row, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
  await db
    .from("leads")
    .update({ enriched_at: now.toISOString(), flow: flow as unknown as Json })
    .eq("org_id", orgId)
    .eq("id", leadId);
  return { accountId, fit, steps: flow.steps };
}

// ---------------- Follow-up sequence with waits ----------------

/** The suggestion for one follow-up step if the lead still waits in Contactado; null when the sequence must stop. */
export async function followupStep(db: Admin, orgId: string, leadId: string, now = new Date()) {
  const { loadSnapshot } = await import("@/lib/org-data");
  const { followupSequence } = await import("@/lib/proactive/detectors/followup-sequence");
  const snap = await loadSnapshot(db, orgId, now, { fitKey: false });
  const lead = (snap.leads ?? []).find((l) => l.id === leadId);
  if (!lead || lead.stage !== "contacted") return { stop: true as const };
  const found = followupSequence({ ...snap, leads: [lead] });
  if (found.length)
    await db.from("suggestions").upsert(
      found.map((f) => ({ ...f, org_id: orgId, action: f.action as unknown as Json })),
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
  return { stop: false as const, created: found.length };
}
