import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Membership = { org_id: string; role: string; name: string };

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      // Joins any company that invited this email before loading memberships.
      await supabase.rpc("accept_invites");
      const [{ data: profile }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("org_members").select("org_id, role, organizations(name)").eq("user_id", user.id),
      ]);
      const memberships: Membership[] = (members ?? []).map((m: any) => ({ org_id: m.org_id, role: m.role, name: m.organizations?.name ?? "" }));
      const currentOrgId = profile?.current_org_id ?? null;
      const current = memberships.find((m) => m.org_id === currentOrgId) ?? null;
      return {
        user,
        profile,
        memberships,
        currentOrg: current,
        roles: current ? [current.role] : [],
      };
    },
  });
}
