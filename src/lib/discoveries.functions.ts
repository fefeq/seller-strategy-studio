// «Descubiertos» from the screen: run the weekly search now (Owner / Sales Leader) and accept or dismiss a find
// (any member, with their own RLS client). Accepting turns it into an account, a lead + stakeholder, or a known
// competitor; dismissing stores the reason in memory so Nokko does not propose it again.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { appendCompetitor, dismissMemory, type DiscoveryKind } from "@/lib/discoveries";

export const runDiscoveryNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!ctx.roles.some((r) => r === "owner" || r === "sales_leader")) throw new Error("Solo el Owner o el Sales Leader pueden lanzar la búsqueda.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { discoverForOrg } = await import("@/lib/discoveries.server");
    return discoverForOrg(supabaseAdmin, ctx.orgId, new Date(), { force: true, trigger: "manual", userId: ctx.userId });
  });

export const decideDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), decision: z.enum(["accept", "dismiss"]), reason: z.string().trim().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const db = ctx.db;
    const { data: d, error } = await db.from("discoveries").select("id,kind,name,detail,status").eq("org_id", ctx.orgId).eq("id", data.id).maybeSingle();
    if (error) throw error;
    if (!d) throw new Error("No encuentro ese descubrimiento en esta empresa.");
    if (d.status !== "pending") throw new Error("Ya estaba decidido.");
    const det = (d.detail ?? {}) as Record<string, string | null>;
    const decided = { decided_by: ctx.userId, decided_at: new Date().toISOString() };

    if (data.decision === "dismiss") {
      const { error: e } = await db.from("discoveries").update({ status: "dismissed", dismiss_reason: data.reason || null, ...decided }).eq("org_id", ctx.orgId).eq("id", d.id);
      if (e) throw e;
      const { saveFacts } = await import("@/lib/memory.server");
      try { await saveFacts(ctx, [dismissMemory(d.kind as DiscoveryKind, d.name, data.reason || null)], "decision"); } catch (err) { console.error("discovery memory", err); }
      return { ok: true, message: "Descartado. Nokko lo recordará." };
    }

    let resultId: string | null = null;
    let message = "";
    if (d.kind === "company") {
      const { data: acc, error: e } = await db.from("accounts").insert({ name: d.name, domain: det["domain"] ?? null, industry: det["industry"] ?? null, size: det["size"] ?? null, country: det["country"] ?? null, linkedin_url: det["linkedin"] ?? null, notes: det["description"] ?? null, owner_id: ctx.userId }).select("id").single();
      if (e) throw e;
      await db.from("account_plans").insert({ account_id: acc.id });
      resultId = acc.id;
      message = `${d.name} ya está en Cuentas.`;
    } else if (d.kind === "contact") {
      const accountId = det["account_id"];
      if (accountId) {
        const { error: e } = await db.from("stakeholders").insert({ account_id: accountId, name: d.name, title: det["title"] ?? null, linkedin_url: det["linkedin"] ?? null });
        if (e) console.error("discovery stakeholder", e.message);
      }
      const { data: lead, error: e } = await db.from("leads").insert({ company: det["account_name"] || d.name, contact_name: d.name, title: det["title"] ?? null, account_id: accountId ?? null, source: "Descubiertos", stage: "new", owner_id: ctx.userId }).select("id").single();
      if (e) throw e;
      resultId = lead.id;
      message = `${d.name} está en Leads y en el mapa de poder de ${det["account_name"] ?? "su cuenta"}.`;
    } else {
      const { data: pos } = await db.from("positioning").select("id,competitive_alternative").eq("org_id", ctx.orgId).limit(1).maybeSingle();
      if (!pos) throw new Error("Primero rellena el posicionamiento de tu empresa.");
      const { error: e } = await db.from("positioning").update({ competitive_alternative: appendCompetitor(pos.competitive_alternative, d.name) }).eq("org_id", ctx.orgId).eq("id", pos.id);
      if (e) throw e;
      resultId = pos.id;
      message = `${d.name} añadido a tus competidores en Posicionamiento.`;
    }
    const { error: e } = await db.from("discoveries").update({ status: "accepted", result_id: resultId, ...decided }).eq("org_id", ctx.orgId).eq("id", d.id);
    if (e) throw e;
    return { ok: true, message, resultId };
  });
