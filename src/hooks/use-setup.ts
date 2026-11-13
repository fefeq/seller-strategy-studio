import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { loadSetupData } from "@/lib/org-data";
import { setupStatus } from "@/lib/setup-schema";
import { assertSessionOpen, retryWhileOpen, useSessionQuiet } from "@/lib/session-ending";

export function useSetup() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const quiet = useSessionQuiet(); // NK-0169
  return useQuery({
    queryKey: ["setup", orgId],
    enabled: !!orgId && !quiet,
    retry: retryWhileOpen(3),
    queryFn: async () => {
      assertSessionOpen();
      const data = await loadSetupData(supabase, orgId!);
      return { data, status: setupStatus(data) };
    },
  });
}
