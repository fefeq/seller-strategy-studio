// Google Drive rules that need no network (tested in drive.test.ts): links → ids, how each file type is
// read, Markdown → HTML for exported Google Docs, Drive search escaping and error texts.

export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const GDOC_MIME = "application/vnd.google-apps.document";
const GSHEET = "application/vnd.google-apps.spreadsheet";
const GSLIDES = "application/vnd.google-apps.presentation";

/** Longest text kept from one file (the hub, the agent and the setup AI all read it). */
export const MAX_TEXT = 60_000;
/** Largest binary file downloaded to read (PDFs go to the AI as a file). */
export const MAX_DOWNLOAD = 10 * 1024 * 1024;

const ID = /^[A-Za-z0-9_-]{10,200}$/;

/** The file or folder id in a Drive/Docs/Sheets/Slides link, or the id itself; null when it is neither. */
export function driveIdFromUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (ID.test(s)) return s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/(^|\.)google\.com$/i.test(u.hostname)) return null;
  const byPath = u.pathname.match(
    /\/(?:file\/d|document\/d|spreadsheets\/d|presentation\/d|folders|d)\/([A-Za-z0-9_-]{10,200})/,
  );
  if (byPath?.[1]) return byPath[1];
  const q = u.searchParams.get("id");
  return q && ID.test(q) ? q : null;
}

export type ReadPlan =
  | { kind: "export"; mime: string; fallback?: string }
  | { kind: "text" }
  | { kind: "pdf" }
  | { kind: "convert"; to: string; mime: string };

const OFFICE: Record<string, { to: string; mime: string }> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    to: GDOC_MIME,
    mime: "text/markdown",
  },
  "application/msword": { to: GDOC_MIME, mime: "text/markdown" },
  "application/rtf": { to: GDOC_MIME, mime: "text/markdown" },
  "application/vnd.oasis.opendocument.text": { to: GDOC_MIME, mime: "text/markdown" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    to: GSHEET,
    mime: "text/csv",
  },
  "application/vnd.ms-excel": { to: GSHEET, mime: "text/csv" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    to: GSLIDES,
    mime: "text/plain",
  },
  "application/vnd.ms-powerpoint": { to: GSLIDES, mime: "text/plain" },
};

/** How a file of this type becomes text; null = Nokko cannot read it (images, videos, zips…). */
export function readPlan(mime: string): ReadPlan | null {
  if (mime === GDOC_MIME) return { kind: "export", mime: "text/markdown", fallback: "text/plain" };
  if (mime === GSHEET) return { kind: "export", mime: "text/csv" };
  if (mime === GSLIDES) return { kind: "export", mime: "text/plain" };
  if (mime === "application/pdf") return { kind: "pdf" };
  if (mime.startsWith("text/") || mime === "application/json") return { kind: "text" };
  const office = OFFICE[mime];
  return office ? { kind: "convert", ...office } : null;
}

const KIND: [RegExp, string][] = [
  [/folder$/, "Carpeta"],
  [/document$|wordprocessingml|msword|opendocument\.text|rtf/, "Documento"],
  [/spreadsheet|ms-excel|text\/csv/, "Hoja de cálculo"],
  [/presentation|powerpoint/, "Presentación"],
  [/pdf$/, "PDF"],
  [/^image\//, "Imagen"],
  [/^video\//, "Vídeo"],
  [/^text\//, "Texto"],
];
export const kindLabel = (mime: string) => KIND.find(([re]) => re.test(mime))?.[1] ?? "Archivo";

/** Drive query literal: backslashes and single quotes escaped. */
export const driveQ = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Export text cleaned: no BOM, Unix line ends, no runs of blank lines, cut to the limit. */
export function cleanText(raw: string, max = MAX_TEXT): { text: string; truncated: boolean } {
  const t = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^(#{1,6}) \*\*(.+)\*\*$/gm, "$1 $2")
    .replace(/\\([_*])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t.length > max
    ? { text: `${t.slice(0, max)}…`, truncated: true }
    : { text: t, truncated: false };
}

/** Folder or file name Drive accepts and people can read: no slashes or control characters, ≤ 120 chars. */
export function safeName(raw: string, fallback = "Sin título"): string {
  const s = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return s || fallback;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
    .replace(/(^|[\s(])_([^_\s][^_]*)_(?=$|[\s).,;:])/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Markdown (headings, lists, bold, italics, links, quotes, rules) → HTML that Drive converts to a Google Doc. */
export function markdownToHtml(md: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join("<br>")}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const line of md.replace(/\r\n?/g, "\n").split("\n")) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }
    if (h) {
      flushPara();
      closeList();
      const n = h[1]!.length;
      out.push(`<h${n}>${inline(h[2]!)}</h${n}>`);
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushPara();
      closeList();
      out.push("<hr>");
      continue;
    }
    if (ul || ol) {
      flushPara();
      const want = ul ? "ul" : "ol";
      if (list !== want) {
        closeList();
        out.push(`<${want}>`);
        list = want;
      }
      out.push(`<li>${inline((ul ?? ol)![1]!)}</li>`);
      continue;
    }
    if (line.startsWith(">")) {
      flushPara();
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    closeList();
    para.push(line);
  }
  flushPara();
  closeList();
  return `<html><head><meta charset="utf-8"></head><body>${out.join("")}</body></html>`;
}

/** The account plan as a document: one heading per filled field, empty ones left out. */
export function planMarkdown(
  accountName: string,
  fields: [label: string, value: string | null | undefined][],
  date = new Date(),
): string {
  const parts = [
    `# Plan de cuenta · ${accountName}`,
    `_Exportado desde Nokko el ${date.toLocaleDateString("es-ES")}_`,
  ];
  for (const [label, v] of fields) if (v?.trim()) parts.push(`## ${label}`, v.trim());
  return parts.join("\n\n");
}

/** Spanish «qué pasó + qué hacer» for a failed Drive call. */
export function driveErrorText(status: number, body = ""): string {
  if (status === 401)
    return "La conexión con Google Drive ha caducado. Vuelve a conectarla en Integraciones.";
  if (status === 403 && /insufficient|scope|permission/i.test(body))
    return "Google Drive no deja hacer esto con los permisos de la conexión. Guarda en carpetas creadas por Nokko o revisa la conexión.";
  if (status === 403 && /rate|quota|limit/i.test(body))
    return "Google Drive está limitando las peticiones. Inténtalo en un minuto.";
  if (status === 404)
    return "No encuentro ese archivo en Google Drive: puede que se haya borrado o movido.";
  if (status === 429) return "Google Drive está limitando las peticiones. Inténtalo en un minuto.";
  if (status === 402)
    return "Sin créditos para usar Google Drive. Revisa los créditos del espacio de trabajo.";
  return "Google Drive no ha respondido. Inténtalo de nuevo en un momento.";
}

export const OUTSIDE_FOLDER =
  "Ese archivo no está dentro de la carpeta de esta empresa en Google Drive. Muévelo a la carpeta de la empresa (Nokko › empresa) y vuelve a intentarlo.";
