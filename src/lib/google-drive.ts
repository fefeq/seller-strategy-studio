// Google Drive through the Lovable connector gateway (gateway-backed connection: LOVABLE_API_KEY +
// GOOGLE_DRIVE_API_KEY, read inside each call). Server-only usage: imported dynamically by drive-core.ts.
import { driveErrorText, driveQ, FOLDER_MIME, GDOC_MIME } from "@/lib/drive";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
export const FILE_FIELDS = "id,name,mimeType,modifiedTime,webViewLink,size,parents,trashed";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
  parents?: string[];
  trashed?: boolean;
};

export class DriveError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovable || !key)
    throw new DriveError(
      "Google Drive no está conectado en este proyecto. Conéctalo en Integraciones.",
      500,
    );
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": key,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `Google Drive request failed [${res.status}] ${path.split("?")[0]} body ${body.length} chars`,
    );
    throw new DriveError(driveErrorText(res.status, body), res.status);
  }
  return res;
}

const json = async <T>(path: string, init?: RequestInit) =>
  (await (await call(path, init)).json()) as T;

export const getFile = (id: string, fields = FILE_FIELDS) =>
  json<DriveFile>(
    `/drive/v3/files/${encodeURIComponent(id)}?fields=${fields}&supportsAllDrives=true`,
  );

export async function listFiles(q: string, pageSize = 50, orderBy?: string): Promise<DriveFile[]> {
  const p = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    fields: `files(${FILE_FIELDS})`,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (orderBy) p.set("orderBy", orderBy);
  return (await json<{ files?: DriveFile[] }>(`/drive/v3/files?${p}`)).files ?? [];
}

export const listChildren = (folderId: string) =>
  listFiles(`'${driveQ(folderId)}' in parents and trashed=false`, 100, "folder,modifiedTime desc");
export const findByAppProperty = (key: string, value: string) =>
  listFiles(
    `appProperties has { key='${driveQ(key)}' and value='${driveQ(value)}' } and trashed=false`,
    5,
  );

export const createFolder = (
  name: string,
  parent: string | undefined,
  appProperties: Record<string, string>,
) =>
  json<DriveFile>(`/drive/v3/files?fields=${FILE_FIELDS}&supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parent ? { parents: [parent] } : {}),
      appProperties,
    }),
  });

/** Uploads HTML that Drive converts into a Google Doc in the folder. */
export async function createGoogleDoc(
  name: string,
  html: string,
  parent: string,
): Promise<DriveFile> {
  const boundary = `nokko${crypto.randomUUID().replace(/-/g, "")}`;
  const meta = JSON.stringify({
    name,
    mimeType: GDOC_MIME,
    parents: [parent],
    appProperties: { nokko: "export" },
  });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
  return json<DriveFile>(
    `/upload/drive/v3/files?uploadType=multipart&fields=${FILE_FIELDS}&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
}

export const exportText = async (id: string, mime: string) =>
  (
    await call(
      `/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(mime)}`,
    )
  ).text();
export const downloadText = async (id: string) =>
  (await call(`/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`)).text();
export const downloadBytes = async (id: string) =>
  new Uint8Array(
    await (
      await call(`/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`)
    ).arrayBuffer(),
  );

/** A converted copy (Office → Google format) in a Nokko folder, so it can be exported as text and deleted. */
export const copyAs = (id: string, mimeType: string, parent: string) =>
  json<DriveFile>(
    `/drive/v3/files/${encodeURIComponent(id)}/copy?fields=id&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mimeType,
        parents: [parent],
        name: "Nokko · copia temporal",
        appProperties: { nokko: "temp" },
      }),
    },
  );

export const deleteFile = async (id: string) => {
  await call(`/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`, {
    method: "DELETE",
  });
};
