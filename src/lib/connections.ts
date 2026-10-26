// Connections («Conexiones»): which accounts a company has connected of its own, the state of each, and the
// rules for connecting, checking and disconnecting. Pure and tested; the I/O lives in connections.server.ts.
// SDD connections-bring-your-own-account, U-1 (states, structure) and U-2 (connect, check, disconnect).

/** How a provider is connected: sign in with Google-style consent, paste a key, or already built as its own panel. */
export type ConnectionKind = "oauth" | "key" | "panel";

export type Provider = {
  id: string;
  name: string;
  /** CA-3: what NOKKO uses the connection for. */
  purpose: string;
  kind: ConnectionKind;
  /**
   * Whether a company can connect its own account today. Off until the pending decisions are closed
   * (Google OAuth client, per-company keys): then the card reads «Solo proporcionada por NOKKO».
   */
  ownAccount: boolean;
  /** Server variables that make NOKKO's own account available; empty = nothing NOKKO provides. */
  nokkoEnv: string[];
};

/** Open list: a new provider is one more entry here, not a new screen. */
export const PROVIDERS: Provider[] = [
  { id: "google_drive", name: "Google Drive", purpose: "Lee los documentos que elijas para el onboarding y el conocimiento, y guarda planes, propuestas y documentos del ciclo.", kind: "oauth", ownAccount: false, nokkoEnv: ["GOOGLE_DRIVE_API_KEY"] },
  { id: "apollo", name: "Apollo.io", purpose: "Completa cuentas, busca personas y empresas y revela emails y móviles.", kind: "key", ownAccount: false, nokkoEnv: ["APOLLO_API_KEY"] },
  { id: "clay", name: "Clay", purpose: "Busca empresas y stakeholders y completa cuentas.", kind: "key", ownAccount: false, nokkoEnv: ["CLAY_API_KEY"] },
  { id: "parallel", name: "Parallel", purpose: "Informe profundo de cuenta, listas de empresas por ICP y tercera fuente de búsqueda.", kind: "key", ownAccount: false, nokkoEnv: ["PARALLEL_API_KEY"] },
  { id: "perplexity", name: "Perplexity", purpose: "Segunda fuente de búsqueda para noticias, casos de éxito e investigación.", kind: "key", ownAccount: false, nokkoEnv: ["PERPLEXITY_API_KEY"] },
  { id: "firecrawl", name: "Firecrawl", purpose: "Lee tu web y las de tus cuentas, y busca noticias.", kind: "key", ownAccount: false, nokkoEnv: ["FIRECRAWL_API_KEY"] },
  { id: "posthog", name: "PostHog", purpose: "Trae el uso de producto y el funnel de altas de tu empresa.", kind: "panel", ownAccount: true, nokkoEnv: [] },
  { id: "stripe", name: "Stripe", purpose: "Clientes de pago, MRR y churn reales.", kind: "panel", ownAccount: true, nokkoEnv: [] },
];

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id) ?? null;

/** CA-1 (plus the edge states of section 8). */
export type ConnectionState = "own" | "nokko" | "none" | "error" | "no_response" | "nokko_only";

export const STATE_LABEL: Record<ConnectionState, string> = {
  own: "Cuenta propia",
  nokko: "Proporcionada por NOKKO",
  none: "Sin conectar",
  error: "Error",
  no_response: "Sin respuesta",
  nokko_only: "Solo proporcionada por NOKKO",
};

export type RowStatus = "connected" | "error" | "no_response";

/** What the browser may know of a connection: never the credential (CA-2, CA-9). */
export type ConnectionRow = {
  provider: string;
  status: RowStatus;
  account_label: string;
  connected_by: string | null;
  connected_at: string;
  last_error: string | null;
  /** The own account ran out of credit and NOKKO's is covering (CA-13). */
  fallback_active?: boolean;
};

/** CA-1: one state per provider. A provider that is down is never shown as disconnected (section 8). */
export function connectionState(p: Provider, row: ConnectionRow | null, nokkoProvides: boolean): ConnectionState {
  if (row) return row.status === "error" ? "error" : row.status === "no_response" ? "no_response" : "own";
  if (!p.ownAccount) return nokkoProvides ? "nokko_only" : "none";
  return nokkoProvides ? "nokko" : "none";
}

/** CA-13: the label a card shows while NOKKO's account covers for an own one that ran out. */
export const coverageNote = (row: ConnectionRow | null) =>
  row?.fallback_active ? "Tu cuenta no tiene crédito o límite. NOKKO usa la suya mientras tanto y se descuenta de tu presupuesto." : null;

/** CA-11: only the Owner manages connections; everybody else reads. */
export const canManage = (role: string | null | undefined) => role === "owner";
export const READ_ONLY_NOTE = "Solo el Owner de la empresa puede conectar, cambiar o desconectar cuentas. Tú puedes ver el estado.";

