// The `state` of an OAuth round trip: who started it (company, person, provider), where to come back to and
// when it stops being valid, signed so the callback can trust it without a session. Shared by every provider
// in Conexiones. Web Crypto only (tested in oauth-state.test.ts).
// `n` is a random nonce also set as an httpOnly cookie in the browser that started the flow: the callback only
// accepts a state whose nonce matches that cookie, so a signed state alone (a link someone else sends, one
// that leaked) is useless in another browser. The session lives in localStorage, so the callback has no
// session to read: the cookie is what ties the callback to the browser of whoever started it.
export type OAuthState = { p: string; o: string; u: string; r: string; t: number; n: string };

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
    if (typeof s.p !== "string" || typeof s.o !== "string" || typeof s.u !== "string" || typeof s.r !== "string" || typeof s.t !== "number" || typeof s.n !== "string" || s.n.length < 16) return null;
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

/** 256 bits of randomness, URL-safe. */
export const newNonce = () => b64u(crypto.getRandomValues(new Uint8Array(32)));

export const nonceCookieName = (provider: string) => `nokko_oauth_${provider}`;
/** Only the callback of that provider receives it; Lax so it travels on Google's top-level redirect back. */
export const nonceCookieOptions = (provider: string, secure: boolean) =>
  ({ httpOnly: true, sameSite: "lax" as const, secure, path: `/api/public/${provider}`, maxAge: STATE_TTL_MS / 1000 });

/** One cookie of a `Cookie` request header, or null. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null;
  }
  return null;
}

/** Same length and content, without stopping at the first different character. */
export function sameNonce(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Nonces already spent, kept until their state would have expired anyway. Per instance: the cookie is deleted on
// use, so a replay needs a browser that still holds the cookie; this closes the repeat on the same instance.
const spent = new Map<string, number>();
/** True the first time a nonce is consumed, false on any repeat. */
export function consumeNonce(nonce: string, expiresAt: number, now = Date.now()): boolean {
  for (const [k, until] of spent) if (until < now) spent.delete(k);
  if (spent.has(nonce)) return false;
  spent.set(nonce, expiresAt);
  return true;
}
