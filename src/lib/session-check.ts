// NK-0098: the guard of /_authenticated. getSession() reads the local session (no network) on every
// navigation; getUser() validates it against the server once per access token. A refreshed token, another
// user, USER_UPDATED or SIGNED_OUT (also from another tab) drops the saved answer; a refusal is never saved.
// NK-0112: the check has three answers: valid (the user), none (no session, or the server refused it) and
// unverified (network, 5xx, 429: could not ask). Only "none" sends to /auth; "unverified" keeps the session
// and shows a retry screen. Data security stays with RLS; this only decides what to show.

type Session = { access_token: string; user: { id: string } };
type AuthUser = { id: string };

/** The slice of supabase.auth the check needs (a fake in tests). */
export type SessionAuth<U extends AuthUser = AuthUser> = {
  getSession(): Promise<{ data: { session: Session | null } }>;
  getUser(jwt?: string): Promise<{ data: { user: U | null }; error: unknown }>;
  /** Optional so small fakes still fit; the real client has it. */
  signOut?(options: { scope: "local" }): Promise<unknown>;
  onAuthStateChange(cb: (event: string, session: Session | null) => void): unknown;
};

/** The server said no to this token (401/403), as opposed to a network blip or a 5xx. */
export function isDefinitiveRejection(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 401 || status === 403;
}

/** Shown when an action needs the signed-in user and the shared validator has none (NK-0110). */
export const SESSION_CHECK_FAILED = "No he podido comprobar tu sesión. Vuelve a intentarlo.";

/** Thrown by the /_authenticated guard when the session could not be checked (network, 5xx, 429); shown as a retry screen, never as a redirect. */
export class SessionUnverifiedError extends Error {
  constructor() {
    super("session_unverified");
    this.name = "SessionUnverifiedError";
  }
}

/** The three answers of the session check (NK-0112). */
export type SessionState<U extends AuthUser = AuthUser> =
  { status: "valid"; user: U } | { status: "none" } | { status: "unverified" };

type Outcome<U> = { user: U } | { reason: "none" | "unverified" };

type Shared<U extends AuthUser> = {
  user: () => Promise<U | null>;
  check: () => Promise<SessionState<U>>;
  /** Id of the last user the validator validated (NK-0111): survives refreshed tokens and failed checks. */
  readonly last: string | null;
  /** NK-0119: told when the validator validates a user other than the last validated one. */
  subscribeOtherUser: (cb: (userId: string) => void) => () => void;
};

const shared = new WeakMap<object, Shared<AuthUser>>();

