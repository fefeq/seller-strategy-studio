// @vitest-environment node
// NK-0131 (scan of src/routes/api/**): the two other routes that logged an error. The Telegram webhook logged the
// whole error and the lead intake logged a 300-character slice of its message. A witness in the thrown error must not
// reach any console.* argument; the log keeps its label; the response, the stored error text and the per-lead result
// (CA-3) stay as they were. Fictional witness, no customer data.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS = "SECRET-ROUTE-ERROR-123";
const h = vi.hoisted(() => ({
  db: null as unknown,
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  updates: [] as { table: string; row: Record<string, unknown> }[],
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return h.db;
  },
}));
vi.mock("@/lib/telegram.server", () => ({
  telegramConfigured: () => true,
  webhookSecret: async () => "secret-x",
  sendText: async () => undefined,
  tg: async () => undefined,
}));
vi.mock("@/lib/channel-ctx.server", () => ({
  channelCtx: async () => {
    throw new Error(`context said ${WITNESS}`);
  },
}));
vi.mock("@/lib/leads-ingest", async (orig) => ({
  ...(await orig<typeof import("@/lib/leads-ingest")>()),
  hashLeadKey: async () => "hash-x",
  ingestLead: async () => {
    throw new Error(`ingest said ${WITNESS}`);
  },
}));
vi.mock("@/lib/intake.server", () => ({ enforceLimits: async () => null, quarantine: vi.fn() }));
vi.mock("@/lib/inngest/send.server", () => ({ trySend: async () => undefined }));

import { Route as TelegramRoute } from "./telegram/webhook";
import { Route as LeadsRoute } from "./leads";

const SOURCE = {
  id: "src-1",
  org_id: "org-1",
  active: true,
  default_stage: "new",
  kind: "leads",
  mode: "direct",
};

function fakeDb(): unknown {
  const resolve = (table: string, op: string): unknown => {
    if (table === "lead_sources" && op === "maybeSingle") return { data: SOURCE, error: null };
    if (table === "channel_links" && op === "maybeSingle")
      return { data: { user_id: "u1" }, error: null };
    return { data: op === "await" ? [] : null, error: null };
  };
  const chain = (table: string, op: string | null, row: Record<string, unknown> | null): object =>
    new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === "then")
            return (f: (v: unknown) => unknown, g?: (e: unknown) => unknown) =>
              new Promise((ok) => ok(resolve(table, "await"))).then(f, g);
          if (prop === "maybeSingle") return () => Promise.resolve(resolve(table, prop));
          if (prop === "insert" || prop === "update")
            return (r: Record<string, unknown>) => {
              (prop === "insert" ? h.inserts : h.updates).push({ table, row: r });
              return chain(table, prop, r);
            };
          return () => chain(table, op, row);
        },
      },
    );
  return { from: (t: string) => chain(t, null, null) };
}

const logs: unknown[][] = [];
beforeEach(() => {
  logs.length = 0;
  h.inserts.length = 0;
  h.updates.length = 0;
  h.db = fakeDb();
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
});
afterEach(() => vi.restoreAllMocks());

const serialized = (xs: unknown[]) =>
  xs
    .map((x) => {
      let json = "";
      try {
        json = JSON.stringify(x) ?? "";
      } catch {
        json = "";
      }
      return `${inspect(x, { depth: null, showHidden: true })}\n${json}`;
    })
    .join("\n");

function expectSafeLog(keeps: string[]) {
  const out = serialized(logs.flat());
  expect(logs.length).toBeGreaterThan(0);
  for (const k of keeps) expect(out).toContain(k);
  expect(out).not.toContain(WITNESS);
}

type Handler = (a: { request: Request }) => Promise<Response>;
const post = (route: unknown): Handler =>
  (route as { options: { server: { handlers: { POST: Handler } } } }).options.server.handlers.POST;

describe("route logs carry no whole error or message slice (NK-0131)", () => {
  it("telegram webhook: the handler fails", async () => {
    const res = await post(TelegramRoute)({
      request: new Request("http://localhost/api/public/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret-x" },
        body: JSON.stringify({
          update_id: 1,
          callback_query: { id: "cb", data: "a:1:c", message: { chat: { id: 5 } } },
        }),
      }),
    });
    // CA-3: the answer is the same and the failure is still recorded for the update (that text is not a log).
    expect(await res.json()).toEqual({ ok: true });
    expect(h.updates.find((u) => "error" in u.row && u.row["error"] !== null)?.row["error"]).toBe(
      `context said ${WITNESS}`,
    );
    expectSafeLog(["telegram handle failed"]);
  });

  it("lead intake: ingest fails", async () => {
    const res = await post(LeadsRoute)({
      request: new Request("http://localhost/api/public/leads", {
        method: "POST",
        headers: { "X-Lead-Key": `gtm_${"a".repeat(24)}`, "content-type": "application/json" },
        body: JSON.stringify({ company: "Empresa ficticia" }),
      }),
    });
    const body = (await res.json()) as { results?: { status: string; error?: string }[] };
    expect(JSON.stringify(body)).toContain("No se pudo guardar el lead");
    expect(JSON.stringify(body)).not.toContain(WITNESS);
    // CA-3: the stored event keeps its error text.
    expect(
      h.inserts.some(
        (i) => i.table === "lead_events" && i.row["error"] === `ingest said ${WITNESS}`,
      ),
    ).toBe(true);
    expectSafeLog(["lead ingest failed"]);
  });
});
