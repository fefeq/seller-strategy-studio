import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

export type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  max_accounts: number | null;
  name: string;
};

/** Members of the current company with their name (profiles) and optional maximum of accounts. */
export function useTeam() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  return useQuery({
    queryKey: ["team-members", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data: m } = await supabase
        .from("org_members")
        .select("id,user_id,role,max_accounts")
        .eq("org_id", orgId!);
      const ids = (m ?? []).map((x) => x.user_id);
      const { data: p } = ids.length
        ? await supabase.from("profiles").select("id,full_name,email").in("id", ids)
        : { data: [] };
      return (m ?? []).map((x) => {
        const prof = (p ?? []).find((y) => y.id === x.user_id);
        return {
          id: x.id,
          user_id: x.user_id,
          role: x.role,
          max_accounts: x.max_accounts ?? null,
          name: prof?.full_name || prof?.email || "Sin nombre",
        };
      });
    },
  });
}
