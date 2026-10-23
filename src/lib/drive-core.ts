// Google Drive work shared by the screens (drive.functions.ts) and the agent/MCP tools (agent/tools/drive.ts).
// One Drive is connected (the builder's), and several companies use it, so every company only ever sees its
// own folder: "Nokko / <empresa>" is created by Nokko, and any file or folder read, listed or linked must sit
// inside it (checked by walking its parents). Folder rows are written only here, with the admin client,
// after those checks; members read them with RLS.
import type { Db } from "@/lib/org-data";
import { cleanText, driveIdFromUrl, FOLDER_MIME, kindLabel, markdownToHtml, MAX_DOWNLOAD, OUTSIDE_FOLDER, readPlan, safeName } from "@/lib/drive";
import { copyAs, createFolder, createGoogleDoc, deleteFile, downloadBytes, downloadText, DriveError, exportText, findByAppProperty, getFile, listChildren, listFiles, type DriveFile } from "@/lib/google-drive";
import { driveQ } from "@/lib/drive";

export type DriveScope = { db: Db; orgId: string; userId: string };
export type FolderRef = { id: string; name: string; url: string | null };
export type FileItem = { id: string; name: string; kind: string; isFolder: boolean; url: string | null; modified: string | null; readable: boolean };

const toItem = (f: DriveFile): FileItem => ({ id: f.id, name: f.name, kind: kindLabel(f.mimeType), isFolder: f.mimeType === FOLDER_MIME, url: f.webViewLink ?? null, modified: f.modifiedTime ?? null, readable: !!readPlan(f.mimeType) });
const toRef = (f: DriveFile): FolderRef => ({ id: f.id, name: f.name, url: f.webViewLink ?? null });

async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }

