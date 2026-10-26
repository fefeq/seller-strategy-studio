// Google Drive. A call runs with a DriveAuth: NOKKO's own gateway-backed connection (LOVABLE_API_KEY +
// GOOGLE_DRIVE_API_KEY, read inside each call) or a company's own Google account (drive-connection.server.ts).
// Server-only usage: imported dynamically by drive-core.ts.
import { driveErrorText, driveQ, FOLDER_MIME, GDOC_MIME } from "@/lib/drive";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
export const GOOGLE_API = "https://www.googleapis.com";
export const FILE_FIELDS = "id,name,mimeType,modifiedTime,webViewLink,size,parents,trashed";

export type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string; size?: string; parents?: string[]; trashed?: boolean };

export class DriveError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Where and how a Drive call is made. `onFailure` hears about a 401, a 5xx or no answer at all (status null). */
export type DriveAuth = { base: string; headers: () => Promise<Record<string, string>>; onFailure?: (status: number | null) => Promise<void> };

/** NOKKO's own Drive, through the connector gateway (used while a company has not connected its own). */
export const nokkoAuth: DriveAuth = {
  base: GATEWAY,
  headers: async () => {
    const lovable = process.env["LOVABLE_API_KEY"];
    const key = process.env["GOOGLE_DRIVE_API_KEY"];
    if (!lovable || !key) throw new DriveError("Google Drive no está conectado en este proyecto. Conéctalo en Integraciones.", 500);
    return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key };
  },
};

export function driveApi(auth: DriveAuth) {
  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = { ...(await auth.headers()), ...(init.headers ?? {}) };
    let res: Response;
    try {
      res = await fetch(`${auth.base}${path}`, { ...init, headers });
    } catch {
      await auth.onFailure?.(null);
      throw new DriveError("Google Drive no responde ahora. Inténtalo de nuevo en unos minutos.", 503);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Google Drive request failed [${res.status}] ${path.split("?")[0]}: ${body.slice(0, 500)}`);
      if (res.status === 401 || res.status >= 500) await auth.onFailure?.(res.status);
      throw new DriveError(driveErrorText(res.status, body), res.status);
    }
    return res;
  }

  const json = async <T>(path: string, init?: RequestInit) => (await (await call(path, init)).json()) as T;
  const fileUrl = (id: string) => `/drive/v3/files/${encodeURIComponent(id)}`;

  const getFile = (id: string, fields = FILE_FIELDS) => json<DriveFile>(`${fileUrl(id)}?fields=${fields}&supportsAllDrives=true`);

  async function listFiles(q: string, pageSize = 50, orderBy?: string): Promise<DriveFile[]> {
    const p = new URLSearchParams({ q, pageSize: String(pageSize), fields: `files(${FILE_FIELDS})`, supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
    if (orderBy) p.set("orderBy", orderBy);
    return (await json<{ files?: DriveFile[] }>(`/drive/v3/files?${p}`)).files ?? [];
  }

  const listChildren = (folderId: string) => listFiles(`'${driveQ(folderId)}' in parents and trashed=false`, 100, "folder,modifiedTime desc");
  const findByAppProperty = (key: string, value: string) => listFiles(`appProperties has { key='${driveQ(key)}' and value='${driveQ(value)}' } and trashed=false`, 5);

  const createFolder = (name: string, parent: string | undefined, appProperties: Record<string, string>) =>
    json<DriveFile>(`/drive/v3/files?fields=${FILE_FIELDS}&supportsAllDrives=true`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}), appProperties }),
    });

  /** Uploads HTML that Drive converts into a Google Doc in the folder. */
  async function createGoogleDoc(name: string, html: string, parent: string): Promise<DriveFile> {
    const boundary = `nokko${crypto.randomUUID().replace(/-/g, "")}`;
    const meta = JSON.stringify({ name, mimeType: GDOC_MIME, parents: [parent], appProperties: { nokko: "export" } });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
    return json<DriveFile>(`/upload/drive/v3/files?uploadType=multipart&fields=${FILE_FIELDS}&supportsAllDrives=true`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  }

  const exportText = async (id: string, mime: string) => (await call(`${fileUrl(id)}/export?mimeType=${encodeURIComponent(mime)}`)).text();
  const downloadText = async (id: string) => (await call(`${fileUrl(id)}?alt=media&supportsAllDrives=true`)).text();
  const downloadBytes = async (id: string) => new Uint8Array(await (await call(`${fileUrl(id)}?alt=media&supportsAllDrives=true`)).arrayBuffer());

  /** A converted copy (Office → Google format) in a Nokko folder, so it can be exported as text and deleted. */
  const copyAs = (id: string, mimeType: string, parent: string) =>
    json<DriveFile>(`${fileUrl(id)}/copy?fields=id&supportsAllDrives=true`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType, parents: [parent], name: "Nokko · copia temporal", appProperties: { nokko: "temp" } }),
    });

  const deleteFile = async (id: string) => { await call(`${fileUrl(id)}?supportsAllDrives=true`, { method: "DELETE" }); };

  return { getFile, listFiles, listChildren, findByAppProperty, createFolder, createGoogleDoc, exportText, downloadText, downloadBytes, copyAs, deleteFile };
}

export type DriveApi = ReturnType<typeof driveApi>;
