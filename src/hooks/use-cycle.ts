import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { loadCycleState } from "@/lib/bmad/cycle-state";
import { currentPhase, nextSteps } from "@/lib/bmad/phases";

export function useCycle() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  return useQuery({
    queryKey: ["cycle", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const s = await loadCycleState(supabase, orgId!);
      return { ...s, phase: currentPhase(s.state), steps: nextSteps(s.state, me?.roles ?? []) };
    },
  });
}
