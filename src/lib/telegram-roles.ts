// Who may see price suggestions in the proactive Telegram jobs (NK-0042). The jobs run with the privileged client, which skips RLS,
// so the rule is applied in the query itself, before `limit`, so the filtered rows never take a place of the top 3.
import type { Db } from "@/lib/org-data";
import { PRICE_DEDUPE_PREFIX } from "@/lib/strategy-suggestions";

type Notable<Q> = { not: (column: string, operator: string, value: string) => Q };

/** Adds the price filter to a suggestions query when the person has no price role. Call it before `.limit(…)`. */
export const applyPriceVisibility = <Q extends Notable<Q>>(query: Q, canSee: boolean): Q =>
  canSee ? query : query.not("dedupe_key", "like", `${PRICE_DEDUPE_PREFIX}%`);

const key = (orgId: string, userId: string) => `${orgId}:${userId}`;

/**
 * Roles of every linked person in one query, grouped by (organisation, person): a person's current organisation is read per person
 * later, so the roles are crossed in memory. PostgREST may cut the answer at its row limit (1000 by default, not checked here): a
 * person left without a row has no role, which only hides price suggestions. An error reading roles means no role for anybody.
 */
export async function loadMemberRoles(db: Db, userIds: string[]): Promise<Map<string, string[]>> {
  const roles = new Map<string, string[]>();
  const ids = [...new Set(userIds)];
  if (!ids.length) return roles;
  const { data, error } = await db
    .from("org_members")
    .select("org_id,user_id,role")
    .in("user_id", ids);
  if (error || !data) return roles;
  for (const m of data)
    roles.set(key(m.org_id, m.user_id), [...(roles.get(key(m.org_id, m.user_id)) ?? []), m.role]);
  return roles;
}

export const rolesOf = (roles: Map<string, string[]>, orgId: string, userId: string): string[] =>
  roles.get(key(orgId, userId)) ?? [];
