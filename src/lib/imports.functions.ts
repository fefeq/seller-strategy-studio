import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { errorText } from "@/lib/errors";
import { cleanDomain } from "@/lib/account-import";
import { planUndo, type AppliedResult, type UndoRow } from "@/lib/import-batch";
import type { Db } from "@/lib/org-data";
import type { Stage } from "@/lib/stages";
import type { Json } from "@/integrations/supabase/types";

type Ctx = { supabase: Db; userId: string };
const UUID = /^[0-9a-f-]{36}$/i;

async function memberRole(c: Ctx) {
  const { data: profile } = await c.supabase
    .from("profiles")
    .select("current_org_id")
    .eq("id", c.userId)
    .single();
  const orgId = profile?.current_org_id as string | undefined;
  if (!orgId) throw new Error("Selecciona una empresa");
  const { data: m } = await c.supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", c.userId)
    .maybeSingle();
  return { orgId, role: (m?.role ?? "") as string };
}

function validIds(input: { batchId?: unknown; rowIds?: unknown }) {
  if (typeof input?.batchId !== "string" || !UUID.test(input.batchId))
    throw new Error("Lote no válido");
  const rowIds = Array.isArray(input.rowIds)
    ? input.rowIds.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 500)
    : undefined;
  return { batchId: input.batchId, rowIds };
}

async function refreshBatch(c: Ctx, batchId: string, patch: Record<string, unknown> = {}) {
  const { data: rows } = await c.supabase
    .from("import_rows")
    .select("status,result")
    .eq("batch_id", batchId);
  const list = (rows ?? []) as { status: string; result: AppliedResult | null }[];
  const pending = list.filter((r) => r.status === "pending").length;
  const applied = list.filter((r) => r.status === "applied");
  const status =
    pending === 0
      ? applied.length
        ? "approved"
        : "discarded"
      : pending === list.length
        ? "pending"
        : "partial";
  await c.supabase
    .from("import_batches")
    .update({
      status,
      created_count: applied.filter((r) => r.result?.status === "created").length,
      updated_count: applied.filter((r) => r.result?.status === "updated").length,
      error_count: list.filter((r) => r.status === "error").length,
      ...patch,
    })
    .eq("id", batchId);
}

