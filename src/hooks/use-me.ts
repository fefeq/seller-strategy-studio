import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currencySymbol, formatMoney } from "@/lib/money";

export type Membership = { org_id: string; role: string; name: string; currency: string; website: string | null; archived: boolean };

/** The signed-in user, their companies and the current one. Shared by useMe and the route loaders. */
export const meQuery = queryOptions({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      // Joins any company that invited this email before loading memberships.
      await supabase.rpc("accept_invites");
      const [{ data: profile }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("org_members").select("org_id, role, organizations(name, currency, website, archived_at)").eq("user_id", user.id),
      ]);
      const all: Membership[] = (members ?? []).map((m: any) => ({ org_id: m.org_id, role: m.role, name: m.organizations?.name ?? "", currency: m.organizations?.currency ?? "EUR", website: m.organizations?.website ?? null, archived: !!m.organizations?.archived_at }));
      const archived = all.filter((m) => m.archived);
      const memberships = all.filter((m) => !m.archived);
      const currentOrgId = profile?.current_org_id ?? null;
      const current = memberships.find((m) => m.org_id === currentOrgId) ?? null;
      return {
        user,
        profile,
        memberships,
        archived,
        currentOrg: current,
        roles: current ? [current.role] : [],
      };
    },
});

export function useMe() {
  return useQuery(meQuery);
}

/** Currency of the current company plus formatters bound to it. */
export function useCurrency() {
  const { data: me } = useMe();
  const currency = me?.currentOrg?.currency ?? "EUR";
  return {
    currency,
    symbol: currencySymbol(currency),
    money: (n: number, compact = false) => formatMoney(n, currency, compact),
  };
}
