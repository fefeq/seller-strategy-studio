/**
 * App User Connector helpers. Server-only: read server secrets from process.env.
 * Never import from a browser bundle; only from createServerFn handlers or server routes.
 */
function requireApiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not set. App User Connector calls require a server-side workspace token.");
  return key;
}

export interface AppUserOAuthAuthorizeParams {
  gatewayBaseUrl: string;
  connectorId: string;
  appUserId: string;
  clientAPIKey: string;
  returnUrl: string;
  credentialsConfiguration?: Record<string, unknown>;
}

export async function authorizeAppUserOAuth(p: AppUserOAuthAuthorizeParams): Promise<{ authorizationUrl: string; sessionId: string }> {
  const res = await fetch(`${p.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json", "X-Client-Api-Key": p.clientAPIKey },
    body: JSON.stringify({ connector_id: p.connectorId, app_user_id: p.appUserId, return_url: p.returnUrl, credentials_configuration: p.credentialsConfiguration }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App User OAuth start failed (${res.status}): ${text || res.statusText}`);
  let body: { authorization_url?: string; session_id?: string };
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`App User OAuth start returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (!body.authorization_url) throw new Error("App User OAuth start response missing authorization_url");
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? "" };
}

export interface CallAsAppUserParams {
  gatewayBaseUrl: string;
  connectionAPIKey: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
  requiredScopes?: string[];
}

export async function callAsAppUser({ gatewayBaseUrl, connectionAPIKey, connectorId, path, init, requiredScopes }: CallAsAppUserParams): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", connectionAPIKey);
  if (requiredScopes?.length) headers.set("X-Lovable-Required-Scopes", requiredScopes.join(" "));
  return fetch(`${gatewayBaseUrl}/${connectorId}${normalizedPath}`, { ...init, headers });
}

/** A gateway 401 whose body type starts with "credential_" means the connection must be re-authorized. */
export async function appUserReconnectRequired(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  const body = (await res.clone().json().catch(() => null)) as { type?: unknown } | null;
  return typeof body?.type === "string" && body.type.startsWith("credential_");
}

export async function disconnectAppUser(p: { gatewayBaseUrl: string; connectionAPIKey: string; connectorId: string }): Promise<void> {
  const res = await fetch(`${p.gatewayBaseUrl}/api/v1/app-users/connection`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${requireApiKey()}`, "X-Connection-Api-Key": p.connectionAPIKey, "Content-Type": "application/json" },
    body: JSON.stringify({ connector_id: p.connectorId }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App User disconnect failed (${res.status}): ${text || res.statusText}`);
}

export async function exchangeAppUserOAuthCode(gatewayBaseUrl: string, code: string): Promise<{ connectionAPIKey: string; connectorId: string }> {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App User OAuth exchange failed (${res.status}): ${text || res.statusText}`);
  let body: { api_key?: string; connector_id?: string };
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`App User OAuth exchange returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (!body.api_key) throw new Error("App User OAuth exchange response missing api_key");
  if (!body.connector_id) throw new Error("App User OAuth exchange response missing connector_id");
  return { connectionAPIKey: body.api_key, connectorId: body.connector_id };
}