/** Approves a quarantined batch (or some rows): writes them with the same importers as CSV, as the signed-in user (RLS). */
export const approveImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validIds)
  .handler(async ({ data, context }) => {
    const c = context as unknown as Ctx;
    const { orgId, role } = await memberRole(c);
    if (!["owner", "sales_leader", "marketing"].includes(role))
      throw new Error("Solo Owner, Sales Leader o Marketing pueden aprobar importaciones");
    const { data: batch } = await c.supabase
      .from("import_batches")
      .select("id,kind,lead_source_id,status")
      .eq("id", data.batchId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!batch) throw new Error("No se encuentra el lote");
    if (batch.status === "undone" || batch.status === "discarded")
      throw new Error("Este lote ya está cerrado");
    let q = c.supabase
      .from("import_rows")
      .select("id,raw,action")
      .eq("batch_id", batch.id)
      .eq("status", "pending")
      .order("line");
    if (data.rowIds) q = q.in("id", data.rowIds);
    const { data: rows } = await q.limit(500);
    const pending = (rows ?? []) as { id: string; raw: Record<string, unknown>; action: string }[];
    const out = { created: 0, updated: 0, errors: 0, skipped: 0 };
    const newLeads: string[] = [];
    const now = () => new Date().toISOString();

    const { data: segments } = await c.supabase
      .from("segments")
      .select("id,name")
      .eq("org_id", orgId);
    if (batch.kind === "leads") {
      const { ingestLead } = await import("@/lib/leads-ingest");
      const { normalizeLead, isIntakeStage } = await import("@/lib/leads");
      const { sortStages } = await import("@/lib/stages");
      const { data: stageRows } = await c.supabase
        .from("deal_stages")
        .select("key,label,position,kind,board_group,probability")
        .eq("org_id", orgId);
      const { data: src } = batch.lead_source_id
        ? await c.supabase
            .from("lead_sources")
            .select("default_stage")
            .eq("id", batch.lead_source_id)
            .maybeSingle()
        : { data: null };
      const ctx = {
        orgId,
        sourceId: batch.lead_source_id,
        segments: segments ?? [],
        stages: sortStages((stageRows ?? []) as Stage[]),
      };
      const stage = src && isIntakeStage(src.default_stage, ctx.stages) ? src.default_stage : "new";
      for (const r of pending) {
        if (r.action === "skip") {
          await c.supabase.from("import_rows").update({ status: "discarded" }).eq("id", r.id);
          out.skipped++;
          continue;
        }
        const n = normalizeLead(r.raw, { defaultStage: stage });
        if ("error" in n) {
          await c.supabase
            .from("import_rows")
            .update({ status: "error", error: n.error })
            .eq("id", r.id);
          out.errors++;
          continue;
        }
        try {
          const res = await ingestLead(c.supabase, ctx, n.lead);
          const result: AppliedResult = {
            status: res.status,
            accountId: res.accountId,
            accountCreated: res.accountCreated,
            leadId: res.leadId,
            dealId: res.dealId,
          };
          await c.supabase
            .from("import_rows")
            .update({ status: "applied", applied_at: now(), result: result as unknown as Json })
            .eq("id", r.id);
          await c.supabase.from("lead_events").insert({
            org_id: orgId,
            lead_source_id: batch.lead_source_id,
            channel: "link",
            status: res.status,
            summary: res.summary,
            account_id: res.accountId,
            deal_id: res.dealId,
            lead_id: res.leadId,
          });
          out[res.status]++;
          if (res.status === "created" && res.leadId) newLeads.push(res.leadId);
        } catch (e) {
          await c.supabase
            .from("import_rows")
            .update({ status: "error", error: errorText(e).slice(0, 300) })
            .eq("id", r.id);
          out.errors++;
        }
      }
    } else {
      // Re-check duplicates at approval time: an account may have been created since the batch arrived.
      for (const r of pending) {
        if (r.action === "skip") {
          await c.supabase.from("import_rows").update({ status: "discarded" }).eq("id", r.id);
          out.skipped++;
          continue;
        }
        const row = r.raw as { name?: string; domain?: string | null };
        const name = String(row.name ?? "").trim();
        const domain = cleanDomain(row.domain ?? null);
        const dup = domain
          ? (
              await c.supabase
                .from("accounts")
                .select("id")
                .eq("org_id", orgId)
                .ilike("domain", domain)
                .limit(1)
                .maybeSingle()
            ).data
          : (
              await c.supabase
                .from("accounts")
                .select("id")
                .eq("org_id", orgId)
                .ilike(
                  "name",
                  name.replace(/[\\%_]/g, (x) => `\\${x}`),
                )
                .limit(1)
                .maybeSingle()
            ).data;
        if (dup) {
          await c.supabase
            .from("import_rows")
            .update({ status: "discarded", reason: "ya existe" })
            .eq("id", r.id);
          out.skipped++;
          continue;
        }
        const { data: acc, error } = await c.supabase
          .from("accounts")
          .insert({
            name,
            domain,
            industry: (r.raw.industry as string) ?? null,
            size: (r.raw.size as string) ?? null,
            tier: (r.raw.tier as string) ?? null,
            segment_id: (r.raw.segment_id as string) ?? null,
            notes: (r.raw.notes as string) ?? null,
            is_target: true,
          })
          .select("id")
          .single();
        if (error) {
          await c.supabase
            .from("import_rows")
            .update({ status: "error", error: errorText(error).slice(0, 300) })
            .eq("id", r.id);
          out.errors++;
          continue;
        }
        await c.supabase.from("account_plans").insert({ account_id: acc.id });
        const result: AppliedResult = {
          status: "created",
          accountId: acc.id,
          accountCreated: true,
          leadId: null,
          dealId: null,
        };
        await c.supabase
          .from("import_rows")
          .update({ status: "applied", applied_at: now(), result: result as unknown as Json })
          .eq("id", r.id);
        out.created++;
      }
    }
    await refreshBatch(c, batch.id, { decided_by: c.userId, decided_at: now() });
    if (newLeads.length) {
      const { EV } = await import("@/lib/inngest/events");
      const { trySend } = await import("@/lib/inngest/send.server");
      await trySend(
        newLeads.map((id) => ({ name: EV.leadCreated, data: { org_id: orgId, lead_id: id } })),
      );
    }
    return out;
  });

