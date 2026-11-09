// SDD-20261109-rules-write-permissions (NK-0095) U-4 · CA-10 (a): launching a drive_import into Reglas is refused for anyone
// but the Owner or a Sales Leader, before the job exists. enqueue (start and retry) calls authorize first; this test goes
// through enqueue and checks that neither the person's client nor the admin client touched background_jobs.
// Server function plumbing, the admin client and Inngest are mocked; fictional data only.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ adminFrom: vi.fn() }));
vi.mock("@tanstack/react-start", () => {
  const chain: object = new Proxy(() => chain, { get: () => () => chain, apply: () => chain });
  return { createServerFn: () => chain };
});
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => ({ url: "http://localhost/" }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: m.adminFrom },
}));
vi.mock("@/lib/inngest/send.server", () => ({
  inngestReady: async () => false,
  sendEvents: vi.fn(),
}));
vi.mock("@/lib/inngest/tasks.server", () => ({ runBackgroundJob: vi.fn(async () => undefined) }));

import type { ToolCtx } from "@/lib/agent/tools";
import { authorize, enqueue } from "@/lib/background.functions";
import { BINDING_WRITE_DENIED } from "@/lib/knowledge-rules";

type Call = { table: string; op: string };
function fakeDb() {
  const calls: Call[] = [];
  const from = (table: string) => {
    const c: Call = { table, op: "select" };
    calls.push(c);
    const q: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (f: (v: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(f);
          return () => {
            if (prop === "insert" || prop === "update" || prop === "delete") c.op = prop;
            if (prop === "single" || prop === "maybeSingle")
              return Promise.resolve({ data: { id: "job-1" }, error: null });
            return q;
          };
        },
      },
    );
    return q;
  };
  return { db: { from } as unknown as ToolCtx["db"], calls };
}
const ctx = (roles: string[], db = fakeDb().db) => ({
  db,
  orgId: "org-1",
  userId: "11111111-1111-4111-8111-111111111111",
  roles,
  currency: "EUR",
  orgName: "Empresa Ficticia",
});
const job = (section: "rules" | "company") => ({
  kind: "drive_import" as const,
  input: { file: "file-guia-1", section },
});

beforeEach(() => {
  m.adminFrom.mockReset();
  m.adminFrom.mockImplementation(() => fakeDb().db.from("background_jobs"));
});

describe("launching drive_import into Reglas (NK-0095, CA-10 a)", () => {
  it.each([[["ae"]], [["sdr"]], [["enablement"]]])(
    "roles %j: refused with BINDING_WRITE_DENIED and no background job is created",
    async (roles) => {
      const { db, calls } = fakeDb();
      await expect(enqueue(ctx(roles, db), job("rules"))).rejects.toThrow(BINDING_WRITE_DENIED);
      expect(calls.filter((c) => c.table === "background_jobs")).toEqual([]);
      expect(m.adminFrom).not.toHaveBeenCalled();
    },
  );

  it.each([[["owner"]], [["sales_leader"]]])(
    "roles %j: authorize lets it through",
    async (roles) => {
      await expect(authorize(ctx(roles), job("rules"))).resolves.toBeUndefined();
    },
  );

  it("an ae may still launch an import into another section", async () => {
    await expect(authorize(ctx(["ae"]), job("company"))).resolves.toBeUndefined();
  });

  it("an owner's launch into Reglas goes on to create the job", async () => {
    const { db, calls } = fakeDb();
    await expect(enqueue(ctx(["owner"], db), job("rules"))).resolves.toMatchObject({
      jobId: "job-1",
    });
    expect(calls.some((c) => c.table === "background_jobs" && c.op === "insert")).toBe(true);
  });
});
