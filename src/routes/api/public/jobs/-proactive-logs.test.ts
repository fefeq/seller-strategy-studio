// @vitest-environment node
// NK-0131 CA-1 + CA-3 (same pattern as NK-0104 / NK-0118 / NK-0121): every console call of the proactive job that used
// to carry the whole error is driven with a witness text that sits in the thrown error. The witness must not reach any
// console.* argument; the log must still exist with its label; and what the job returns (CA-3) must be what it was.
// Fictional witness, no customer data.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS = "SECRET-JOB-ERROR-123";
const boom = () => Promise.reject(new Error(`provider said ${WITNESS}`));
const h = vi.hoisted(() => ({
  ready: false,
  sendEvents: null as null | (() => Promise<unknown>),
  weekly: null as null | (() => Promise<unknown>),
  daily: null as null | (() => Promise<unknown>),
  snapshot: null as null | (() => Promise<unknown>),
  leadsToEnrich: null as null | (() => Promise<string[]>),
  enrichLead: null as null | (() => Promise<unknown>),
  autopilot: null as null | (() => Promise<unknown>),
  discover: null as null | (() => Promise<unknown>),
  stripe: null as null | (() => Promise<unknown>),
  signals: null as null | (() => Promise<unknown>),
  posthog: null as null | (() => Promise<unknown>),
  sendText: null as null | (() => Promise<unknown>),
  links: [] as { user_id: string; chat_id: string }[],
  db: null as unknown,
}));

vi.mock("@/integrations/supabase/cron-auth", () => ({ authenticateCronRequest: async () => null }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return h.db;
  },
}));
vi.mock("@/lib/notices.server", () => ({
  flushHeldNotices: async () => 0,
  notifyAutopilot: async () => undefined,
}));
vi.mock("@/lib/inngest/send.server", () => ({
  trySend: async () => undefined,
  inngestReady: async () => h.ready,
  sendEvents: () => (h.sendEvents ? h.sendEvents() : Promise.resolve()),
}));
vi.mock("@/lib/weekly-report.server", () => ({
  runWeeklyReports: () => (h.weekly ? h.weekly() : Promise.resolve({ created: 0 })),
}));
vi.mock("@/lib/daily-email.server", () => ({
  runDailyEmails: () => (h.daily ? h.daily() : Promise.resolve({ sent: 0, failed: 0 })),
}));
vi.mock("@/lib/org-data", () => ({
  loadSnapshot: () => (h.snapshot ? h.snapshot() : Promise.resolve({})),
  syncSuggestions: async () => undefined,
}));
vi.mock("@/lib/proactive", () => ({ detect: () => [], digest: (x: unknown[]) => x }));
vi.mock("@/lib/inngest/tasks.server", () => ({
  leadsToEnrich: () => (h.leadsToEnrich ? h.leadsToEnrich() : Promise.resolve([] as string[])),
  enrichLead: () => (h.enrichLead ? h.enrichLead() : Promise.resolve()),
}));
vi.mock("@/lib/autopilot.server", () => ({
  autopilotForOrg: () => (h.autopilot ? h.autopilot() : Promise.resolve({})),
}));
vi.mock("@/lib/discoveries.server", () => ({
  discoverForOrg: () => (h.discover ? h.discover() : Promise.resolve({ skipped: true })),
}));
vi.mock("@/lib/stripe/sync.server", () => ({
  runStripeSyncs: () => (h.stripe ? h.stripe() : Promise.resolve({ synced: 0 })),
}));
vi.mock("@/lib/web-research-core", () => ({
  runSignalRefresh: () => (h.signals ? h.signals() : Promise.resolve({ refreshed: 0 })),
}));
vi.mock("@/lib/posthog-sync.server", () => ({
  runPosthogSyncs: () => (h.posthog ? h.posthog() : Promise.resolve({ synced: 0 })),
}));
vi.mock("@/lib/telegram.server", () => ({
  telegramConfigured: () => true,
  sendText: () => (h.sendText ? h.sendText() : Promise.resolve(undefined)),
}));
vi.mock("@/lib/telegram-roles", () => ({
  loadMemberRoles: async () => new Map<string, string[]>(),
  rolesOf: () => [] as string[],
  applyPriceVisibility: <Q>(q: Q) => q,
}));

import { Route } from "./proactive";

const SUGGESTION = {
  id: "s-1",
  title: "Titulo ficticio",
  body: "Cuerpo ficticio",
  action: null,
  strategy: null,
  priority: 1,
  created_at: "2026-11-09T08:00:00Z",
};

