import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { loadSetupData } from "@/lib/org-data";
import { setupStatus } from "@/lib/setup-schema";

export function useSetup() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  return useQuery({
    queryKey: ["setup", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const data = await loadSetupData(supabase, orgId!);
      return { data, status: setupStatus(data) };
    },
  });
}
