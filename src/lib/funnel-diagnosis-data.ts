// Loads what funnelDiagnosis needs and runs it. Shared by the Estrategia view (browser client, RLS) and the get_funnel_diagnosis
// tool (agent and MCP; the privileged client in Telegram has no RLS): every query filters org_id explicitly. It only reads the
// database; it calls no provider. Lists that can grow go through fetchAll. deals.gross_margin feeds the one margin chain
// (SDD-20261109 D15). Not yet the year's segment_budget_quarters (CA-10): the CA-8 test of the tool pins the set of
// tables it reads, and changing that assertion needs a decision (see .factory/evidence/NK-0094/result.md).
import type { Db } from "@/lib/org-data";
import { fetchAll } from "@/lib/fetch-all";
import { quarterRange } from "@/lib/metrics";
import { funnelDiagnosis, type FunnelDiagnosis, type SegmentInput } from "@/lib/funnel-diagnosis";
import type { DealLike } from "@/lib/segment-coverage";

const must = <T>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

export async function loadFunnelDiagnosis(
  db: Db,
  orgId: string,
  quarter: string,
): Promise<FunnelDiagnosis | null> {
  if (!/^\d{4}-Q[1-4]$/.test(quarter)) return null;
  const { start, end } = quarterRange(quarter);
  const from = start.toISOString(),
    to = end.toISOString();
  const [segments, deals, leads, trials, costs, posthog, stripe] = await Promise.all([
    // select("*") on purpose: a company whose database does not have acquisition_motion yet still gets its diagnosis, with the motion «sin definir».
    db.from("segments").select("*").eq("org_id", orgId),
    fetchAll((a, b) =>
      db
        .from("deals")
        .select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at,gross_margin")
        .eq("org_id", orgId)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("leads")
        .select("segment_id,created_at")
        .eq("org_id", orgId)
        .gte("created_at", from)
        .lt("created_at", to)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("trials")
        .select("segment_id,signed_up_at,activated_at,converted_at,mrr")
        .eq("org_id", orgId)
        .gte("signed_up_at", from)
        .lt("signed_up_at", to)
        .order("id")
        .range(a, b),
    ),
    db
      .from("cac_costs")
      .select("segment_id,channel,amount")
      .eq("org_id", orgId)
      .eq("period", quarter),
    db.from("posthog_connections").select("activation_event").eq("org_id", orgId).maybeSingle(),
    db
      .from("stripe_snapshots")
      .select("logo_churn_pct,churned_customers,window_days,taken_at")
      .eq("org_id", orgId)
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return funnelDiagnosis({
    quarter,
    segments: (must(segments) ?? []) as unknown as SegmentInput[],
    deals: deals.rows as DealLike[],
    leads: leads.rows,
    trials: trials.rows,
    costs: must(costs) ?? [],
    activationEvent: must(posthog)?.activation_event ?? null,
    stripe: must(stripe),
  });
}
