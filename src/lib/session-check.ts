// NK-0098: the guard of /_authenticated. getSession() reads the local session (no network) on every
// navigation; getUser() validates it against the server once per access token. A refreshed token, another
// user, USER_UPDATED or SIGNED_OUT (also from another tab) drops the saved answer; a refusal is never saved.
// Data security stays with RLS; this only decides whether to show the app or send to /auth.

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

const shared = new WeakMap<object, () => Promise<unknown>>();

/**
 * The validated user per access token, shared by the route guard and by meQuery (NK-0098), so both cost
 * one GET /auth/v1/user per token. One validator per auth client, so createSessionCheck(auth) in the
 * route and createSessionUser(auth) in meQuery share the same saved answer.
 * Returns null without a session or when the server refuses it.
 */
export function createSessionUser<U extends AuthUser>(
  auth: SessionAuth<U>,
): () => Promise<U | null> {
  const existing = shared.get(auth);
  if (existing) return existing as () => Promise<U | null>;
  let saved: { token: string; valid: Promise<U | null> } | null = null;
  let listening = false;

  const validatedUser = async function validatedUser() {
    // Subscribe on first use (client only), not at import time.
    if (!listening) {
      listening = true;
      auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || event === "USER_UPDATED") saved = null;
        else if (saved && session?.access_token !== saved.token) saved = null;
      });
    }
    const { data } = await auth.getSession();
    const session = data.session;
    if (!session) {
      saved = null;
      return null;
    }
    if (saved?.token !== session.access_token) {
      const valid = auth.getUser(session.access_token).then(
        async ({ data: u, error }) => {
          // A token the server refuses for good (e.g. 401 bad_jwt after a secret rotation) would otherwise
          // stay in storage and bounce /auth <-> /home forever: drop the local session (no server call).
          // Network errors and 5xx are not definitive: they never sign anyone out.
          if (error && isDefinitiveRejection(error))
            await auth.signOut?.({ scope: "local" }).catch(() => undefined);
          return !error && u.user?.id === session.user.id ? u.user : null;
        },
        () => null,
      );
      saved = { token: session.access_token, valid };
    }
    const entry = saved;
    const user = await entry.valid;
    // Never keep a refusal: the next navigation asks again.
    if (!user && saved === entry) saved = null;
    return user;
  };
  shared.set(auth, validatedUser);
  return validatedUser;
}

export function createSessionCheck(auth: SessionAuth): () => Promise<boolean> {
  const validatedUser = createSessionUser(auth);
  return async () => (await validatedUser()) !== null;
}
