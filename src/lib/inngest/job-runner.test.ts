// @vitest-environment node
// SDD-20261109-rules-in-ai-readers (NK-0096), U-4 (CA-5, CA-7 job, CA-6). The background jobs that run the rules-aware cores say
// a failed read of the rules in their notice (result.body, copied to notifications by the DB trigger); with a correct read
// the result is today's. A failed job is logged with safeErrorLog, never the error's text. runBackgroundJob with a fake
// client that records the background_jobs updates; the cores are simulated. Fictional data.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RULES_READ_FAILED } from "@/lib/knowledge-rules";

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