/** CA-4: the steps shown for each way of connecting. */
export function connectSteps(kind: ConnectionKind, providerName: string): string[] {
  if (kind === "oauth") return [`Elige la cuenta de ${providerName} que quieres usar.`, "Revisa qué podrá hacer NOKKO y acepta.", "Comprobamos que funciona y te lo enseñamos antes de guardarla."];
  if (kind === "key") return [`Crea una clave en tu cuenta de ${providerName}.`, "Pégala aquí. Solo se guarda cifrada y nadie la verá después, ni tú.", "Comprobamos que funciona y te lo enseñamos antes de guardarla."];
  return [`${providerName} se configura en su propio panel de esta pantalla.`];
}

/** What a provider's check answers. The credential never travels in the result. */
export type CheckResult =
  | { ok: true; accountLabel: string }
  | { ok: false; reason: string; /** The provider did not answer: not the same as «wrong credential». */ down?: boolean };

export type ConnectOutcome =
  | { save: true; accountLabel: string; message: string }
  | { save: false; message: string; retry: boolean };

/** Characters that never belong in a visible account identifier (CA-2: the label is never a credential). */
const SECRET_LIKE = /^(sk|pk|rk|phx|phc|apk|key|tok|ghp|xox)[-_][A-Za-z0-9_-]{16,}$|^[A-Za-z0-9+/_-]{40,}$/;

/** The identifier shown for an account (an email, a workspace name). Refuses anything shaped like a key. */
export function visibleAccount(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!t || SECRET_LIKE.test(t)) return null;
  return t;
}

/** CA-5 and CA-6: a connection is saved only when the check passed; a failure explains why and saves nothing. */
export function connectOutcome(providerName: string, check: CheckResult): ConnectOutcome {
  if (!check.ok) {
    return check.down
      ? { save: false, retry: true, message: `${providerName} no ha respondido. No hemos guardado nada: vuelve a intentarlo en unos minutos.` }
      : { save: false, retry: false, message: `${check.reason} No hemos guardado la conexión.` };
  }
  const label = visibleAccount(check.accountLabel);
  if (!label) return { save: false, retry: false, message: `${providerName} no nos ha dado un identificador de cuenta que podamos mostrar. No hemos guardado la conexión.` };
  return { save: true, accountLabel: label, message: `Funciona. Cuenta: ${label}.` };
}

/** Section 8: the same account already connected in another company asks for confirmation first. */
export const needsSharedConfirmation = (otherCompanies: number, confirmed: boolean) => otherCompanies > 0 && !confirmed;
export const SHARED_ACCOUNT_NOTE = "Esta cuenta ya está conectada en otra empresa de NOKKO. Si continúas, se usará en las dos.";

/** CA-8: what happens when the company disconnects, said before and after. */
export const disconnectNote = (providerName: string) =>
  `NOKKO deja de usar tu cuenta de ${providerName} ahora mismo. Lo que ya se importó se queda en tu empresa con su origen y no se borra.`;

/** The change that applies on connect: a company has one account per provider, and the last confirmed wins (section 8). */
export type Audit = { action: "connected" | "changed" | "disconnected" | "check_failed"; accountLabel: string };

export function auditFor(previous: ConnectionRow | null, next: { accountLabel: string } | null): Audit {
  if (!next) return { action: "disconnected", accountLabel: previous?.account_label ?? "" };
  return { action: previous && previous.status !== "error" ? "changed" : "connected", accountLabel: next.accountLabel };
}

/** CA-9: the identifier used to compare accounts across companies; lower-cased, never the credential. */
export const accountKey = (label: string) => label.trim().toLowerCase();

/** Who connected it, in a sentence (CA-2). The name comes from the company's members, never the credential. */
export function connectedLine(row: ConnectionRow, who: string | null, now = new Date()): string {
  const d = new Date(row.connected_at);
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  const since = days <= 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;
  return `${row.account_label}${who ? ` · conectada por ${who}` : ""} · ${since}`;
}

/** Existing own-account panels read as connection rows, so Conexiones shows every provider in one view (CA-1, CA-2). */
export function rowFromPosthog(c: { project_id: string; status: string; created_at: string; created_by: string | null; last_error: string | null } | null): ConnectionRow | null {
  if (!c) return null;
  return { provider: "posthog", status: c.status === "error" ? "error" : "connected", account_label: `Proyecto ${c.project_id}`, connected_by: c.created_by, connected_at: c.created_at, last_error: c.last_error };
}

export function rowFromStripe(c: { account_name: string | null; key_hint: string; status: string; created_at: string; connected_by: string | null; last_error: string | null } | null): ConnectionRow | null {
  if (!c) return null;
  return { provider: "stripe", status: c.status === "error" ? "error" : "connected", account_label: c.account_name?.trim() || "Cuenta de Stripe", connected_by: c.connected_by, connected_at: c.created_at, last_error: c.last_error };
}
