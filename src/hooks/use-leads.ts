import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { readSla, type DealOutcome, type LeadSla } from "@/lib/lead-funnel";
import type { AccountFitInput, IcpProfile } from "@/lib/scoring";
import { readQualSettings, type QualSettings } from "@/lib/lead-qualification";
import { fetchAll } from "@/lib/fetch-all";

export type Lead = Tables<"leads">;
export type LeadsData = {
  leads: Lead[];
  deals: DealOutcome[];
  sla: LeadSla;
  /** Weights and thresholds that turn the stored AI judgments into a proposed stage. */
  qualSettings: QualSettings;
  segments: { id: string; name: string }[];
  members: { id: string; full_name: string }[];
  /** For the score: the ICPs and the accounts' segment, sector, size and tier. */
  icps: IcpProfile[];
  accounts: Map<string, AccountFitInput>;
};

/** Leads of the current company plus what the screen and the funnel need. Key "leads" is refreshed live. */
export function useLeads(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["leads", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<LeadsData> => {
      const [l, d, s, seg, m, icp, acc] = await Promise.all([
        fetchAll((a, b) => supabase.from("leads").select("*").order("created_at", { ascending: false }).order("id").range(a, b)).then((r) => ({ data: r.rows, error: null, truncated: r.truncated })),
        fetchAll((a, b) => supabase.from("deals").select("id,stage,closed_at").order("id").range(a, b)).then((r) => ({ data: r.rows })),
        supabase.from("lead_settings").select("sla,qualification").maybeSingle(),
        supabase.from("segments").select("id,name").order("acv_min"),
        supabase.from("org_members").select("user_id").eq("org_id", orgId!),
        supabase.from("icp_profiles").select("id,segment_id,industries,company_size,geography,anti_icp,min_employees,max_employees,search_keywords"),
        fetchAll((a, b) => supabase.from("accounts").select("id,segment_id,industry,size,tier,name").order("id").range(a, b)).then((r) => ({ data: r.rows })),
      ]);
      if (l.error) throw new Error(l.error.message);
      const ids = (m.data ?? []).map((x) => x.user_id);
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      return {
        leads: l.data ?? [],
        deals: d.data ?? [],
        sla: readSla(s.data?.sla),
        qualSettings: readQualSettings(s.data?.qualification),
        segments: seg.data ?? [],
        members: (profiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name ?? "Sin nombre" })),
        icps: icp.data ?? [],
        accounts: new Map((acc.data ?? []).map((a) => [a.id, a])),
      };
    },
  });
}
