// NK-0169: the window opened by «Cerrar sesión» (NK-0150) and by an account change (NK-0111) has to hold for every
// screen, not only for the reads that call assertSessionOpen(). One choke point does it: the browser's fetch.
// The generated Supabase client (src/integrations/supabase/client.ts) looks the global fetch up on every request,
// and server functions are fetches to TSS_SERVER_FN_BASE, so wrapping window.fetch covers REST, storage,
// functions and server functions alike.
//
// What is refused, before it leaves:
// - while signing out: reads (GET/HEAD). The session is still the same person's until the logout ends, so a write
//   they started (a field saved on blur right before the click) still leaves: refusing it would lose their edit.
// - while the tab changes account: everything. The stored token may already be the other person's.
// Always let through: the logout and the token refresh, and requests to anywhere else.
import { isSessionEnding, isSessionQuiet, SessionEndedError } from "@/lib/session-ending";
import { isSwitchingAccount } from "@/lib/account-switch";

/** TanStack Start defines this for the browser build (createClientRpc builds server function URLs from it). */
const SERVER_FN_BASE = process.env.TSS_SERVER_FN_BASE || "/_serverFn/";
const AUTH_ALLOWED = ["/auth/v1/logout", "/auth/v1/token"];
const READS = ["GET", "HEAD"];

type Targets = { supabaseUrl: string; origin: string };

function urlOf(input: RequestInfo | URL, origin: string): URL | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(raw, origin);
  } catch {
    return null;
  }
}

function methodOf(input: RequestInfo | URL, init: RequestInit | undefined): string {
  const fromRequest =
    typeof Request !== "undefined" && input instanceof Request ? input.method : "GET";
  return (init?.method ?? fromRequest).toUpperCase();
}

/** True for a request that carries the signed-in person's session: Supabase or a server function. */
function carriesSession(url: URL, backend: URL, origin: string): boolean {
  if (url.origin === backend.origin) return !AUTH_ALLOWED.includes(url.pathname);
  return url.origin === origin && url.pathname.startsWith(SERVER_FN_BASE);
}

/** A fetch that refuses session-carrying requests while the session window is open, and sends everything else. */
export function guardFetch(base: typeof fetch, { supabaseUrl, origin }: Targets): typeof fetch {
  const backend = new URL(supabaseUrl);
  const own = new URL(origin).origin;
  return (input, init) => {
    if (isSessionQuiet()) {
      const url = urlOf(input, origin);
      const refused =
        url != null &&
        carriesSession(url, backend, own) &&
        (isSwitchingAccount() || (isSessionEnding() && READS.includes(methodOf(input, init))));
      if (refused) return Promise.reject(new SessionEndedError());
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
