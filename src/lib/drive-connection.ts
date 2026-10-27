// A company's own Google Drive account: states, who manages it, the OAuth request and the check of what
// Google granted. No network here (tested in drive-connection.test.ts); the OAuth exchange, the sealed
// token and the writes live in drive-connection.server.ts.

/** The only scope asked: files NOKKO creates and the ones the person picks. Never drive.readonly. */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export type ConnectionStatus = "active" | "error" | "no_response";
export type ConnectionRow = { status: ConnectionStatus; google_email: string; connected_by: string | null; connected_at: string; last_error: string | null };
export type ConnectionState = "own" | "nokko" | "none" | "error" | "no_response";

export const STATE_LABEL: Record<ConnectionState, string> = {
  own: "Cuenta propia",
  nokko: "Proporcionada por NOKKO",
  none: "Sin conectar",
  error: "Error",
  no_response: "Sin respuesta",
};

/** One state per provider: the company's account wins, then NOKKO's own when it is configured. */
export function driveConnectionState(row: ConnectionRow | null, nokkoAvailable: boolean): ConnectionState {
  if (row) return row.status === "active" ? "own" : row.status;
  return nokkoAvailable ? "nokko" : "none";
}

/** Only the Owner connects, changes or disconnects; every member sees the state. */
export const canManageConnections = (role: string | null | undefined) => role === "owner";
export const MANAGE_DENIED = "Solo el Owner de la empresa puede conectar o desconectar Drive. Pídeselo a quien sea Owner.";

export const PERMISSIONS_TEXT = {
  intro: "Usa tu propia cuenta de Google Drive. NOKKO solo hará lo que se indica aquí.",
  reads: "Solo podrá leer lo que NOKKO haya guardado antes en tu Drive. Todavía no puede leer los documentos que ya tienes: elegirlos para importarlos llegará con el selector de Google.",
  saves: "Podrá guardar los planes, propuestas y documentos que NOKKO cree, en una carpeta «Nokko» de tu Drive.",
  revoke: "Puedes desconectarla cuando quieras.",
} as const;

/** What happened to the access at Google when a saved account was replaced or disconnected. Only «revoked» means Google confirmed it. */
export type RevokeOutcome = "revoked" | "failed" | "unreadable" | "same_account" | "shared";

/** Google ties its tokens to the grant of the account, so the old token is left alone when revoking it could cut an account still in use: the new connection is the same account, or another company uses it. */
export function revokeSkipReason(a: { oldEmail: string; newEmail?: string | null; usedElsewhere: boolean }): "same_account" | "shared" | null {
  if (a.usedElsewhere) return "shared";
  if (a.newEmail && a.newEmail === a.oldEmail) return "same_account";
  return null;
}

const GOOGLE_PERMISSIONS = "myaccount.google.com/permissions";
/** What the screen says about the revocation: never more than what happened. */
export function revocationText(outcome: RevokeOutcome, email: string): string {
  switch (outcome) {
    case "revoked": return `Google confirmó que se revocó el acceso de NOKKO a ${email}.`;
    case "failed": return `No pudimos revocar el acceso en Google (${email}). Quítaselo a NOKKO tú en ${GOOGLE_PERMISSIONS}.`;
    case "unreadable": return `No pudimos leer el acceso guardado de ${email}, así que no se revocó en Google. Quítaselo a NOKKO tú en ${GOOGLE_PERMISSIONS}.`;
    case "same_account": return "Es la misma cuenta de Google: no se revocó nada.";
    case "shared": return `No se revocó el acceso en Google porque ${email} sigue conectada en otra de tus empresas.`;
  }
}

/** What the card says the connection is for: only what drive.file allows today (no picker yet, SDD drive-per-company-account U-2). */
export const PURPOSE_TEXT = "Para qué se usa: guardar los planes, propuestas y documentos del ciclo en una carpeta por empresa y por cuenta, y leer lo que NOKKO guardó ahí. Todavía no puedes elegir documentos que ya tienes en tu Drive para importarlos: llegará con el selector de Google.";

export const ALREADY_ELSEWHERE = "Esta cuenta de Google ya está conectada en otra de tus empresas. Si sigues, también se usará aquí.";

export type AuthUrlInput = { clientId: string; redirectUri: string; state: string };

/** Google's consent URL: choose the account every time (CA-1) and ask only for DRIVE_SCOPE (CA-2). */
export function buildAuthUrl({ clientId, redirectUri, state }: AuthUrlInput): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "select_account consent",
    include_granted_scopes: "false",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export type GrantCheck = { ok: true; email: string } | { ok: false; error: string };

/** What Google returned for the code (token response) and for the account (Drive "about"): saved only if it works (CA-5, CA-6). */
export function checkGrant(token: { scope?: string; refresh_token?: string } | null, about: { user?: { emailAddress?: string } } | null): GrantCheck {
  if (!token) return { ok: false, error: "Google no devolvió la autorización. Vuelve a intentarlo." };
  const scopes = (token.scope ?? "").split(/\s+/);
  if (!scopes.includes(DRIVE_SCOPE)) return { ok: false, error: "Google no concedió el permiso de Drive. Acepta el permiso al conectar." };
  if (!token.refresh_token) return { ok: false, error: "Google no entregó acceso permanente. Quita NOKKO de los accesos de tu cuenta de Google y conecta de nuevo." };
  const email = about?.user?.emailAddress?.trim().toLowerCase();
  if (!email) return { ok: false, error: "No pudimos comprobar qué cuenta de Google es. Vuelve a intentarlo." };
  return { ok: true, email };
}

/** Text for the error Google puts in the redirect; unknown ones pass Google's own reason through. */
export function oauthErrorText(code: string, description?: string | null): string {
  if (code === "access_denied") return "Cancelaste la conexión con Google. No se ha cambiado nada.";
  if (code === "admin_policy_enforced") return "El administrador de tu Google Workspace no permite esta conexión. Pídele que autorice NOKKO.";
  const why = description?.trim();
  return why ? `Google no completó la conexión: ${why}` : "Google no completó la conexión. Vuelve a intentarlo.";
}

/** What a failed call says about the saved account: access gone (401, or a refused refresh with 400) is «error»; Google being down is «no_response»; anything else (a file we may not touch, say) says nothing about the account. */
export function failureStatus(httpStatus: number | null): { status: ConnectionStatus; text: string } | null {
  if (httpStatus === 400 || httpStatus === 401) return { status: "error", text: "Google ya no da acceso a esta cuenta. Reconéctala para seguir usándola." };
  if (httpStatus === null || httpStatus >= 500) return { status: "no_response", text: "Google no responde ahora. Lo reintentaremos; tu conexión sigue guardada." };
  return null;
}