function share<U extends AuthUser>(auth: SessionAuth<U>): Shared<U> {
  const existing = shared.get(auth);
  if (existing) return existing as unknown as Shared<U>;
  let saved: { token: string; valid: Promise<Outcome<U>> } | null = null;
  let listening = false;

  let last: string | null = null;
  const otherUserListeners = new Set<(userId: string) => void>();
  // Bumped on SIGNED_OUT: a validation that started before it must not bring the signed-out user back.
  let epoch = 0;
  // NK-0135: the access token of the session this tab holds now (events and reads of getSession keep it).
  let current: string | null = null;

  const run = async function run(): Promise<Outcome<U>> {
    // Subscribe on first use (client only), not at import time.
    if (!listening) {
      listening = true;
      auth.onAuthStateChange((event, session) => {
        current = session?.access_token ?? null;
        if (event === "SIGNED_OUT") {
          // Signing out ends the user of this tab: the next sign-in (maybe someone else) is a plain login, not
          // «another user in another tab» (NK-0111). Another tab's sign-in never passes through here.
          last = null;
          epoch++;
        }
        if (event === "SIGNED_OUT" || event === "USER_UPDATED") saved = null;
        else if (saved && session?.access_token !== saved.token) saved = null;
      });
    }
    const startedAt = epoch;
    const { data } = await auth.getSession();
    const session = data.session;
    current = session?.access_token ?? null;
    if (!session) {
      saved = null;
      return { reason: "none" };
    }
    if (saved?.token !== session.access_token) {
      const valid = auth.getUser(session.access_token).then(
        async ({ data: u, error }): Promise<Outcome<U>> => {
          if (error) {
            // A token the server refuses for good (e.g. 401 bad_jwt after a secret rotation) would otherwise
            // stay in storage and bounce /auth <-> /home forever: drop the local session (no server call).
            // Network errors, 5xx and 429 are not definitive: they never sign anyone out (unverified).
            if (!isDefinitiveRejection(error)) return { reason: "unverified" };
            // Only if the stored session is still the one that was refused (another tab may have signed in).
            const now = (await auth.getSession()).data.session;
            if (now?.access_token === session.access_token)
              await auth.signOut?.({ scope: "local" }).catch(() => undefined);
            return { reason: "none" };
          }
          return u.user && u.user.id === session.user.id ? { user: u.user } : { reason: "none" };
        },
        (): Outcome<U> => ({ reason: "unverified" }),
      );
      saved = { token: session.access_token, valid };
    }
    const entry = saved;
    const outcome = await entry.valid;
    // NK-0135: a result for a token that is no longer the saved session is discarded: it is not «another user»
    // and it does not replace the last validated one (the current token's own validation decides that).
    if ("user" in outcome && epoch === startedAt && current === session.access_token) {
      const previous = last;
      last = outcome.user.id;
      // NK-0119: a navigation validated another user before that user's SIGNED_IN reached this tab. Tell the
      // cache now, before the caller (a loader) can read anything left by the previous user.
      if (previous != null && previous !== last) otherUserListeners.forEach((cb) => cb(last!));
    }
    // Never keep a refusal or a failed attempt: the next navigation asks again.
    if (!("user" in outcome) && saved === entry) saved = null;
    return outcome;
  };

  const state: Shared<U> = {
    user: async () => {
      const o = await run();
      return "user" in o ? o.user : null;
    },
    check: async () => {
      const o = await run();
      return "user" in o ? { status: "valid", user: o.user } : { status: o.reason };
    },
    get last() {
      return last;
    },
    subscribeOtherUser: (cb) => {
      otherUserListeners.add(cb);
      return () => void otherUserListeners.delete(cb);
    },
  };
  shared.set(auth, state as unknown as Shared<AuthUser>);
  return state;
}

/**
 * The validated user per access token, shared by the route guard and by meQuery (NK-0098), so both cost
 * one GET /auth/v1/user per token. One validator per auth client, so createSessionCheck(auth) in the
 * route and createSessionUser(auth) in meQuery share the same saved answer.
 * Returns null without a session, when the server refuses it or when it could not be asked.
 */
export function createSessionUser<U extends AuthUser>(
  auth: SessionAuth<U>,
): () => Promise<U | null> {
  return share(auth).user;
}

/** Id of the last user validated by the shared validator, or null before any (NK-0111). Never clears on its own. */
export function createLastValidatedUserId<U extends AuthUser>(
  auth: SessionAuth<U>,
): () => string | null {
  const box = share(auth);
  return () => box.last;
}

/** Calls back (with the new id) when the shared validator validates a user other than the last validated one (NK-0119). Returns the unsubscribe. */
export function createOtherUserSubscription<U extends AuthUser>(
  auth: SessionAuth<U>,
): (cb: (userId: string) => void) => () => void {
  return share(auth).subscribeOtherUser;
}

/** Same validation with the three answers (NK-0112): valid, none (go to /auth) or unverified (retry screen). */
export function createSessionState<U extends AuthUser>(
  auth: SessionAuth<U>,
): () => Promise<SessionState<U>> {
  return share(auth).check;
}

export function createSessionCheck(auth: SessionAuth): () => Promise<boolean> {
  const validatedUser = createSessionUser(auth);
  return async () => (await validatedUser()) !== null;
}
