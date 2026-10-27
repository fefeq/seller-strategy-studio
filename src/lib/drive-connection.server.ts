// A company's own Google Drive account: consent, callback, check before saving, refresh and disconnect.
// Server-only. The refresh token is sealed (secret-box) and never leaves the server; every write here uses
// the admin client after the caller was checked as Owner. Env, read inside each call: GOOGLE_OAUTH_CLIENT_ID,
// GOOGLE_OAUTH_CLIENT_SECRET, optional GOOGLE_OAUTH_REDIRECT_URI, and INTEGRATION_KEYS_SECRET (also signs the state).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildAuthUrl, checkGrant, connectMessage, failureStatus, revocationText, revokeSkipReason, type ConnectCode, type ConnectionRow, type RevokeOutcome } from "@/lib/drive-connection";
import { DriveError, GOOGLE_API, nokkoAuth, type DriveAuth } from "@/lib/google-drive";
import { consumeNonce, newNonce, safeReturnPath, sameNonce, signState, STATE_TTL_MS, verifyState } from "@/lib/oauth-state";
import { open, seal } from "@/lib/secret-box.server";

type Admin = SupabaseClient<Database>;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const PROVIDER = "drive";

function oauthConfig() {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
export const oauthConfigured = () => !!oauthConfig();
export const nokkoDriveAvailable = () => !!process.env["LOVABLE_API_KEY"] && !!process.env["GOOGLE_DRIVE_API_KEY"];

const redirectUri = (origin: string) => process.env["GOOGLE_OAUTH_REDIRECT_URI"] || `${origin}/api/public/drive/callback`;
const stateSecret = () => {
  const s = process.env["INTEGRATION_KEYS_SECRET"];
  if (!s) throw new Error("Falta la clave de cifrado del servidor. Avisa al equipo de Nokko.");
  return s;
};
const NOT_CONFIGURED = "Falta configurar el acceso a Google en el servidor. Avisa al equipo de Nokko.";

async function logEvent(db: Admin, orgId: string, actor: string | null, action: "connected" | "changed" | "disconnected" | "failed", detail: string) {
  await db.from("connection_events").insert({ org_id: orgId, provider: PROVIDER, action, actor, detail });
}

/** The URL where the Owner chooses the Google account and accepts the permission, and the nonce the caller must set as an httpOnly cookie in that same browser. */
export async function startConnect(orgId: string, userId: string, origin: string, returnTo: unknown) {
  const cfg = oauthConfig();
  if (!cfg) throw new Error(NOT_CONFIGURED);
  const nonce = newNonce();
  const state = await signState(stateSecret(), { p: PROVIDER, o: orgId, u: userId, r: safeReturnPath(returnTo), t: Date.now() + STATE_TTL_MS, n: nonce });
  return { url: buildAuthUrl({ clientId: cfg.clientId, redirectUri: redirectUri(origin), state }), nonce };
}

async function tokenCall(body: Record<string, string>): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  return { ok: res.ok, status: res.status, json: ((await res.json().catch(() => ({}))) as Record<string, unknown>) ?? {} };
}

