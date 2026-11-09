import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { cleanUrlSearch, needsUrlClean } from "@/lib/screen-sections";

/**
 * NK-0100: validateSearch drops an unknown ?seccion= (and a blank ?q=) for the screen, but the address bar keeps it.
 * This rewrites the URL once with `replace` (no history entry) to the clean form. A valid URL causes no navigation.
 */
export function useCleanUrl(ids: readonly string[], withQuery: boolean) {
  const raw = useRouterState({
    select: (s) => (s.location.search ?? {}) as Record<string, unknown>,
  });
  const navigate = useNavigate();
  const dirty = needsUrlClean(raw, ids, withQuery);
  useEffect(() => {
    if (dirty)
      void navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => cleanUrlSearch(prev, ids, withQuery)) as never, // route-agnostic hook: the search type is the route's own
        replace: true,
      });
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
}
