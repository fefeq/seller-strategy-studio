// Writes one normalized lead: account + person + lead, and a deal when it already carries a sales stage.
// Shared by the public lead link (privileged client) and the CSV import (user client with RLS),
// so every query scopes org_id explicitly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isPreDealStage, type NormalizedLead } from "@/lib/leads";
import { leadStageLabel } from "@/lib/lead-funnel";
import { firstOpenStage, sortStages, stageByLabel, type Stage } from "@/lib/stages";

type Db = SupabaseClient<Database>;
/** `stages`: the company's deal stages; loaded on first use when missing (pass them in a CSV loop). */
/** When a deal that arrives already closed was closed. A won deal with a close date still to come is closed as of now: «won» cannot be in the future (NK-0074). */
export function closedAtFor(
  stage: string,
  isClosed: boolean,
  closeDate: string | null,
  now = new Date(),
) {
  if (!isClosed) return null;
  const given = closeDate ? `${closeDate}T12:00:00Z` : null;
  const nowIso = now.toISOString();
  return given && !(stage === "won" && given > nowIso) ? given : nowIso;
}
/** The close day stored next to it: the given one, or today for a won deal whose day is still to come. */
export function closeDayFor(stage: string, closeDate: string | null, now = new Date()) {
  if (!closeDate) return closeDate;
  return stage === "won" && `${closeDate}T12:00:00Z` > now.toISOString()
    ? now.toISOString().slice(0, 10)
    : closeDate;
}

export type IngestCtx = {
  orgId: string;
  sourceId?: string | null;
  segments: { id: string; name: string }[];
  stages?: Stage[];
};
export type IngestResult = {
  status: "created" | "updated";
  accountId: string;
  dealId: string | null;
  leadId: string | null;
  accountCreated: boolean;
  summary: string;
};
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

const like = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const closed = (stage: string) => stage === "won" || stage === "lost";
const OPEN_LEAD = "(new,contacted,mql,sql)";

type LeadHit = {
  id: string;
  stage: string;
  deal_id: string | null;
  external_id: string | null;
  contact_name: string | null;
  email: string | null;
  person_id: string | null;
};
const LEAD_COLS = "id,stage,deal_id,external_id,contact_name,email,person_id";

