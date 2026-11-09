// NK-0098: what the query cache does on an auth event. `me` is cached for minutes, so another user must
// never be served the previous user's data (name, company, org_id) while their own loads.
import type { QueryClient } from "@tanstack/react-query";

type AuthSession = { user: { id: string } } | null;

/** Drop everything user- or company-scoped: in-flight requests first, then the cached answers. */
export function dropUserCache(qc: QueryClient) {
  void qc.cancelQueries();
  qc.removeQueries();
  // Mutations carry the previous user's variables and results too (NK-0115).
  qc.getMutationCache().clear();
}

/**
 * Returns true when the router must re-run its loaders.
 * `last` is the id of the last user the shared validator validated (lastValidatedUserId()), or null on a page
 * load before any validation: that is never another user (NK-0111).
 */
export function handleAuthEvent(
  qc: QueryClient,
  event: string,
  session: AuthSession,
  last: string | null = null,
): boolean {
  // A cached null (signed-out loader) never matches a signed-in user; no cached me at all (page load) is fine.
  const cached = qc.getQueryData<{ user: { id: string } } | null>(["me"]);
  const otherUser =
    !!session &&
    ((last != null && last !== session.user.id) ||
      (cached !== undefined && cached?.user.id !== session.user.id));
  if (event === "SIGNED_OUT" || otherUser) {
    dropUserCache(qc);
    return event === "SIGNED_OUT" || event === "SIGNED_IN";
  }
  if (event === "TOKEN_REFRESHED") void qc.invalidateQueries({ queryKey: ["me"] });
  if (event === "SIGNED_IN" || event === "USER_UPDATED") {
    void qc.invalidateQueries();
    return true;
  }
  return false;
}

/**
 * Sign out without a window where a mounted screen refetches with a half-cleared session (NK-0098):
 * stop in-flight requests, end the session first, only then drop the cache.
 */
export async function signOutAndClear(qc: QueryClient, auth: { signOut(): Promise<unknown> }) {
  await qc.cancelQueries();
  await auth.signOut();
  dropUserCache(qc);
}
