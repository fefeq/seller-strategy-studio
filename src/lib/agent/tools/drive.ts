// Google Drive (the connected Drive, each company limited to its own "Nokko / <empresa>" folder).
// Same cores as the screens (drive-core.ts).
import { z } from "zod";
import { clip, def, mustFind, type AgentTool, type ToolCtx } from "../tool-kit";

const SECTION = z
  .enum(["company", "objections", "playbooks", "methodology", "campaigns", "skills", "rules"])
  .describe(
    "Sección del hub: company (empresa), objections (objeciones y battlecards), playbooks, methodology, campaigns, skills, rules",
  );
const FILE = z
  .string()
  .min(5)
  .max(500)
  .describe("Enlace de Google Drive o id del archivo (de drive_search o drive_list_account_files)");
const scope = (c: ToolCtx) => ({
  db: c.db,
  orgId: c.orgId,
  userId: c.userId,
});
const item = (f: {
  id: string;
  name: string;
  kind: string;
  url: string | null;
  modified: string | null;
  readable: boolean;
}) => ({
  id: f.id,
  nombre: f.name,
  tipo: f.kind,
  url: f.url,
  modificado: f.modified,
  se_puede_leer: f.readable,
});

export const DRIVE_TOOLS: AgentTool[] = [
  def({
    name: "drive_search",
    kind: "read",
    description:
      "Busca archivos en la carpeta de la empresa en Google Drive (por nombre o contenido). Sin texto, lista lo que hay en la carpeta de la empresa o en la subcarpeta indicada.",
    input: z.object({
      query: z.string().max(100).optional(),
      folder_id: z
        .string()
        .min(5)
        .max(500)
        .optional()
        .describe("Subcarpeta a listar (id o enlace)"),
    }),
    run: async (c, a) => {
      const { browse } = await import("@/lib/drive-core");
      const r = await browse(scope(c), { query: a.query, folderId: a.folder_id });
      return { carpeta_empresa: r.root.url, carpeta: r.folder.name, archivos: r.files.map(item) };
    },
  }),
  def({
    name: "drive_list_account_files",
    kind: "read",
    description: "Archivos de la carpeta de Google Drive de una cuenta (si tiene carpeta).",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { accountFiles } = await import("@/lib/drive-core");
      const r = await accountFiles(scope(c), a.account_id);
      return r.folder
        ? { carpeta: r.folder.name, url: r.folder.url, archivos: r.files.map(item) }
        : {
            carpeta: null,
            mensaje:
              "La cuenta aún no tiene carpeta en Drive. Créala o enlázala con drive_link_account_folder.",
          };
    },
  }),
  def({
    name: "drive_read_file",
    kind: "read",
    description:
      "Lee el texto de un archivo de la carpeta de la empresa en Google Drive (documentos, hojas, presentaciones, PDF, Word, texto). Los PDF los transcribe la IA y tardan unos segundos.",
    input: z.object({ file: FILE }),
    run: async (c, a) => {
      const { readFile } = await import("@/lib/drive-core");
      const r = await readFile(scope(c), a.file);
      return {
        nombre: r.name,
        tipo: r.kind,
        url: r.url,
        texto: clip(r.text, 12_000),
        recortado: r.truncated || r.text.length > 12_000,
      };
    },
  }),
  def({
    name: "drive_import_to_knowledge",
    kind: "write",
    description:
      "Importa un archivo de la carpeta de la empresa en Google Drive al hub de conocimiento como documento de la sección indicada (con enlace a la fuente). Los agentes lo usarán como contexto. En la sección Reglas (rules) solo pueden importar el Owner o un Sales Leader.",
    input: z.object({ file: FILE, section: SECTION }),
    summarize: () => "Importar un archivo de Google Drive al hub de conocimiento",
    run: async (c, a) => {
      const { checkImportAllowed, importToKnowledge } = await import("@/lib/drive-core");
      // Checked again when it runs: Telegram and confirmations may use the privileged client (no RLS).
      checkImportAllowed(a.section, c.roles);
      const r = await importToKnowledge(scope(c), a.file, a.section, c.roles);
      return {
        mensaje: `«${r.title}» importado al hub de conocimiento.${r.truncated ? " El texto se ha recortado porque el original es muy largo." : ""}`,
        doc_id: r.docId,
      };
    },
  }),
  def({
    name: "drive_save_document",
    kind: "write",
    description:
      "Guarda un texto en Markdown como Google Doc en la carpeta de Drive de la cuenta (la crea si no existe) o, sin cuenta, en la carpeta de la empresa. Úsalo para propuestas, planes de cuenta, briefs o documentos del ciclo.",
    input: z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(100_000).describe("Contenido en Markdown"),
      account_id: z.string().uuid().optional(),
    }),
    summarize: (a) => `Guardar «${a.title}» en Google Drive`,
    run: async (c, a) => {
      if (a.account_id) await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { saveDocument } = await import("@/lib/drive-core");
      const r = await saveDocument(scope(c), {
        title: a.title,
        markdown: a.content,
        accountId: a.account_id,
      });
      return {
        mensaje: `Guardado en Drive (carpeta «${r.folder}»)${r.fallback ? ": no se puede escribir en la carpeta enlazada de la cuenta" : ""}: ${r.url ?? r.name}`,
        url: r.url,
      };
    },
  }),
  def({
    name: "drive_link_account_folder",
    kind: "write",
    description:
      "Da a una cuenta su carpeta de Google Drive: enlaza una carpeta existente (debe estar dentro de la carpeta de la empresa) o, sin enlace, crea una nueva con el nombre de la cuenta.",
    input: z.object({
      account_id: z.string().uuid(),
      folder: z
        .string()
        .min(5)
        .max(500)
        .optional()
        .describe("Enlace o id de una carpeta existente"),
    }),
    summarize: (a) =>
      a.folder
        ? "Enlazar una carpeta de Google Drive a la cuenta"
        : "Crear la carpeta de Google Drive de la cuenta",
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const core = await import("@/lib/drive-core");
      const f = a.folder
        ? await core.linkAccountFolder(scope(c), a.account_id, a.folder)
        : await core.accountFolder(scope(c), a.account_id, true);
      return {
        mensaje: `Carpeta de Drive de la cuenta: «${f?.name}» ${f?.url ?? ""}`.trim(),
        url: f?.url ?? null,
      };
    },
  }),
];
