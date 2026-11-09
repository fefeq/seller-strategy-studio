// NK-0098: what the query cache does on an auth event. `me` is cached for minutes, so another user must
// never be served the previous user's data (name, company, org_id) while their own loads.
import type { QueryClient } from "@tanstack/react-query";

type AuthSession = { user: { id: string } } | null;

/** Drop everything user- or company-scoped: in-flight requests first, then the cached answers. */
export function dropUserCache(qc: QueryClient) {
  void qc.cancelQueries();
  qc.removeQueries();
}

/** Returns true when the router must re-run its loaders. */
export function handleAuthEvent(qc: QueryClient, event: string, session: AuthSession): boolean {
  // A cached null (signed-out loader) never matches a signed-in user; no cached me at all (page load) is fine.
  const cached = qc.getQueryData<{ user: { id: string } } | null>(["me"]);
  const otherUser = !!session && cached !== undefined && cached?.user.id !== session.user.id;
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
