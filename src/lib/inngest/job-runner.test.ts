// @vitest-environment node
// SDD-20261109-rules-in-ai-readers (NK-0096), U-4 (CA-5, CA-7 job, CA-6). The background jobs that run the rules-aware cores say
// a failed read of the rules in their notice (result.body, copied to notifications by the DB trigger); with a correct read
// the result is today's. A failed job is logged with safeErrorLog, never the error's text. runBackgroundJob with a fake
// client that records the background_jobs updates; the cores are simulated. Fictional data.
// SDD-20261109-rules-write-permissions (NK-0095), U-3 (CA-10 b): the drive_import case, in its own describe at the end, with
// Google Drive and the AI gateway mocked (no other case here reads Drive). Both tickets share the notices.server mock.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BINDING_WRITE_DENIED, RULES_READ_FAILED } from "@/lib/knowledge-rules";

const h = vi.hoisted(() => ({
  research: { text: "Investigación.", name: "Ana Prueba", rulesRead: true } as Record<
    string,
    unknown
  >,
  researchThrows: null as Error | null,
  library: {} as Record<string, unknown>,
}));

vi.mock("@/lib/ai-core", () => ({
  researchStakeholderCore: async () => {
    if (h.researchThrows) throw h.researchThrows;
    return h.research;
  },
}));
vi.mock("@/lib/playbooks/library-core", () => ({ createLibraryCore: async () => h.library }));
vi.mock("@/lib/notices.server", () => ({ deliverJobNotice: async () => undefined }));

