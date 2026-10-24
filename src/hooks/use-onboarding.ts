import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { useMe } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";

/** The person's onboarding session in the current company, and a save that upserts it. */
export function useOnboarding(opts: { poll?: boolean } = {}) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const userId = me?.user.id;
  const q = useQuery({
    queryKey: ["onboarding", orgId, userId],
    enabled: !!orgId && !!userId,
    refetchInterval: opts.poll ? 2000 : false,
    queryFn: async () => (await supabase.from("onboarding_sessions").select("*").eq("org_id", orgId!).eq("user_id", userId!).maybeSingle()).data,
  });
  async function save(patch: Omit<TablesUpdate<"onboarding_sessions">, "org_id" | "user_id">) {
    const { error } = await supabase.from("onboarding_sessions").upsert({ org_id: orgId!, user_id: userId!, ...(q.data && { depth: q.data.depth }), ...patch, updated_at: new Date().toISOString() }, { onConflict: "org_id,user_id" });
    if (error) { toast.error(errorText(error)); return false; }
    await qc.invalidateQueries({ queryKey: ["onboarding", orgId, userId] });
    return true;
  }
  return { ...q, save, orgId, userId };
}

export const asJson = (v: unknown) => v as Json;
