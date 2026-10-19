// Writes one normalized lead as account + person + deal. Shared by the public lead link
// (privileged client) and the CSV import (user client with RLS), so every query scopes org_id explicitly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { STAGE_PROBABILITY, type NormalizedLead } from "@/lib/leads";

type Db = SupabaseClient<Database>;
export type IngestCtx = { orgId: string; sourceId?: string | null; segments: { id: string; name: string }[] };
export type IngestResult = { status: "created" | "updated"; accountId: string; dealId: string; accountCreated: boolean; summary: string };

const like = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const closed = (stage: string) => stage === "won" || stage === "lost";

export async function ingestLead(db: Db, ctx: IngestCtx, lead: NormalizedLead): Promise<IngestResult> {
  const { orgId } = ctx;

  // 1. Account: same domain, otherwise same name.
  let account: { id: string; domain: string | null } | null = null;
  if (lead.domain) account = (await db.from("accounts").select("id,domain").eq("org_id", orgId).ilike("domain", like(lead.domain)).limit(1).maybeSingle()).data;
  if (!account) account = (await db.from("accounts").select("id,domain").eq("org_id", orgId).ilike("name", like(lead.company)).limit(1).maybeSingle()).data;
  let accountCreated = false;
  if (!account) {
    const { data, error } = await db.from("accounts").insert({ org_id: orgId, name: lead.company, domain: lead.domain }).select("id,domain").single();
    if (error) throw new Error(`Cuenta: ${error.message}`);
    account = data;
    accountCreated = true;
  } else if (!account.domain && lead.domain) {
    await db.from("accounts").update({ domain: lead.domain }).eq("id", account.id).eq("org_id", orgId);
  }

  // 2. Contact person (deduped by email).
  if (lead.email) {
    const { data: person } = await db.from("people").select("id,account_id").eq("org_id", orgId).ilike("email", like(lead.email)).limit(1).maybeSingle();
    if (!person) {
      const { error } = await db.from("people").insert({ org_id: orgId, full_name: lead.fullName ?? lead.email, email: lead.email, title: lead.title, linkedin_url: lead.linkedin, company: lead.company, account_id: account.id, source: lead.source ?? "Entrada de leads", crm_stage: lead.stage });
      if (error && !/duplicate/i.test(error.message)) throw new Error(`Persona: ${error.message}`);
    } else {
      await db.from("people").update({ crm_stage: lead.stage, ...(person.account_id ? {} : { account_id: account.id }) }).eq("id", person.id).eq("org_id", orgId);
    }
  }

  // 3. Deal: same external id → open deal of the account → same closed deal from that day.
  let deal: { id: string; stage: string } | null = null;
  if (lead.externalId) deal = (await db.from("deals").select("id,stage").eq("org_id", orgId).eq("external_id", lead.externalId).maybeSingle()).data;
  if (!deal) {
    const { data: list } = await db.from("deals").select("id,stage,created_at,external_id").eq("org_id", orgId).eq("account_id", account.id).order("created_at", { ascending: false }).limit(20);
    const candidates = (list ?? []).filter((d) => !lead.externalId || !d.external_id);
    deal = candidates.find((d) => !closed(d.stage))
      ?? candidates.find((d) => d.stage === lead.stage && (!lead.enteredAt || d.created_at.slice(0, 10) === lead.enteredAt.slice(0, 10)))
      ?? null;
  }
  const segmentId = lead.segment ? ctx.segments.find((s) => s.name.trim().toLowerCase() === lead.segment!.trim().toLowerCase())?.id ?? null : null;
  const closedAt = closed(lead.stage) ? (lead.closeDate ? `${lead.closeDate}T12:00:00Z` : new Date().toISOString()) : null;
  const stageLabel = lead.stageGiven ? lead.stage : "sin etapa";

  if (deal) {
    const patch: Database["public"]["Tables"]["deals"]["Update"] = {};
    if (lead.stageGiven) { patch.stage = lead.stage; patch.probability = STAGE_PROBABILITY[lead.stage]; if (closedAt && !closed(deal.stage)) patch.closed_at = closedAt; }
    if (lead.amount != null) patch.amount = lead.amount;
    if (lead.closeDate) patch.close_date = lead.closeDate;
    if (segmentId) patch.segment_id = segmentId;
    if (lead.externalId) patch.external_id = lead.externalId;
    if (Object.keys(patch).length) {
      const { error } = await db.from("deals").update(patch).eq("id", deal.id).eq("org_id", orgId);
      if (error) throw new Error(`Deal: ${error.message}`);
    }
    return { status: "updated", accountId: account.id, dealId: deal.id, accountCreated, summary: `${lead.company} · ${stageLabel}` };
  }

  const { data: created, error } = await db.from("deals").insert({
    org_id: orgId,
    account_id: account.id,
    name: lead.dealName ?? lead.company,
    stage: lead.stage,
    probability: STAGE_PROBABILITY[lead.stage],
    amount: lead.amount,
    close_date: lead.closeDate,
    source: lead.source ?? "Entrada de leads",
    external_id: lead.externalId,
    lead_source_id: ctx.sourceId ?? null,
    segment_id: segmentId,
    closed_at: closedAt,
    ...(lead.enteredAt && new Date(lead.enteredAt) <= new Date() ? { created_at: lead.enteredAt } : {}),
  }).select("id").single();
  if (error) throw new Error(`Deal: ${error.message}`);
  return { status: "created", accountId: account.id, dealId: created.id, accountCreated, summary: `${lead.company} · ${lead.stage}` };
}

/** SHA-256 hex of a lead-link key; only the hash is stored. */
export async function hashLeadKey(key: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
