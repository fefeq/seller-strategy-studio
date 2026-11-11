// NK-0141 CA-1..CA-3: importing a Drive file into Reglas whose title already exists (unique index of migration 0085,
// Postgres 23505) tells the person, in Spanish and actionable, which title clashes. Never the raw Postgres text, the title
// never reaches a log, nothing is written twice, and every other import error stays as it was. Drive and the AI are
// mocked; fictional data only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { errorText } from "@/lib/errors";

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const ROOT = "folder-root-1";
const FILE = "file-guia-1";

type Write = { table: string; op: string; payload: unknown };
type PgError = { code: string; message: string };

const DUP: PgError = {
  code: "23505",
  message: 'duplicate key value violates unique constraint "knowledge_docs_team_rule_title_uniq"',
};

/** Fake client: the company folder row exists and an insert into knowledge_docs answers with `insertError`. */
function fakeDb(insertError: PgError | null) {
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
        return insertError
          ? { data: null, error: insertError }
          : { data: { id: "doc-1", title: "Guía de prueba" }, error: null };
      return { data: null, error: null };
    };
    const q: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (f: (v: unknown) => unknown) => Promise.resolve(res()).then(f);
          return (...a: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
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

const OWNER = ["owner"];
const rejection = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as Error;
  }
  throw new Error("expected a rejection");
};

let logs: ReturnType<typeof vi.spyOn>[];
beforeEach(() => {
  vi.clearAllMocks();
  logs = [
    vi.spyOn(console, "log").mockImplementation(() => {}),
    vi.spyOn(console, "info").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "debug").mockImplementation(() => {}),
  ];
  drive.getFile.mockImplementation(async (id: string) =>
    id === ROOT
      ? { id: ROOT, name: "Empresa Ficticia", mimeType: "application/vnd.google-apps.folder" }
      : { id: FILE, name: "Guía de prueba.txt", mimeType: "text/plain", parents: [ROOT] },
  );
  drive.downloadText.mockResolvedValue("Texto ficticio de la guía.");
});
afterEach(() => vi.restoreAllMocks());

describe("importing into Reglas a title that already exists (NK-0141)", () => {
  it("CA-1: tells the person which title clashes and what to do, in Spanish", async () => {
    const { db } = fakeDb(DUP);
    const e = await rejection(
      importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", OWNER),
    );
    expect(e.message).toBe(
      "Ya hay una regla con el título «Guía de prueba». Cámbiale el nombre al archivo o edita la regla existente.",
    );
  });

  it("CA-1: never the raw Postgres text, not even after errorText (screen toast, job error)", async () => {
    const { db } = fakeDb(DUP);
    const e = await rejection(
      importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", OWNER),
    );
    for (const text of [e.message, errorText(e)]) {
      expect(text).not.toMatch(/duplicate|violates|constraint|unique|knowledge_docs|23505/i);
      expect(text).toContain("«Guía de prueba»");
      expect(text).toMatch(/^Ya hay una regla con el título/);
    }
  });

  it("CA-1: a title made of English words still reaches the person through errorText", async () => {
    drive.getFile.mockImplementation(async (id: string) =>
      id === ROOT
        ? { id: ROOT, name: "Empresa Ficticia", mimeType: "application/vnd.google-apps.folder" }
        : {
            id: FILE,
            name: "The rule is not with us.txt",
            mimeType: "text/plain",
            parents: [ROOT],
          },
    );
    const { db } = fakeDb(DUP);
    const e = await rejection(
      importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", OWNER),
    );
    expect(errorText(e)).toBe(
      "Ya hay una regla con el título «The rule is not with us». Cámbiale el nombre al archivo o edita la regla existente.",
    );
  });

  it("CA-1: the title goes only in the message to the person, never in a log", async () => {
    const { db } = fakeDb(DUP);
    await rejection(importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", OWNER));
    for (const spy of logs) expect(spy).not.toHaveBeenCalled();
  });

  it("CA-2: one insert and nothing else (no retry, no update of the existing rule, no half write)", async () => {
    const { db, writes } = fakeDb(DUP);
    await rejection(importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", OWNER));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "knowledge_docs", op: "insert" });
  });

  it("CA-3: another error into Reglas keeps today's message", async () => {
    const other: PgError = { code: "42501", message: "new row violates row-level security policy" };
    const { db } = fakeDb(other);
    const e = await rejection(
      importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", OWNER),
    );
    expect(e.message).toBe(other.message);
  });

  it.each(["company", "objections", "playbooks", "methodology", "campaigns", "skills"])(
    "CA-3: a 23505 into %s keeps today's message (the rule is only for Reglas)",
    async (section) => {
      const { db } = fakeDb(DUP);
      const e = await rejection(
        importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, section, ["ae"]),
      );
      expect(e.message).toBe(DUP.message);
    },
  );

  it("CA-3: a title that is free still imports as today", async () => {
    const { db, writes } = fakeDb(null);
    const r = await importToKnowledge({ db, orgId: ORG, userId: ME }, FILE, "rules", OWNER);
    expect(r.docId).toBe("doc-1");
    expect(writes).toHaveLength(1);
  });
});
