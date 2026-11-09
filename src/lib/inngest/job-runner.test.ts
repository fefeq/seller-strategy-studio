// Background job runner (admin client, no RLS). Each ticket keeps its cases in its own describe.
// Google Drive, the AI and notices are mocked; the admin client is a fake that records writes. Fictional data only.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getFile: vi.fn(),
  exportText: vi.fn(),
  downloadText: vi.fn(),
  downloadBytes: vi.fn(),
  ask: vi.fn(),
  deliverJobNotice: vi.fn(async () => undefined),
}));
vi.mock("@/lib/google-drive", () => ({
  DriveError: class DriveError extends Error {
    status = 0;
  },
  getFile: m.getFile,
  exportText: m.exportText,
  downloadText: m.downloadText,
  downloadBytes: m.downloadBytes,
  copyAs: vi.fn(),
  createFolder: vi.fn(),
  createGoogleDoc: vi.fn(),
  deleteFile: vi.fn(),
  findByAppProperty: vi.fn(async () => []),
  listChildren: vi.fn(async () => []),
  listFiles: vi.fn(async () => []),
}));
vi.mock("@/lib/ai-gateway", () => ({ ask: m.ask }));
vi.mock("@/lib/notices.server", () => ({ deliverJobNotice: m.deliverJobNotice }));

import { runBackgroundJob } from "@/lib/inngest/job-runner.server";
import { BINDING_WRITE_DENIED } from "@/lib/knowledge-rules";

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const JOB = "job-1";
const ROOT = "folder-root-1";
const FILE = "file-guia-1";

type Write = { table: string; op: string; payload: Record<string, unknown> };
/** The admin client as the runner sees it: one drive_import job, the company, the launcher's current role and the folder row. */
function fakeAdmin(role: string, section = "rules") {
  const writes: Write[] = [];
  const job = {
    id: JOB,
    org_id: ORG,
    user_id: ME,
    kind: "drive_import",
    status: "queued",
    cancel_requested: false,
    input: { file: FILE, section },
  };
  const from = (table: string) => {
    let op = "select";
    const res = (one: boolean) => {
      if (table === "background_jobs")
        return { data: op === "select" ? job : { cancel_requested: false }, error: null };
      if (table === "organizations")
        return {
          data: { name: "Empresa Ficticia", company_name: null, currency: "EUR" },
          error: null,
        };
      if (table === "org_members") return { data: [{ role }], error: null };
      if (table === "drive_folders")
        return {
          data: { folder_id: ROOT, name: "Empresa Ficticia", created_by_app: true },
          error: null,
        };
      if (table === "knowledge_docs" && op === "insert")
        return { data: { id: "doc-1", title: "Guía de prueba" }, error: null };
      return { data: one ? null : [], error: null };
    };
    const q: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (f: (v: unknown) => unknown) => Promise.resolve(res(false)).then(f);
          return (...a: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "delete") {
              op = prop;
              writes.push({ table, op, payload: a[0] as Record<string, unknown> });
            }
            if (prop === "single" || prop === "maybeSingle") return Promise.resolve(res(true));
            return q;
          };
        },
      },
    );
    return q;
  };
  return { db: { from } as unknown as Parameters<typeof runBackgroundJob>[0], writes };
}

const driveCalls = () =>
  m.getFile.mock.calls.length +
  m.exportText.mock.calls.length +
  m.downloadText.mock.calls.length +
  m.downloadBytes.mock.calls.length +
  m.ask.mock.calls.length;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  m.getFile.mockImplementation(async (id: string) =>
    id === ROOT
      ? { id: ROOT, name: "Empresa Ficticia", mimeType: "application/vnd.google-apps.folder" }
      : { id: FILE, name: "Guía de prueba.txt", mimeType: "text/plain", parents: [ROOT] },
  );
  m.downloadText.mockResolvedValue("Texto ficticio de la guía.");
});

// SDD-20261109-rules-write-permissions (NK-0095) U-3 · CA-10 (b): the runner checks the launcher's roles as they are when it runs.
describe("drive_import to Reglas with the launcher's current roles (NK-0095, CA-10 b)", () => {
  it("an ae: the job fails with BINDING_WRITE_DENIED, no Drive call, nothing in knowledge_docs", async () => {
    const { db, writes } = fakeAdmin("ae");
    await expect(runBackgroundJob(db, JOB)).rejects.toThrow(BINDING_WRITE_DENIED);
    expect(driveCalls()).toBe(0);
    expect(writes.filter((w) => w.table === "knowledge_docs")).toEqual([]);
    const failed = writes.find(
      (w) => w.table === "background_jobs" && w.payload.status === "failed",
    );
    expect(failed?.payload.error).toBe(BINDING_WRITE_DENIED);
  });

  it("a sales_leader: reads the file and inserts the rule, and the job ends done", async () => {
    const { db, writes } = fakeAdmin("sales_leader");
    await expect(runBackgroundJob(db, JOB)).resolves.toEqual({ ok: true });
    expect(m.downloadText).toHaveBeenCalledWith(FILE);
    const ins = writes.filter((w) => w.table === "knowledge_docs");
    expect(ins).toHaveLength(1);
    expect(ins[0]!.payload).toMatchObject({ org_id: ORG, section: "rules", scope: "team" });
    expect(writes.some((w) => w.table === "background_jobs" && w.payload.status === "done")).toBe(
      true,
    );
  });

  it("an ae still imports into another section", async () => {
    const { db, writes } = fakeAdmin("ae", "company");
    await expect(runBackgroundJob(db, JOB)).resolves.toEqual({ ok: true });
    expect(writes.filter((w) => w.table === "knowledge_docs")).toHaveLength(1);
  });
});
