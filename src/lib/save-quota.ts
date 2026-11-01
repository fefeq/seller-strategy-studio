import type { QueryClient } from "@tanstack/react-query";
import type { Db } from "@/lib/org-data";
import { invalidateSetup } from "@/hooks/setup-invalidation";

/** Saves a quota for a person and quarter. Refreshes only after the write succeeded; returns the error (or null) so the screen can say it. */
export async function saveQuota(
  supabase: Db,
  qc: QueryClient,
  input: { orgId: string; userId: string; period: string; amount: number },
) {
  const { error } = await supabase
    .from("quotas")
    .upsert(
      { org_id: input.orgId, user_id: input.userId, period: input.period, amount: input.amount },
      { onConflict: "org_id,user_id,period" },
    );
  if (error) return error;
  qc.invalidateQueries({ queryKey: ["metrics"] });
  await invalidateSetup(qc);
  return null;
}
