// Qualifies one lead with Jev and stores the raw judgments on the lead. Shared by the screens (user client,
// RLS) and the lead enrichment job (admin client); every query filters by the company explicitly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildQualificationRequest, parseQualification, type Qualification } from "@/lib/lead-qualification";
import { askJev } from "@/lib/jev.server";

type Db = SupabaseClient<Database>;

export async function qualifyLeadCore(db: Db, orgId: string, leadId: string, now = new Date()): Promise<Qualification> {
  const { data: lead, error } = await db.from("leads").select("id,company,contact_name,email,title,source,notes,amount,segment_id,account_id").eq("org_id", orgId).eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!lead) throw new Error("No encuentro ese lead en esta empresa.");
  const [acc, icps, segs, pos] = await Promise.all([
    lead.account_id ? db.from("accounts").select("industry,size,country,notes,domain").eq("org_id", orgId).eq("id", lead.account_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("icp_profiles").select("name,segment_id,industries,company_size,geography,growth_stage,hiring_signals,funding_signals,anti_icp,why_fit").eq("org_id", orgId).limit(8),
    db.from("segments").select("id,name,acv_min,acv_max,notes").eq("org_id", orgId).order("acv_min").limit(12),
    db.from("positioning").select("product_name,category,target_customer,need,key_benefit,best_customers").eq("org_id", orgId).limit(1).maybeSingle(),
  ]);
  const segments = segs.data ?? [];
  const req = buildQualificationRequest({ lead, account: acc.data ?? null, icps: icps.data ?? [], segments, positioning: pos.data ?? null });
  const q = parseQualification(req, await askJev(req), segments, now);
  const { error: saveError } = await db.from("leads").update({ qualification: q as any, qualified_at: now.toISOString() }).eq("org_id", orgId).eq("id", leadId);
  if (saveError) throw saveError;
  return q;
}
