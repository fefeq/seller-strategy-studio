// The `state` of an OAuth round trip: who started it (company, person, provider), where to come back to and
// when it stops being valid, signed so the callback can trust it without a session. Shared by every provider
// in Conexiones. Web Crypto only (tested in oauth-state.test.ts).
export type OAuthState = { p: string; o: string; u: string; r: string; t: number };

/** Ten minutes is enough to choose an account and accept the consent. */
export const STATE_TTL_MS = 10 * 60 * 1000;

const enc = new TextEncoder();
const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function key(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`oauth-state:${secret}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signState(secret: string, state: OAuthState): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(state)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${b64u(sig)}`;
}

/** The state when the signature matches and it has not expired; null otherwise (never throws). */
export async function verifyState(secret: string, token: string, now = Date.now()): Promise<OAuthState | null> {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    if (!(await crypto.subtle.verify("HMAC", await key(secret), unb64u(sig), enc.encode(body)))) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64u(body))) as Partial<OAuthState>;
    if (typeof s.p !== "string" || typeof s.o !== "string" || typeof s.u !== "string" || typeof s.r !== "string" || typeof s.t !== "number") return null;
    return now > s.t ? null : (s as OAuthState);
  } catch {
    return null;
  }
}

/** Only an in-app path may be returned to (never another site). */
export function safeReturnPath(raw: unknown, fallback = "/integrations"): string {
  if (typeof raw !== "string") return fallback;
  return /^\/(?!\/)[A-Za-z0-9\-_/]*(\?[A-Za-z0-9=&_%\-.]*)?$/.test(raw) ? raw : fallback;
}
