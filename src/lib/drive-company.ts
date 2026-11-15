// C2 pure rules for the per-company Google Drive account (SDD-20261025-drive-per-company-account).
export const DRIVE_CONNECTOR = "google_drive";
export const DRIVE_CLIENT_ENV = "GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY";
/** Minimum scopes (CA-2): drive.file covers only what NOKKO creates or the user picks; readonly lets NOKKO read chosen docs. */
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];
export const DRIVE_CONNECT_COPY =
  "Conecta el Drive donde están tus documentos. Solo podremos leer lo que elijas. Puedes desconectarlo cuando quieras.";

export type DriveCompanyState =
  | { kind: "setup_needed" } // Google credentials for NOKKO not provided yet
  | { kind: "shared" } // transition: still on NOKKO's shared folder
  | { kind: "connected"; email: string | null; by: string | null; at: string }
  | { kind: "reconnect"; email: string | null; by: string | null; at: string };

export function driveCompanyState(
  clientReady: boolean,
  row: { account_email: string | null; connected_at: string; status: string; by: string | null } | null,
): DriveCompanyState {
  if (row) {
    const base = { email: row.account_email, by: row.by, at: row.connected_at };
    return row.status === "reconnect" ? { kind: "reconnect", ...base } : { kind: "connected", ...base };
  }
  return clientReady ? { kind: "shared" } : { kind: "setup_needed" };
}

/** CA-10: only the Owner connects, switches or disconnects; everyone else reads the state. */
export const canManageDrive = (roles: string[]) => roles.includes("owner");
