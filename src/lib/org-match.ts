// «Nueva empresa»: is there already one of yours with this name or web? Pure, tested; reuses match.ts.
import { duplicateOf } from "@/lib/match";

export type OrgLike = { org_id: string; name: string; website?: string | null; archived?: boolean };

/** The most similar company you already belong to (archived ones too), or null. */
export function similarOrg<T extends OrgLike>(
  query: { name: string; website?: string | null },
  orgs: T[],
): { org: T; same: boolean } | null {
  if (!query.name.trim() && !query.website?.trim()) return null;
  const m = duplicateOf(
    { name: query.name, domain: query.website ?? null },
    orgs.map((o) => ({ id: o.org_id, name: o.name, domain: o.website ?? null, org: o })),
  );
  return m ? { org: m.item.org, same: m.kind === "same" } : null;
}