/** «revoked» only when Google answered 2xx; anything else (an error answer, no answer) is «failed». */
async function revoke(token: string): Promise<"revoked" | "failed"> {
  try {
    const res = await fetch(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
    return res.ok ? "revoked" : "failed";
  } catch { return "failed"; }
}

/** Revokes a saved (sealed) token unless that could cut an account still in use; says what happened. */
async function revokeSaved(db: Admin, orgId: string, saved: { google_email: string; refresh_token_enc: string }, newEmail: string | null): Promise<RevokeOutcome> {
  const { count } = await db.from("drive_connections").select("org_id", { count: "exact", head: true }).eq("google_email", saved.google_email).neq("org_id", orgId);
  const skip = revokeSkipReason({ oldEmail: saved.google_email, newEmail, usedElsewhere: !!count });
  if (skip) return skip;
  let token: string;
  try { token = await open(saved.refresh_token_enc); } catch { return "unreadable"; }
  return revoke(token);
}

export type ConnectResult = { ok: boolean; code: ConnectCode; message: string; returnTo: string; revocation?: RevokeOutcome | null; elsewhere?: boolean };
const result = (code: ConnectCode, returnTo: string): ConnectResult => ({ ok: false, code, message: connectMessage({ code }), returnTo });

/** What Google sent back to the callback. Saves the account only when it was checked and works (CA-5, CA-6). */
export async function completeConnect(db: Admin, input: { code: string | null; state: string | null; error: string | null; errorDescription: string | null; nonce: string | null }, origin: string): Promise<ConnectResult> {
  const st = input.state ? await verifyState(stateSecret(), input.state) : null;
  if (!st || st.p !== PROVIDER) return result("expired", "/integrations");
  // The state must come back in the browser that started it (the cookie holds the nonce), and only once.
  if (!input.nonce || !sameNonce(input.nonce, st.n) || !consumeNonce(st.n, st.t)) return result("wrong_browser", safeReturnPath(st.r));
  const fail = (code: ConnectCode): ConnectResult => result(code, st.r);
  if (input.error) {
    if (input.error !== "access_denied" && input.error !== "admin_policy_enforced") console.warn(`Drive consent returned an error: ${input.error.slice(0, 60)}`);
    return fail(input.error === "access_denied" ? "cancelled" : input.error === "admin_policy_enforced" ? "admin_policy" : "google_failed");
  }
  if (!input.code) return fail("google_failed");
  const cfg = oauthConfig();
  if (!cfg) return fail("not_configured");

  // Whoever started it must still be the Owner of that company.
  const { data: member } = await db.from("org_members").select("role").eq("org_id", st.o).eq("user_id", st.u).maybeSingle();
  if (member?.role !== "owner") return fail("owner_only");

  const t = await tokenCall({ code: input.code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri(origin), grant_type: "authorization_code" });
  if (!t.ok) {
    console.warn(`Drive token exchange refused (${t.status})`);
    return fail("google_failed");
  }
  const accessToken = String(t.json["access_token"] ?? "");
  let about: { user?: { emailAddress?: string } } | null = null;
  try {
    const r = await fetch(`${GOOGLE_API}/drive/v3/about?fields=user(emailAddress)`, { headers: { Authorization: `Bearer ${accessToken}` } });
    about = r.ok ? ((await r.json()) as typeof about) : null;
  } catch { about = null; }
  const grant = checkGrant({ scope: String(t.json["scope"] ?? ""), refresh_token: typeof t.json["refresh_token"] === "string" ? t.json["refresh_token"] : undefined }, about);
  if (!grant.ok) {
    if (typeof t.json["refresh_token"] === "string") await revoke(t.json["refresh_token"]);
    return fail(grant.code);
  }

  const { data: previous } = await db.from("drive_connections").select("google_email,refresh_token_enc").eq("org_id", st.o).maybeSingle();
  const { count } = await db.from("drive_connections").select("org_id", { count: "exact", head: true }).eq("google_email", grant.email).neq("org_id", st.o);
  const now = new Date().toISOString();
  const { error } = await db.from("drive_connections").upsert(
    { org_id: st.o, google_email: grant.email, refresh_token_enc: await seal(String(t.json["refresh_token"])), status: "active", last_error: null, connected_by: st.u, connected_at: now, updated_at: now },
    { onConflict: "org_id" },
  );
  if (error) return fail("save_failed");
  forget(st.o);
  const revocation = previous ? await revokeSaved(db, st.o, previous, grant.email) : null;
  if (revocation === "failed" || revocation === "unreadable") console.warn(`Drive revoke of the replaced account not done (${revocation}) for org ${st.o}`);
  await logEvent(db, st.o, st.u, previous && previous.google_email !== grant.email ? "changed" : "connected", grant.email);
  const done = { code: "ok" as const, revocation, elsewhere: !!count };
  return { ok: true, ...done, message: connectMessage(done), returnTo: st.r };
}

/** Stops using the account at once, tries to revoke it at Google (unless another company uses the same account) and drops the token. Imported knowledge stays. */
export async function disconnectDrive(db: Admin, orgId: string, userId: string): Promise<{ email: string | null; revocation: RevokeOutcome | null; message: string }> {
  const { data: row } = await db.from("drive_connections").select("google_email,refresh_token_enc").eq("org_id", orgId).maybeSingle();
  if (!row) return { email: null, revocation: null, message: "No había ninguna cuenta conectada." };
  const revocation = await revokeSaved(db, orgId, row, null);
  if (revocation === "failed" || revocation === "unreadable") console.warn(`Drive revoke not done (${revocation}) for org ${orgId}`);
  const { error } = await db.from("drive_connections").delete().eq("org_id", orgId);
  if (error) throw new Error("No se pudo desconectar Drive. Inténtalo de nuevo.");
  forget(orgId);
  await logEvent(db, orgId, userId, "disconnected", `${row.google_email} · ${revocationText(revocation, row.google_email)}`);
  return { email: row.google_email, revocation, message: `NOKKO ya no usa ${row.google_email}. ${revocationText(revocation, row.google_email)}` };
}

// Access tokens live about an hour; kept per company in memory so each Drive call does not refresh again. Each
// instance has its own map and cannot be told to forget, so an entry is only used while the saved (sealed) token
// is the one it was made from: a changed or reconnected account is a cache miss on every instance. And it is
// kept at most five minutes, which also bounds what a call already in flight can still do after a disconnect.
const ACCESS_CACHE_MAX_MS = 5 * 60 * 1000;
const access = new Map<string, { sealed: string; token: string; until: number }>();
const forget = (orgId: string) => { access.delete(orgId); };

async function setStatus(db: Admin, orgId: string, current: ConnectionRow["status"], status: ConnectionRow["status"], text: string | null) {
  if (current === status) return;
  await db.from("drive_connections").update({ status, last_error: text, updated_at: new Date().toISOString() }).eq("org_id", orgId);
  if (status !== "active") await logEvent(db, orgId, null, "failed", text ?? status);
}

/** The company's own account as a DriveAuth, or null when it has not connected one. A saved account is never silently swapped for NOKKO's. */
export async function ownDriveAuth(db: Admin, orgId: string): Promise<DriveAuth | null> {
  const { data: row } = await db.from("drive_connections").select("refresh_token_enc,status").eq("org_id", orgId).maybeSingle();
  if (!row) return null;
  let status = row.status as ConnectionRow["status"];
  const note = async (httpStatus: number | null) => {
    const f = failureStatus(httpStatus);
    if (f) { forget(orgId); await setStatus(db, orgId, status, f.status, f.text); status = f.status; }
  };
  return {
    base: GOOGLE_API,
    onFailure: note,
    headers: async () => {
      const hit = access.get(orgId);
      if (hit && hit.sealed === row.refresh_token_enc && hit.until > Date.now()) return { Authorization: `Bearer ${hit.token}` };
      const cfg = oauthConfig();
      if (!cfg) throw new DriveError(NOT_CONFIGURED, 500);
      let refresh: string;
      try { refresh = await open(row.refresh_token_enc); } catch { await note(400); throw new DriveError(failureStatus(400)!.text, 401); }
      let t: Awaited<ReturnType<typeof tokenCall>>;
      try { t = await tokenCall({ refresh_token: refresh, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token" }); }
      catch { await note(null); throw new DriveError(failureStatus(null)!.text, 503); }
      if (!t.ok) { await note(t.status); const f = failureStatus(t.status); throw new DriveError(f?.text ?? "Google no renovó el acceso. Vuelve a intentarlo.", t.status === 400 ? 401 : t.status); }
      const token = String(t.json["access_token"] ?? "");
      access.set(orgId, { sealed: row.refresh_token_enc, token, until: Date.now() + Math.min(ACCESS_CACHE_MAX_MS, Math.max(60, Number(t.json["expires_in"] ?? 3600) - 60) * 1000) });
      if (status !== "active") { await setStatus(db, orgId, status, "active", null); status = "active"; }
      return { Authorization: `Bearer ${token}` };
    },
  };
}

/** The account Drive calls of a company run with: its own when connected, NOKKO's otherwise. */
export async function driveAuthFor(db: Admin, orgId: string): Promise<DriveAuth> {
  return (await ownDriveAuth(db, orgId)) ?? nokkoAuth;
}
