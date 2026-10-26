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
  reads: "Podrá leer únicamente los archivos y carpetas que elijas.",
  saves: "Podrá guardar los planes, propuestas y documentos que NOKKO cree, en una carpeta «Nokko» de tu Drive.",
  revoke: "Puedes desconectarla cuando quieras.",
} as const;

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

/** When the saved account stops working, the status the screen shows and what to ask the Owner. */
export function failureStatus(httpStatus: number | null): { status: ConnectionStatus; text: string } {
  if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403) return { status: "error", text: "Google ya no da acceso a esta cuenta. Reconéctala para seguir usándola." };
  return { status: "no_response", text: "Google no responde ahora. Lo reintentaremos; tu conexión sigue guardada." };
}
