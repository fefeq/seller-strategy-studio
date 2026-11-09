// NK-0098: the guard of /_authenticated. getSession() reads the local session (no network) on every
// navigation; getUser() validates it against the server once per access token. A refreshed token, another
// user, USER_UPDATED or SIGNED_OUT (also from another tab) drops the saved answer; a refusal is never saved.
// Data security stays with RLS; this only decides whether to show the app or send to /auth.

type Session = { access_token: string; user: { id: string } };

/** The slice of supabase.auth the check needs (a fake in tests). */
export type SessionAuth = {
  getSession(): Promise<{ data: { session: Session | null } }>;
  getUser(jwt?: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  onAuthStateChange(cb: (event: string, session: Session | null) => void): unknown;
};

export function createSessionCheck(auth: SessionAuth): () => Promise<boolean> {
  let saved: { token: string; valid: Promise<boolean> } | null = null;
  let listening = false;

  return async function isSignedIn() {
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
      return false;
    }
    if (saved?.token !== session.access_token) {
      const valid = auth.getUser(session.access_token).then(
        ({ data: u, error }) => !error && u.user?.id === session.user.id,
        () => false,
      );
      saved = { token: session.access_token, valid };
    }
    const entry = saved;
    const ok = await entry.valid;
    // Never keep a refusal: the next navigation asks again.
    if (!ok && saved === entry) saved = null;
    return ok;
  };
}
