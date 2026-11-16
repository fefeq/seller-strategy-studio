// NK-0169: the window opened by «Cerrar sesión» (NK-0150) and by an account change (NK-0111) has to hold for every
// screen, not only for the reads that call assertSessionOpen(). One choke point does it: the browser's fetch.
// The generated Supabase client (src/integrations/supabase/client.ts) looks the global fetch up on every request,
// and server functions are fetches to /_serverFn, so wrapping window.fetch covers REST, storage, functions and
// server functions alike. While the window is open such a request is refused before it leaves, whatever its
// method: after the click nothing goes out with the previous session. The logout and the token refresh
// (/auth/v1/*) must still leave, and requests to anywhere else are none of this guard's business.
import { isSessionQuiet, SessionEndedError } from "@/lib/session-ending";

/** TanStack Start's default base for server functions (vite.config.ts does not change it). */
const SERVER_FN_BASE = "/_serverFn/";
const AUTH_PATH = "/auth/v1/";

type Targets = { supabaseUrl: string; origin: string };

function urlOf(input: RequestInfo | URL, origin: string): URL | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(raw, origin);
  } catch {
    return null;
  }
}

/** True for a request that carries the signed-in person's session: Supabase data or a server function. */
function carriesSession(url: URL, backend: URL, origin: string): boolean {
  if (url.origin === backend.origin) return !url.pathname.startsWith(AUTH_PATH);
  return url.origin === origin && url.pathname.startsWith(SERVER_FN_BASE);
}

/** A fetch that refuses session-carrying requests while the session window is open, and sends everything else. */
export function guardFetch(base: typeof fetch, { supabaseUrl, origin }: Targets): typeof fetch {
  const backend = new URL(supabaseUrl);
  return (input, init) => {
    if (isSessionQuiet()) {
      const url = urlOf(input, origin);
      if (url && carriesSession(url, backend, new URL(origin).origin))
        return Promise.reject(new SessionEndedError());
    }
    return base(input, init);
  };
}

const INSTALLED = Symbol.for("nokko.sessionFetchGuard");

/** Wraps window.fetch once, in the browser only. Returns whether it installed the guard now. */
export function installSessionFetchGuard({ supabaseUrl }: { supabaseUrl: string | undefined }) {
  if (typeof window === "undefined" || !supabaseUrl) return false;
  const current = window.fetch as typeof fetch & { [INSTALLED]?: true };
  if (current[INSTALLED]) return false;
  const guarded = guardFetch(current.bind(window), {
    supabaseUrl,
    origin: window.location.origin,
  }) as typeof fetch & { [INSTALLED]?: true };
  guarded[INSTALLED] = true;
  window.fetch = guarded;
  return true;
}
