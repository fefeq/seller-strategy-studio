// SDD-20261109-rules-write-permissions (NK-0095) U-3 · CA-9: importToKnowledge refuses to write into Reglas for anyone but the
// Owner or a Sales Leader, before reading the file (no Drive call, no AI transcription) and without inserting. Every caller
// (screen, background job, agent/Telegram/MCP) goes through it. Google Drive and the AI are mocked; fictional data only.
import { beforeEach, describe, expect, it, vi } from "vitest";

const drive = vi.hoisted(() => ({
  getFile: vi.fn(),
  exportText: vi.fn(),
  downloadText: vi.fn(),
  downloadBytes: vi.fn(),
  ask: vi.fn(),
}));
vi.mock("@/lib/google-drive", () => ({
  DriveError: class DriveError extends Error {
    status = 0;
  },
  getFile: drive.getFile,
  exportText: drive.exportText,
  downloadText: drive.downloadText,
  downloadBytes: drive.downloadBytes,
  copyAs: vi.fn(),
  createFolder: vi.fn(),
  createGoogleDoc: vi.fn(),
  deleteFile: vi.fn(),
  findByAppProperty: vi.fn(async () => []),
  listChildren: vi.fn(async () => []),
  listFiles: vi.fn(async () => []),
}));
vi.mock("@/lib/ai-gateway", () => ({ ask: drive.ask }));

import type { Db } from "@/lib/org-data";
import { importToKnowledge } from "@/lib/drive-core";
import { BINDING_WRITE_DENIED } from "@/lib/knowledge-rules";

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const ROOT = "folder-root-1";
const FILE = "file-guia-1";

type Write = { table: string; op: string; payload: unknown };
/** A fake client per table: the company folder row exists, and an insert into knowledge_docs returns the new row. */
function fakeDb() {
  const writes: Write[] = [];
  const from = (table: string) => {
    let op = "select";
    const res = () => {
      if (table === "drive_folders")
        return {
          data: { folder_id: ROOT, name: "Empresa Ficticia", created_by_app: true },
          error: null,
        };
      if (table === "knowledge_docs" && op === "insert")
        return { data: { id: "doc-1", title: "Guía de prueba" }, error: null };
      return { data: null, error: null };
    };
    const q: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (f: (v: unknown) => unknown) => Promise.resolve(res()).then(f);
          return (...a: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "delete") {
              op = prop;
              writes.push({ table, op, payload: a[0] });
            }
            if (prop === "single" || prop === "maybeSingle") return Promise.resolve(res());
            return q;
          };
        },
      },
    );
    return q;
  };
  return { db: { from } as unknown as Db, writes };
}

const driveCalls = () =>
  drive.getFile.mock.calls.length +
  drive.exportText.mock.calls.length +
  drive.downloadText.mock.calls.length +
  drive.downloadBytes.mock.calls.length +
  drive.ask.mock.calls.length;

beforeEach(() => {
  vi.clearAllMocks();
  drive.getFile.mockImplementation(async (id: string) =>
    id === ROOT
      ? { id: ROOT, name: "Empresa Ficticia", mimeType: "application/vnd.google-apps.folder" }
      : { id: FILE, name: "Guía de prueba.txt", mimeType: "text/plain", parents: [ROOT] },
  );
  drive.downloadText.mockResolvedValue("Texto ficticio de la guía.");
});

describe("importToKnowledge only lets the Owner or a Sales Leader write into Reglas (NK-0095, CA-9)", () => {
  it.each([[["ae"]], [["sdr"]], [["enablement"]], [[]]])(
    "roles %j into rules: BINDING_WRITE_DENIED before reading Drive or the AI, nothing inserted",
    async (roles) => {
      const { db, writes } = fakeDb();
      await expect(
        importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", roles),
      ).rejects.toThrow(BINDING_WRITE_DENIED);
      expect(driveCalls()).toBe(0);
      expect(writes).toEqual([]);
    },
  );

  it.each([[["owner"]], [["sales_leader"]], [["ae", "sales_leader"]]])(
    "roles %j into rules: reads the file and inserts a team rule as today",
    async (roles) => {
      const { db, writes } = fakeDb();
      const r = await importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", roles);
      expect(r.docId).toBe("doc-1");
      expect(drive.downloadText).toHaveBeenCalledWith(FILE);
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({
        table: "knowledge_docs",
        op: "insert",
        payload: { org_id: ORG, section: "rules", scope: "team" },
      });
    },
  );

  it.each(["company", "objections", "playbooks", "methodology", "campaigns", "skills"])(
    "an ae still imports into %s as today",
    async (section) => {
      const { db, writes } = fakeDb();
      await importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, section, ["ae"]);
      expect(writes).toHaveLength(1);
      expect(writes[0]!.payload).toMatchObject({
        section,
        scope: section === "skills" ? "personal" : "team",
      });
    },
  );
});
