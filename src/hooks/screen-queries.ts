// Main queries of Inicio, Cuentas and Pipeline as queryOptions, so each route loader can prepare the data
// before the screen opens (no empty first paint) and the component reads the same cache entry.
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { meQuery } from "@/hooks/use-me";
import { leadsQuery } from "@/hooks/use-leads";

export const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const [deals, meetings, approvals, people, accounts] = await Promise.all([
      supabase.from("deals").select("id,name,stage,amount,probability,health,close_date,owner_id"),
      supabase.from("meetings").select("id,title,scheduled_at,account_id").gte("scheduled_at", new Date(Date.now() - 864e5).toISOString()).order("scheduled_at").limit(6),
      supabase.from("approvals").select("id").eq("status", "pending"),
      supabase.from("people").select("id,tier,crm_stage"),
      supabase.from("accounts").select("id,name,health"),
    ]);
    return { deals: deals.data ?? [], meetings: meetings.data ?? [], approvals: approvals.data ?? [], people: people.data ?? [], accounts: accounts.data ?? [] };
  },
});

export const accountsQuery = queryOptions({
  queryKey: ["accounts"],
  queryFn: async () => (await fetchAll((a, b) => supabase.from("accounts").select("*, deals(amount,stage,updated_at), stakeholders(id), account_touches(occurred_at), meetings(scheduled_at), calls(occurred_at)").order("name").order("id").range(a, b))).rows,
});

export const accountsScoreContextQuery = queryOptions({
  queryKey: ["accounts-score-context"],
  queryFn: async () => {
    const [icp, seg] = await Promise.all([
      supabase.from("icp_profiles").select("id,segment_id,industries,company_size,geography,anti_icp,min_employees,max_employees,search_keywords"),
      supabase.from("segments").select("id,name"),
    ]);
    return { icps: icp.data ?? [], segNames: new Map((seg.data ?? []).map((s) => [s.id, s.name])) };
  },
});

export const dealsQuery = queryOptions({
  queryKey: ["deals"],
  queryFn: async () => (await fetchAll((a, b) => supabase.from("deals").select("*, accounts(name,domain)").order("created_at").order("id").range(a, b))).rows,
});

/**
 * Loader helper: fills the cache before the screen opens. A failure here never blocks navigation;
 * the screen's own query retries and shows its usual state.
 */
export async function prepare(qc: QueryClient, ...queries: Parameters<QueryClient["ensureQueryData"]>[0][]) {
  await Promise.all(queries.map((q) => qc.ensureQueryData(q).catch(() => undefined)));
}

/** Leads need the current company first. */
export async function prepareLeads(qc: QueryClient) {
  const me = await qc.ensureQueryData(meQuery).catch(() => null);
  const orgId = me?.currentOrg?.org_id;
  if (orgId) await prepare(qc, leadsQuery(orgId));
}