export const discardImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validIds)
  .handler(async ({ data, context }) => {
    const c = context as unknown as Ctx;
    const { orgId, role } = await memberRole(c);
    if (!["owner", "sales_leader", "marketing"].includes(role))
      throw new Error("Solo Owner, Sales Leader o Marketing pueden descartar importaciones");
    let q = c.supabase
      .from("import_rows")
      .update({ status: "discarded" })
      .eq("batch_id", data.batchId)
      .eq("org_id", orgId)
      .eq("status", "pending");
    if (data.rowIds) q = q.in("id", data.rowIds);
    const { error } = await q;
    if (error) throw new Error(errorText(error));
    await refreshBatch(c, data.batchId, {
      decided_by: c.userId,
      decided_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/** Owner only: deletes what the batch created and nobody touched since; updates of existing records stay. */
export const undoImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validIds)
  .handler(async ({ data, context }) => {
    const c = context as unknown as Ctx;
    const { orgId, role } = await memberRole(c);
    if (role !== "owner") throw new Error("Solo el Owner puede deshacer una importación");
    const { data: rows } = await c.supabase
      .from("import_rows")
      .select("id,status,applied_at,result")
      .eq("batch_id", data.batchId)
      .eq("org_id", orgId);
    const list = (rows ?? []) as UndoRow[];
    const res = list.map((r) => r.result).filter(Boolean) as AppliedResult[];
    const leadIds = res.map((r) => r.leadId).filter(Boolean) as string[];
    const accIds = res
      .filter((r) => r.accountCreated)
      .map((r) => r.accountId)
      .filter(Boolean) as string[];
    const [leads, accs, otherLeads, deals] = await Promise.all([
      leadIds.length
        ? c.supabase.from("leads").select("id,updated_at").in("id", leadIds)
        : { data: [] },
      accIds.length
        ? c.supabase.from("accounts").select("id,updated_at").in("id", accIds)
        : { data: [] },
      accIds.length
        ? c.supabase.from("leads").select("id,account_id").in("account_id", accIds)
        : { data: [] },
      accIds.length
        ? c.supabase.from("deals").select("account_id").in("account_id", accIds)
        : { data: [] },
    ]);
    const batchLeads = new Set(leadIds);
    const accountsWithOther = new Set<string>([
      ...((otherLeads.data ?? []) as { id: string; account_id: string }[])
        .filter((l) => !batchLeads.has(l.id))
        .map((l) => l.account_id),
      ...((deals.data ?? []) as { account_id: string }[]).map((d) => d.account_id),
    ]);
    const plan = planUndo(list, {
      leads: new Map(
        ((leads.data ?? []) as { id: string; updated_at: string }[]).map((l) => [
          l.id,
          l.updated_at,
        ]),
      ),
      accounts: new Map(
        ((accs.data ?? []) as { id: string; updated_at: string }[]).map((a) => [
          a.id,
          a.updated_at,
        ]),
      ),
      accountsWithOther,
    });
    if (plan.leads.length) {
      const { error } = await c.supabase
        .from("leads")
        .delete()
        .in("id", plan.leads)
        .eq("org_id", orgId);
      if (error) throw new Error(errorText(error));
    }
    if (plan.accounts.length) {
      const { error } = await c.supabase
        .from("accounts")
        .delete()
        .in("id", plan.accounts)
        .eq("org_id", orgId);
      if (error) throw new Error(errorText(error));
    }
    if (plan.undone.length)
      await c.supabase.from("import_rows").update({ status: "undone" }).in("id", plan.undone);
    await c.supabase
      .from("import_batches")
      .update({ status: "undone", undone_by: c.userId, undone_at: new Date().toISOString() })
      .eq("id", data.batchId);
    return { undone: plan.undone.length, kept: plan.kept.length };
  });