/** A client where every chain resolves through the table and the final operation (await / maybeSingle). */
function fakeDb(): unknown {
  const resolve = (table: string, op: string): unknown => {
    if (table === "job_locks") return { data: [{ name: "lock" }], error: null };
    if (table === "organizations") return { data: [{ id: "org-1" }], error: null };
    if (table === "channel_links") return { data: h.links, error: null };
    if (table === "profiles" && op === "maybeSingle")
      return { data: { current_org_id: "org-1", full_name: "Nombre Ficticio" }, error: null };
    if (table === "suggestions") return { data: [SUGGESTION], error: null };
    return { data: op === "await" ? [] : null, error: null };
  };
  const chain = (table: string): object =>
    new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === "then")
            return (f: (v: unknown) => unknown, g?: (e: unknown) => unknown) =>
              new Promise((ok) => ok(resolve(table, "await"))).then(f, g);
          if (prop === "maybeSingle") return () => Promise.resolve(resolve(table, prop));
          return () => chain(table);
        },
      },
    );
  return { from: (t: string) => chain(t) };
}

const logs: unknown[][] = [];
beforeEach(() => {
  logs.length = 0;
  h.ready = false;
  h.links = [];
  for (const k of [
    "sendEvents",
    "weekly",
    "daily",
    "snapshot",
    "leadsToEnrich",
    "enrichLead",
    "autopilot",
    "discover",
    "stripe",
    "signals",
    "posthog",
    "sendText",
  ] as const)
    h[k] = null;
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
  h.db = fakeDb();
});
afterEach(() => {
  vi.restoreAllMocks();
});

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

/** The log exists, still carries the labels the operator greps for, and never the witness. */
function expectSafeLog(keeps: string[]) {
  const out = serialized(logs.flat());
  expect(logs.length).toBeGreaterThan(0);
  for (const k of keeps) expect(out).toContain(k);
  expect(out).not.toContain(WITNESS);
}

type Post = (a: { request: Request }) => Promise<Response>;
async function run(kind?: string) {
  const post = (Route.options as unknown as { server: { handlers: { POST: Post } } }).server
    .handlers.POST;
  const res = await post({
    request: new Request("http://localhost/api/public/jobs/proactive", {
      method: "POST",
      body: JSON.stringify(kind ? { kind } : {}),
    }),
  });
  return (await res.json()) as Record<string, unknown>;
}

describe("proactive job logs no whole error (NK-0131 CA-1, CA-3)", () => {
  it("inngest dispatch failed: falls back to the inline run", async () => {
    h.ready = true;
    h.sendEvents = boom;
    const r = await run();
    expect(r).toMatchObject({ mode: "inline", orgs: 1 });
    expectSafeLog(["inngest dispatch failed"]);
  });
  it("weekly reports failed (background mode)", async () => {
    h.ready = true;
    h.weekly = boom;
    const r = await run();
    expect(r).toMatchObject({ mode: "background", weekly: null });
    expectSafeLog(["weekly reports failed"]);
  });
  it("proactive org failed", async () => {
    h.snapshot = boom;
    const r = await run();
    expect(r).toMatchObject({ mode: "inline", detected: 0 });
    expectSafeLog(["proactive org failed", "org-1"]);
  });
  it("lead flow failed", async () => {
    h.leadsToEnrich = async () => ["lead-1"];
    h.enrichLead = boom;
    const r = await run();
    expect(r).toMatchObject({ mode: "inline", leadFlows: 0 });
    expectSafeLog(["lead flow failed", "lead-1"]);
  });
  it("autopilot failed", async () => {
    h.autopilot = boom;
    expect(await run()).toMatchObject({ mode: "inline" });
    expectSafeLog(["autopilot failed", "org-1"]);
  });
  it("discoveries failed", async () => {
    h.discover = boom;
    expect(await run()).toMatchObject({ mode: "inline" });
    expectSafeLog(["discoveries failed", "org-1"]);
  });
  it("weekly reports failed (inline mode)", async () => {
    h.weekly = boom;
    expect(await run()).toMatchObject({ mode: "inline", weekly: null });
    expectSafeLog(["weekly reports failed"]);
  });
  it("stripe syncs failed", async () => {
    h.stripe = boom;
    expect(await run()).toMatchObject({ mode: "inline", stripe: null });
    expectSafeLog(["stripe syncs failed"]);
  });
  it("signal refresh failed", async () => {
    h.signals = boom;
    expect(await run()).toMatchObject({ mode: "inline", signals: null });
    expectSafeLog(["signal refresh failed"]);
  });
  it("posthog syncs failed", async () => {
    h.posthog = boom;
    expect(await run()).toMatchObject({ mode: "inline", posthog: null });
    expectSafeLog(["posthog syncs failed"]);
  });
  it("daily emails failed", async () => {
    h.daily = boom;
    expect(await run()).toMatchObject({ mode: "inline", daily: null });
    expectSafeLog(["daily emails failed"]);
  });
  it("notify failed (urgent Telegram push)", async () => {
    h.links = [{ user_id: "u1", chat_id: "chat-1" }];
    h.sendText = boom;
    expect(await run()).toMatchObject({ mode: "inline" });
    expectSafeLog(["notify failed"]);
  });
  it("digest failed", async () => {
    h.links = [{ user_id: "u1", chat_id: "chat-1" }];
    h.sendText = boom;
    expect(await run("digest")).toEqual({ sent: 0 });
    expectSafeLog(["digest failed"]);
  });
});