/** Same lead: by its deal → external id → email → an open lead of the same account. */
async function findLead(
  db: Db,
  orgId: string,
  k: {
    dealId?: string | null;
    externalId?: string | null;
    email?: string | null;
    accountId: string;
  },
): Promise<LeadHit | null> {
  const base = () => db.from("leads").select(LEAD_COLS).eq("org_id", orgId);
  if (k.dealId) {
    const r = (await base().eq("deal_id", k.dealId).limit(1).maybeSingle()).data;
    if (r) return r;
  }
  if (k.externalId) {
    const r = (await base().eq("external_id", k.externalId).limit(1).maybeSingle()).data;
    if (r) return r;
  }
  const free = (r: LeadHit | null) =>
    r && (!k.dealId || !r.deal_id || r.deal_id === k.dealId) ? r : null;
  if (k.email) {
    const r = free(
      (
        await base()
          .ilike("email", like(k.email))
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
    );
    if (r) return r;
  }
  return free(
    (
      await base()
        .eq("account_id", k.accountId)
        .filter("stage", "in", OPEN_LEAD)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data,
  );
}

export async function ingestLead(
  db: Db,
  ctx: IngestCtx,
  lead: NormalizedLead,
): Promise<IngestResult> {
  const { orgId } = ctx;
  ctx.stages ??= sortStages(
    ((
      await db
        .from("deal_stages")
        .select("key,label,position,kind,board_group,probability")
        .eq("org_id", orgId)
    ).data ?? []) as Stage[],
  );
  const stages = ctx.stages;
  // A stage the company created («Piloto», «Implementación») is matched by its name before the standard
  // synonyms, unless the value is clearly a lead stage («Nuevo», «MQL»).
  const own =
    lead.rawStage && !(lead.stageRecognized && isPreDealStage(lead.stage))
      ? stageByLabel(lead.rawStage, stages)
      : null;
  // Written on the lead itself so the caller's «Etapa no reconocida» warning sees the match too.
  if (own) Object.assign(lead, { stage: own as NormalizedLead["stage"], stageRecognized: true });

  // 1. Account: same domain, otherwise same name.
  let account: { id: string; domain: string | null } | null = null;
  if (lead.domain)
    account = (
      await db
        .from("accounts")
        .select("id,domain")
        .eq("org_id", orgId)
        .ilike("domain", like(lead.domain))
        .limit(1)
        .maybeSingle()
    ).data;
  if (!account)
    account = (
      await db
        .from("accounts")
        .select("id,domain")
        .eq("org_id", orgId)
        .ilike("name", like(lead.company))
        .limit(1)
        .maybeSingle()
    ).data;
  let accountCreated = false;
  if (!account) {
    const { data, error } = await db
      .from("accounts")
      .insert({ org_id: orgId, name: lead.company, domain: lead.domain })
      .select("id,domain")
      .single();
    if (error) throw new Error(`Cuenta: ${error.message}`);
    account = data;
    accountCreated = true;
  } else if (!account.domain && lead.domain) {
    await db
      .from("accounts")
      .update({ domain: lead.domain })
      .eq("id", account.id)
      .eq("org_id", orgId);
  }

  // 2. Contact person (deduped by email).
  let personId: string | null = null;
  if (lead.email) {
    const { data: person } = await db
      .from("people")
      .select("id,account_id")
      .eq("org_id", orgId)
      .ilike("email", like(lead.email))
      .limit(1)
      .maybeSingle();
    if (!person) {
      const { data, error } = await db
        .from("people")
        .insert({
          org_id: orgId,
          full_name: lead.fullName ?? lead.email,
          email: lead.email,
          title: lead.title,
          linkedin_url: lead.linkedin,
          company: lead.company,
          account_id: account.id,
          source: lead.source ?? "Entrada de leads",
          crm_stage: lead.stage,
        })
        .select("id")
        .single();
      if (error && !/duplicate/i.test(error.message)) throw new Error(`Persona: ${error.message}`);
      personId = data?.id ?? null;
    } else {
      personId = person.id;
      await db
        .from("people")
        .update({ crm_stage: lead.stage, ...(person.account_id ? {} : { account_id: account.id }) })
        .eq("id", person.id)
        .eq("org_id", orgId);
    }
  }

  const segmentId = lead.segment
    ? (ctx.segments.find((s) => s.name.trim().toLowerCase() === lead.segment!.trim().toLowerCase())
        ?.id ?? null)
    : null;
  const enteredAt =
    lead.enteredAt && new Date(lead.enteredAt) <= new Date() ? lead.enteredAt : null;
  const contactPatch = (hit: LeadHit | null): LeadUpdate => ({
    ...(!hit?.contact_name && lead.fullName ? { contact_name: lead.fullName } : {}),
    ...(!hit?.email && lead.email ? { email: lead.email } : {}),
    ...(!hit?.person_id && personId ? { person_id: personId } : {}),
    ...(lead.title ? { title: lead.title } : {}),
    ...(segmentId ? { segment_id: segmentId } : {}),
  });

  // 3a. Still a lead (Nuevo, Contactado, MQL, SQL, Descartado): no deal yet.
  if (isPreDealStage(lead.stage)) {
    const hit = await findLead(db, orgId, {
      externalId: lead.externalId,
      email: lead.email,
      accountId: account.id,
    });
    if (hit) {
      // A lead already converted keeps its opportunity; CRMs often send the old lead status late.
      const patch: LeadUpdate = { ...contactPatch(hit) };
      if (lead.stageGiven && hit.stage !== "opportunity") patch.stage = lead.stage;
      if (lead.amount != null) patch.amount = lead.amount;
      if (lead.externalId && !hit.external_id) patch.external_id = lead.externalId;
      if (Object.keys(patch).length) {
        const { error } = await db.from("leads").update(patch).eq("id", hit.id).eq("org_id", orgId);
        if (error) throw new Error(`Lead: ${error.message}`);
      }
      const label = patch.stage ? leadStageLabel(patch.stage) : "sin cambio de etapa";
      return {
        status: "updated",
        accountId: account.id,
        dealId: hit.deal_id,
        leadId: hit.id,
        accountCreated,
        summary: `${lead.company} · ${label}`,
      };
    }
    const { data, error } = await db
      .from("leads")
      .insert({
        org_id: orgId,
        company: lead.company,
        contact_name: lead.fullName,
        email: lead.email,
        title: lead.title,
        account_id: account.id,
        person_id: personId,
        stage: lead.stage,
        source: lead.source ?? "Entrada de leads",
        lead_source_id: ctx.sourceId ?? null,
        segment_id: segmentId,
        external_id: lead.externalId,
        amount: lead.amount,
        ...(enteredAt ? { created_at: enteredAt } : {}),
      })
      .select("id")
      .single();
    if (error) throw new Error(`Lead: ${error.message}`);
    return {
      status: "created",
      accountId: account.id,
      dealId: null,
      leadId: data.id,
      accountCreated,
      summary: `${lead.company} · ${leadStageLabel(lead.stage)}`,
    };
  }

  // 3b. Sales stage: the deal (same external id → open deal of the account → same closed deal from that day).
  // A standard stage the company removed gives a new deal its first open stage; an existing deal keeps
  // its stage rather than fail.
  const known = stages.find((s) => s.key === lead.stage);
  const target = known ?? firstOpenStage(stages);
  const stage = target.key;
  const stageName = (id: string) => stages.find((s) => s.key === id)?.label ?? leadStageLabel(id);
  let deal: { id: string; stage: string } | null = null;
  if (lead.externalId)
    deal = (
      await db
        .from("deals")
        .select("id,stage")
        .eq("org_id", orgId)
        .eq("external_id", lead.externalId)
        .maybeSingle()
    ).data;
  if (!deal && lead.externalId) {
    // The lead may have converted already: its deal is the one to update.
    const l = (
      await db
        .from("leads")
        .select("deal_id")
        .eq("org_id", orgId)
        .eq("external_id", lead.externalId)
        .not("deal_id", "is", null)
        .maybeSingle()
    ).data;
    if (l?.deal_id)
      deal = (
        await db
          .from("deals")
          .select("id,stage")
          .eq("org_id", orgId)
          .eq("id", l.deal_id)
          .maybeSingle()
      ).data;
  }
  if (!deal) {
    const { data: list } = await db
      .from("deals")
      .select("id,stage,created_at,external_id")
      .eq("org_id", orgId)
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const candidates = (list ?? []).filter((d) => !lead.externalId || !d.external_id);
    deal =
      candidates.find((d) => !closed(d.stage)) ??
      candidates.find(
        (d) =>
          d.stage === stage &&
          (!lead.enteredAt || d.created_at.slice(0, 10) === lead.enteredAt.slice(0, 10)),
      ) ??
      null;
  }
  const closedAt = closedAtFor(stage, closed(stage), lead.closeDate ?? null);
  // The close day follows the close moment: a won deal capped to now is not left with a day still to come.
  const closeDay = closeDayFor(stage, lead.closeDate ?? null);
  const stageLabel = lead.stageGiven && known ? stageName(stage) : "sin cambio de etapa";
  let status: IngestResult["status"] = "updated";

  if (deal) {
    const patch: Database["public"]["Tables"]["deals"]["Update"] = {};
    if (lead.stageGiven && known) {
      patch.stage = stage;
      patch.probability = target.probability;
      if (closedAt && !closed(deal.stage)) patch.closed_at = closedAt;
    }
    if (lead.amount != null) patch.amount = lead.amount;
    if (closeDay) patch.close_date = closeDay;
    if (segmentId) patch.segment_id = segmentId;
    if (lead.externalId) patch.external_id = lead.externalId;
    if (Object.keys(patch).length) {
      const { error } = await db.from("deals").update(patch).eq("id", deal.id).eq("org_id", orgId);
      if (error) throw new Error(`Deal: ${error.message}`);
    }
  } else {
    const { data: created, error } = await db
      .from("deals")
      .insert({
        org_id: orgId,
        account_id: account.id,
        name: lead.dealName ?? lead.company,
        stage,
        probability: target.probability,
        amount: lead.amount,
        close_date: closeDay,
        source: lead.source ?? "Entrada de leads",
        external_id: lead.externalId,
        lead_source_id: ctx.sourceId ?? null,
        segment_id: segmentId,
        closed_at: closedAt,
        ...(enteredAt ? { created_at: enteredAt } : {}),
      })
      .select("id,stage")
      .single();
    if (error) throw new Error(`Deal: ${error.message}`);
    deal = created;
    status = "created";
  }

  // 4. The lead behind the deal is now an Oportunidad.
  const hit = await findLead(db, orgId, {
    dealId: deal.id,
    externalId: lead.externalId,
    email: lead.email,
    accountId: account.id,
  });
  let leadId: string | null = hit?.id ?? null;
  if (hit) {
    const patch: LeadUpdate = { ...contactPatch(hit), deal_id: deal.id };
    if (hit.stage !== "opportunity") patch.stage = "opportunity";
    await db.from("leads").update(patch).eq("id", hit.id).eq("org_id", orgId);
  } else {
    const { data } = await db
      .from("leads")
      .insert({
        org_id: orgId,
        company: lead.company,
        contact_name: lead.fullName,
        email: lead.email,
        title: lead.title,
        account_id: account.id,
        person_id: personId,
        deal_id: deal.id,
        stage: "opportunity",
        source: lead.source ?? "Entrada de leads",
        lead_source_id: ctx.sourceId ?? null,
        segment_id: segmentId,
        amount: lead.amount,
        ...(enteredAt ? { created_at: enteredAt } : {}),
      })
      .select("id")
      .single();
    leadId = data?.id ?? null;
  }
  return {
    status,
    accountId: account.id,
    dealId: deal.id,
    leadId,
    accountCreated,
    summary: `${lead.company} · ${status === "created" ? stageName(stage) : stageLabel}`,
  };
}

/** SHA-256 hex of a lead-link key; only the hash is stored. */
export async function hashLeadKey(key: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
