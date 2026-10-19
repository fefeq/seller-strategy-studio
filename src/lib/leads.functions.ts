import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEAD_LIMITS, normalizeLead, type DealStage } from "@/lib/leads";
import { DEAL_STAGES } from "@/lib/roles";

type Input = { rows: Record<string, string>[]; defaultStage?: string };

/** CSV import: same rules as the public lead link, but runs as the signed-in user (RLS applies). */
export const importLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!Array.isArray(input?.rows) || input.rows.length === 0) throw new Error("No hay filas para importar");
    if (input.rows.length > LEAD_LIMITS.maxLeads) throw new Error(`Máximo ${LEAD_LIMITS.maxLeads} filas por envío`);
    const stage = DEAL_STAGES.some((s) => s.id === input.defaultStage) ? (input.defaultStage as DealStage) : "discovery";
    return { rows: input.rows.map((r) => Object.fromEntries(Object.entries(r ?? {}).slice(0, 60).map(([k, v]) => [String(k).slice(0, 120), String(v ?? "").slice(0, 2000)]))), defaultStage: stage };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("current_org_id").eq("id", userId).single();
    const orgId = profile?.current_org_id;
    if (!orgId) throw new Error("Selecciona una empresa");
    const { ingestLead } = await import("@/lib/leads-ingest");
    const { data: segments } = await supabase.from("segments").select("id,name").eq("org_id", orgId);
    const ctx = { orgId, segments: segments ?? [] };
    const out = { created: 0, updated: 0, errors: [] as { row: number; error: string }[] };
    for (const [i, rec] of data.rows.entries()) {
      const n = normalizeLead(rec, { defaultStage: data.defaultStage, source: "CSV" });
      if ("error" in n) { out.errors.push({ row: i, error: n.error }); continue; }
      try {
        const r = await ingestLead(supabase, ctx, n.lead);
        out[r.status] += 1;
        await supabase.from("lead_events").insert({ org_id: orgId, channel: "csv", status: r.status, summary: r.summary, account_id: r.accountId, deal_id: r.dealId, error: n.lead.stageRecognized ? null : "Etapa no reconocida: se usó la etapa por defecto" });
      } catch (e) {
        out.errors.push({ row: i, error: (e as Error).message.slice(0, 200) });
      }
    }
    if (out.errors.length) await supabase.from("lead_events").insert({ org_id: orgId, channel: "csv", status: "error", summary: `${out.errors.length} filas sin importar`, error: out.errors.slice(0, 5).map((e) => `Fila ${e.row + 2}: ${e.error}`).join(" · ") });
    return out;
  });
