// NK-0098: what the query cache does on an auth event. `me` is cached for minutes, so another user must
// never be served the previous user's data (name, company, org_id) while their own loads.
import type { QueryClient } from "@tanstack/react-query";
import { beginAccountSwitch } from "@/lib/account-switch";
import { beginSessionEnd, endSessionEnd } from "@/lib/session-ending";

type AuthSession = { user: { id: string } } | null;

/**
 * Drop everything user- or company-scoped: in-flight requests and cached answers. A query with a mounted
 * observer is reset (back to «no data», in-flight request cancelled without reverting) instead of removed:
 * a removed query is left behind in the observer, which would keep rendering the previous user's result
 * until the next remount (NK-0111, other tab). The rest is removed.
 */
export function dropUserCache(qc: QueryClient) {
  const cache = qc.getQueryCache();
  for (const q of cache.getAll()) if (q.getObserversCount() > 0) q.reset();
  qc.removeQueries({ predicate: (q) => q.getObserversCount() === 0 });
  // Mutations carry the previous user's variables and results too (NK-0115).
  qc.getMutationCache().clear();
}

/** Everything user-scoped goes, observed or not: in-flight requests, answers and mutations. */
function purgeAll(qc: QueryClient) {
  void qc.cancelQueries();
  qc.removeQueries();
  qc.getMutationCache().clear();
}

/**
 * NK-0119: the shared validator validated a user other than the last one before that user's SIGNED_IN arrived
 * (a navigation won the race). Same rule as D-S3-3 when something is mounted (block, then reload); when nothing
 * is mounted there is nothing on screen to protect, so the cache is simply emptied.
 */
export function handleOtherUserValidated(qc: QueryClient) {
  const mounted = qc
    .getQueryCache()
    .getAll()
    .some((q) => q.getObserversCount() > 0);
  if (mounted) beginAccountSwitch();
  purgeAll(qc);
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
  if (otherUser) {
    // D-S3-3: the app blocks first (synchronously, before anything re-renders or refetches with the previous
    // user's ids), then every query goes, observed or not, and the page reloads as the new user. No reset and
    // no refetch: they would re-run the old keys (X's org and user ids) before Y's `me` exists.
    beginAccountSwitch();
    purgeAll(qc);
    return false;
  }
  if (event === "SIGNED_OUT") {
    dropUserCache(qc);
    return true;
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
 * NK-0150: the app is marked as signing out first (synchronously), so queries that watch it stay off while the
 * session is still valid; if the sign-out fails the person is still signed in and they come back on.
 */
export async function signOutAndClear(qc: QueryClient, auth: { signOut(): Promise<unknown> }) {
  beginSessionEnd();
  try {
    await qc.cancelQueries();
    await auth.signOut();
    dropUserCache(qc);
  } finally {
    endSessionEnd();
  }
}
