// Browser read of the LinkedIn legal pause (SDD pieza A): the flag table is readable by any signed-in member.
// Fail-closed like the server: while the flag cannot be read, the extraction is treated as paused.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LINKEDIN_FLAG_KEY } from "@/lib/linkedin-legal";

export function useLinkedinLegalPause() {
  const q = useQuery({
    queryKey: ["linkedin-legal-flag"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_legal_flags")
        .select("paused,reason")
        .eq("key", LINKEDIN_FLAG_KEY)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
  // Loading or failed read: paused (fail-closed), same rule as the server.
  const paused = q.data?.paused !== false;
  return { paused, reason: q.data?.reason ?? null, loaded: !!q.data, refetch: q.refetch };
}