const m = vi.hoisted(() => ({
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

import { runBackgroundJob } from "@/lib/inngest/job-runner.server";

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const JOB = "77777777-7777-4777-8777-777777777777";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const PERSON = "66666666-6666-4666-8666-666666666666";
const MARK = "MARCA-REGLA-JR3";

type Q = { table: string; op: string; payload?: unknown; filters: unknown[][] };

function fakeDb(job: Record<string, unknown>) {
  const log: Q[] = [];
  const reply = (q: Q): unknown => {
    if (q.table === "background_jobs") return q.op === "select" ? job : { cancel_requested: false };
    if (q.table === "stakeholders") return { account_id: ACCOUNT };
    if (q.table === "org_members") return [{ role: "owner" }];
    if (q.table === "organizations")
      return { name: "Empresa Ficticia", company_name: null, currency: "EUR" };
    return null;
  };
  const from = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            log.push(q);
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({ data: reply(q), error: null, count: null }).then(ok);
          }
          return (...args: unknown[]) => {
            if (["insert", "update", "upsert", "delete"].includes(prop)) {
              q.op = prop;
              q.payload = args[0];
            } else if (prop !== "select") q.filters.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  // runBackgroundJob takes the typed admin client; the fake answers the same chain.
  return { db: { from } as unknown as Parameters<typeof runBackgroundJob>[0], log };
}

const jobOf = (kind: string, input: Record<string, unknown>) => ({
  id: JOB,
  kind,
  org_id: ORG,
  user_id: ME,
  status: "queued",
  cancel_requested: false,
  input,
});
const doneResult = (log: Q[]) =>
  (
    log.find(
      (q) =>
        q.table === "background_jobs" &&
        q.op === "update" &&
        (q.payload as { status?: string }).status === "done",
    )?.payload as { result: Record<string, unknown> } | undefined
  )?.result;

let logs: string[] = [];
beforeEach(() => {
  h.research = { text: "Investigación.", name: "Ana Prueba", rulesRead: true };
  h.researchThrows = null;
  h.library = {};
  logs = [];
  for (const m of ["error", "warn", "log", "info"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      logs.push(
        a
          .map((x) =>
            x instanceof Error
              ? `${x.name} ${x.message}`
              : typeof x === "string"
                ? x
                : JSON.stringify(x),
          )
          .join(" "),
      );
    });
});

describe("stakeholder_research says a failed read of the rules in its notice (CA-5)", () => {
  it("rules read: the result is today's", async () => {
    const { db, log } = fakeDb(jobOf("stakeholder_research", { stakeholderId: PERSON }));
    await runBackgroundJob(db, JOB);
    expect(doneResult(log)).toEqual({
      title: "Research de Ana Prueba listo",
      link: `/accounts/${ACCOUNT}?tab=stakeholders`,
    });
  });

  it("rules not read: result.body carries the warning", async () => {
    h.research = { ...h.research, rulesRead: false };
    const { db, log } = fakeDb(jobOf("stakeholder_research", { stakeholderId: PERSON }));
    await runBackgroundJob(db, JOB);
    const r = doneResult(log)!;
    expect(r.title).toBe("Research de Ana Prueba listo");
    expect(String(r.body)).toContain(RULES_READ_FAILED);
  });
});

describe("playbook_library adds the warning to its body (CA-7, job)", () => {
  const created = [
    { title: "Discovery: qué preguntar y en qué orden", adapted: true },
    { title: "Demo", adapted: false },
  ];

  it("rules read: the result is today's", async () => {
    h.library = { created, skipped: false, hasContext: true };
    const { db, log } = fakeDb(jobOf("playbook_library", {}));
    await runBackgroundJob(db, JOB);
    expect(doneResult(log)).toEqual({
      title: "2 jugadas añadidas al hub",
      body: "1 adaptados a tu empresa.",
      link: "/hub",
      created,
      skipped: false,
      hasContext: true,
    });
  });

  it("rules not read: today's body plus the warning", async () => {
    h.library = { created, skipped: false, hasContext: true, mensaje: RULES_READ_FAILED };
    const { db, log } = fakeDb(jobOf("playbook_library", {}));
    await runBackgroundJob(db, JOB);
    const body = String(doneResult(log)!.body);
    expect(body).toContain("1 adaptados a tu empresa.");
    expect(body).toContain(RULES_READ_FAILED);
  });
});

describe("a failed job is logged without the error's text (CA-6)", () => {
  it("the log names the kind and never the message", async () => {
    h.researchThrows = new Error(`Proveedor caído: Nunca ofrecemos descuentos. ${MARK}`);
    const { db } = fakeDb(jobOf("stakeholder_research", { stakeholderId: PERSON }));
    await expect(runBackgroundJob(db, JOB)).rejects.toThrow();
    const all = logs.join("\n");
    expect(all).toContain("background job failed stakeholder_research");
    expect(all).not.toContain(MARK);
  });
});

// ---- NK-0095 ----
const DRIVE_JOB = "job-1";
const ROOT = "folder-root-1";
const FILE = "file-guia-1";

type Write = { table: string; op: string; payload: Record<string, unknown> };
/** The admin client as the runner sees it: one drive_import job, the company, the launcher's current role and the folder row. */
function fakeAdmin(role: string, section = "rules") {
  const writes: Write[] = [];
  const job = {
    id: DRIVE_JOB,
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

// SDD-20261109-rules-write-permissions (NK-0095) U-3 · CA-10 (b): the runner checks the launcher's roles as they are when it runs.
describe("drive_import to Reglas with the launcher's current roles (NK-0095, CA-10 b)", () => {
  beforeEach(() => {
    for (const f of [m.getFile, m.exportText, m.downloadText, m.downloadBytes, m.ask])
      f.mockReset();
    m.getFile.mockImplementation(async (id: string) =>
      id === ROOT
        ? { id: ROOT, name: "Empresa Ficticia", mimeType: "application/vnd.google-apps.folder" }
        : { id: FILE, name: "Guía de prueba.txt", mimeType: "text/plain", parents: [ROOT] },
    );
    m.downloadText.mockResolvedValue("Texto ficticio de la guía.");
  });

  it("an ae: the job fails with BINDING_WRITE_DENIED, no Drive call, nothing in knowledge_docs", async () => {
    const { db, writes } = fakeAdmin("ae");
    await expect(runBackgroundJob(db, DRIVE_JOB)).rejects.toThrow(BINDING_WRITE_DENIED);
    expect(driveCalls()).toBe(0);
    expect(writes.filter((w) => w.table === "knowledge_docs")).toEqual([]);
    const failed = writes.find(
      (w) => w.table === "background_jobs" && w.payload.status === "failed",
    );
    expect(failed?.payload.error).toBe(BINDING_WRITE_DENIED);
  });

  it("a sales_leader: reads the file and inserts the rule, and the job ends done", async () => {
    const { db, writes } = fakeAdmin("sales_leader");
    await expect(runBackgroundJob(db, DRIVE_JOB)).resolves.toEqual({ ok: true });
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
    await expect(runBackgroundJob(db, DRIVE_JOB)).resolves.toEqual({ ok: true });
    expect(writes.filter((w) => w.table === "knowledge_docs")).toHaveLength(1);
  });
});