async function folderRow(s: DriveScope, accountId: string | null) {
  let q = s.db.from("drive_folders").select("folder_id,name,created_by_app").eq("org_id", s.orgId);
  q = accountId ? q.eq("account_id", accountId) : q.is("account_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function saveRow(s: DriveScope, accountId: string | null, f: DriveFile, byApp: boolean) {
  const db = await admin();
  let del = db.from("drive_folders").delete().eq("org_id", s.orgId);
  del = accountId ? del.eq("account_id", accountId) : del.is("account_id", null);
  await del;
  const { error } = await db.from("drive_folders").insert({ org_id: s.orgId, account_id: accountId, folder_id: f.id, name: f.name, created_by_app: byApp, created_by: s.userId });
  if (error) throw new Error(error.message);
}

/** The folder if it still exists and is not in the bin. */
async function alive(id: string): Promise<DriveFile | null> {
  try { const f = await getFile(id); return f.trashed ? null : f; } catch (e) { if (e instanceof DriveError && e.status === 404) return null; throw e; }
}

/** The company's folder ("Nokko / <empresa>"), created the first time it is needed. */
export async function companyFolder(s: DriveScope, create: true): Promise<FolderRef>;
export async function companyFolder(s: DriveScope, create: boolean): Promise<FolderRef | null>;
export async function companyFolder(s: DriveScope, create: boolean): Promise<FolderRef | null> {
  const row = await folderRow(s, null);
  if (row) { const f = await alive(row.folder_id); if (f) return toRef(f); }
  if (!create) return null;
  let f = (await findByAppProperty("nokko_org", s.orgId))[0];
  if (!f) {
    const top = (await findByAppProperty("nokko", "root"))[0] ?? await createFolder("Nokko", undefined, { nokko: "root" });
    const { data: org } = await s.db.from("organizations").select("name,company_name").eq("id", s.orgId).single();
    f = await createFolder(safeName(org?.company_name?.trim() || org?.name || "Empresa"), top.id, { nokko: "org", nokko_org: s.orgId });
  }
  await saveRow(s, null, f, true);
  return toRef(f);
}

/** The file plus its folders from the company folder down; throws unless it sits inside the company folder. */
async function insideCompany(s: DriveScope, fileId: string, cache = new Map<string, DriveFile>()): Promise<{ file: DriveFile; path: FolderRef[] }> {
  const root = await companyFolder(s, true);
  const get = async (id: string) => { let f = cache.get(id); if (!f) { f = await getFile(id); cache.set(id, f); } return f; };
  const file = await get(fileId);
  if (file.id === root.id) return { file, path: [] };
  const chain: DriveFile[] = [];
  let parent = file.parents?.[0];
  for (let depth = 0; parent && depth < 12; depth++) {
    if (parent === root.id) return { file, path: chain.reverse().map(toRef) };
    const p = await get(parent);
    chain.push(p);
    parent = p.parents?.[0];
  }
  throw new Error(OUTSIDE_FOLDER);
}

const mustId = (ref: string) => {
  const id = driveIdFromUrl(ref);
  if (!id) throw new Error("Eso no parece un enlace de Google Drive. Copia el enlace del archivo o carpeta desde Drive.");
  return id;
};

/** Files of the company folder (or a subfolder of it), or a search by name/content inside it. */
export async function browse(s: DriveScope, opts: { folderId?: string; query?: string }) {
  const root = await companyFolder(s, true);
  const q = opts.query?.trim();
  if (q) {
    const found = await listFiles(`(name contains '${driveQ(q)}' or fullText contains '${driveQ(q)}') and trashed=false`, 40);
    const cache = new Map<string, DriveFile>();
    const inside: DriveFile[] = [];
    for (const f of found) {
      cache.set(f.id, f);
      if (f.id === root.id) continue;
      try { await insideCompany(s, f.id, cache); inside.push(f); } catch { /* another company's or personal file */ }
      if (inside.length >= 25) break;
    }
    return { root, folder: root, path: [] as FolderRef[], files: inside.map(toItem) };
  }
  if (opts.folderId && opts.folderId !== root.id) {
    const { file, path } = await insideCompany(s, mustId(opts.folderId));
    if (file.mimeType !== FOLDER_MIME) throw new Error("Eso no es una carpeta.");
    return { root, folder: toRef(file), path, files: (await listChildren(file.id)).map(toItem) };
  }
  return { root, folder: root, path: [] as FolderRef[], files: (await listChildren(root.id)).map(toItem) };
}

function base64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** A file of the company folder as text (Docs as Markdown, Sheets as CSV, PDFs transcribed by the AI, Office converted). */
export async function readFile(s: DriveScope, ref: string) {
  const { file } = await insideCompany(s, mustId(ref));
  if (file.mimeType === FOLDER_MIME) throw new Error("Eso es una carpeta: elige un archivo de dentro.");
  const plan = readPlan(file.mimeType);
  if (!plan) throw new Error(`No puedo leer archivos de tipo ${kindLabel(file.mimeType).toLowerCase()}. Usa documentos, hojas, presentaciones, PDF o texto.`);
  const tooBig = () => { if (Number(file.size ?? 0) > MAX_DOWNLOAD) throw new Error("El archivo es demasiado grande para leerlo (máx. 10 MB)."); };
  let raw = "";
  if (plan.kind === "export") {
    raw = await exportText(file.id, plan.mime).catch((e) => { if (plan.fallback) return exportText(file.id, plan.fallback); throw e; });
  } else if (plan.kind === "text") {
    tooBig(); raw = await downloadText(file.id);
  } else if (plan.kind === "pdf") {
    tooBig();
    const { ask } = await import("@/lib/ai-gateway");
    raw = await ask(
      "Transcribe el documento a Markdown fiel al original: títulos, listas y tablas. No resumas, no comentes, no añadas nada. Si una página es solo imagen, describe en una línea lo que muestra.",
      `Documento: ${file.name}`,
      { effort: "low", files: [{ filename: file.name, dataUrl: `data:application/pdf;base64,${base64(await downloadBytes(file.id))}` }] },
    );
  } else {
    tooBig();
    const root = await companyFolder(s, true);
    const copy = await copyAs(file.id, plan.to, root.id);
    try { raw = await exportText(copy.id, plan.mime); } finally { await deleteFile(copy.id).catch(() => undefined); }
  }
  const { text, truncated } = cleanText(raw);
  if (!text) throw new Error("El archivo está vacío o no tiene texto que leer.");
  return { id: file.id, name: file.name, kind: kindLabel(file.mimeType), url: file.webViewLink ?? null, text, truncated };
}

/** Reads a file and saves it as a knowledge document of the section (team-wide; skills stay personal). */
export async function importToKnowledge(s: DriveScope, ref: string, section: string) {
  const r = await readFile(s, ref);
  const body = `${r.text}\n\nFuente: Google Drive — ${r.url ?? r.name}${r.truncated ? " (texto recortado: el original es más largo)" : ""}`;
  const { data, error } = await s.db.from("knowledge_docs")
    .insert({ org_id: s.orgId, section, title: safeName(r.name.replace(/\.[a-z0-9]{2,5}$/i, "")), body, scope: section === "skills" ? "personal" : "team", created_by: s.userId, updated_by: s.userId })
    .select("id,title").single();
  if (error) throw new Error(error.message);
  return { docId: data.id, title: data.title, truncated: r.truncated };
}

async function mustAccount(s: DriveScope, accountId: string) {
  const { data } = await s.db.from("accounts").select("id,name").eq("org_id", s.orgId).eq("id", accountId).maybeSingle();
  if (!data) throw new Error("No encuentro esa cuenta en esta empresa.");
  return data;
}

/** The account's folder: linked or created by Nokko inside the company folder. */
export async function accountFolder(s: DriveScope, accountId: string, create: boolean): Promise<(FolderRef & { byApp: boolean }) | null> {
  const account = await mustAccount(s, accountId);
  const row = await folderRow(s, accountId);
  if (row) { const f = await alive(row.folder_id); if (f) return { ...toRef(f), byApp: row.created_by_app }; }
  if (!create) return null;
  const root = await companyFolder(s, true);
  const f = (await findByAppProperty("nokko_account", accountId))[0] ?? await createFolder(safeName(account.name), root.id, { nokko: "account", nokko_account: accountId });
  await saveRow(s, accountId, f, true);
  return { ...toRef(f), byApp: true };
}

/** Links an existing folder (inside the company folder) to the account. */
export async function linkAccountFolder(s: DriveScope, accountId: string, ref: string) {
  await mustAccount(s, accountId);
  const { file } = await insideCompany(s, mustId(ref));
  if (file.mimeType !== FOLDER_MIME) throw new Error("Ese enlace es de un archivo, no de una carpeta.");
  await saveRow(s, accountId, file, false);
  return toRef(file);
}

export async function accountFiles(s: DriveScope, accountId: string) {
  const folder = await accountFolder(s, accountId, false);
  return { folder, files: folder ? (await listChildren(folder.id)).map(toItem) : [] };
}

/** Saves Markdown as a Google Doc in the account folder (or the company folder). A linked folder Nokko may not write into falls back to the company folder. */
export async function saveDocument(s: DriveScope, opts: { title: string; markdown: string; accountId?: string | null }) {
  const name = safeName(opts.title);
  const html = markdownToHtml(opts.markdown);
  const root = await companyFolder(s, true);
  const target = opts.accountId ? await accountFolder(s, opts.accountId, true) : null;
  if (target && target.id !== root.id) {
    try { const f = await createGoogleDoc(name, html, target.id); return { name: f.name, url: f.webViewLink ?? null, folder: target.name, fallback: false }; }
    catch (e) { if (!(e instanceof DriveError) || (e.status !== 403 && e.status !== 404)) throw e; }
  }
  const f = await createGoogleDoc(name, html, root.id);
  return { name: f.name, url: f.webViewLink ?? null, folder: root.name, fallback: !!target };
}
