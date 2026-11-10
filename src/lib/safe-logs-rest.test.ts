// @vitest-environment node
// NK-0118 + NK-0121 (same pattern as NK-0104, safe-logs.test.ts): every console call that used to carry a provider body,
// a slice of the model output or the whole error is driven with a witness text that sits in that body, output or error
// message. The witness must not reach any console.* argument, the log must still exist and keep the status, and what the
// function returns or throws (CA-3) must be what it was. Fictional witness, no customer data.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS = "SECRET-PROVIDER-BODY-123";
const h = vi.hoisted(() => ({
  sendText: null as null | (() => Promise<unknown>),
  sendEmail: null as null | (() => Promise<unknown>),
  saveFacts: null as null | (() => Promise<unknown>),
  ask: null as null | (() => Promise<string>),
  userDb: null as unknown,
}));

vi.mock("@/lib/telegram.server", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram.server")>()),
  telegramConfigured: () => true,
  sendText: () => (h.sendText ? h.sendText() : Promise.resolve(undefined)),
}));
vi.mock("@/lib/email.server", async (orig) => {
  const real = await orig<typeof import("@/lib/email.server")>();
  return {
    ...real,
    sendEmail: (...a: Parameters<typeof real.sendEmail>) =>
      h.sendEmail ? h.sendEmail() : real.sendEmail(...a),
  };
});
vi.mock("@/lib/memory.server", () => ({
  saveFacts: () => (h.saveFacts ? h.saveFacts() : Promise.resolve()),
}));
vi.mock("@/lib/ai-gateway", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-gateway")>()),
  ask: () => (h.ask ? h.ask() : Promise.reject(new Error("no ask impl"))),
}));
// createServerFn(...).middleware().inputValidator().handler(fn) returns fn itself, so the exported server function is its handler.
vi.mock("@tanstack/react-start", () => {
  const b: Record<string, unknown> = {};
  b["middleware"] = () => b;
  b["inputValidator"] = () => b;
  b["handler"] = (fn: unknown) => fn;
  return { createServerFn: () => b };
});
vi.mock("@/lib/agent.functions", () => ({
  userCtx: async () => ({ orgId: "org-1", userId: "u1", roles: ["owner"], db: h.userDb }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { firecrawlErrorText } from "@/lib/web-research";
import { apolloErrorText } from "@/lib/apollo";
import { perplexityErrorText } from "@/lib/perplexity";
import { apifyErrorText } from "@/lib/apify";
import { clayErrorText } from "@/lib/clay";
import { parallelErrorText } from "@/lib/parallel";
import { driveErrorText } from "@/lib/drive";
import { scrapeMarkdown } from "@/lib/firecrawl";
import { findCompanies } from "@/lib/apollo-gateway";
import { perplexitySearch } from "@/lib/perplexity";
import { runActor } from "@/lib/apify-gateway";
import { clayIndustries } from "@/lib/clay-gateway";
import { createTaskRun } from "@/lib/parallel-gateway";
import { getFile, DriveError } from "@/lib/google-drive";
import { sendEmail } from "@/lib/email.server";
import { PosthogError, connectPosthog, posthogErrorText } from "@/lib/posthog-sync.server";
import { tg } from "@/lib/telegram.server";
import { sendEvents } from "@/lib/inngest/send.server";
import { runWeeklyReports } from "@/lib/weekly-report.server";
import { runDailyEmails } from "@/lib/daily-email.server";
import { deliverJobNotice, flushHeldNotices } from "@/lib/notices.server";
import { afterResponse, requestCtx } from "@/lib/after-response.server";
import { runReview, type ReviewDeps } from "@/lib/strategy-review-core";
import { generateGtmAdvice } from "@/lib/ai.functions";
import { decideDiscovery } from "@/lib/discoveries.functions";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import type { Db } from "@/lib/org-data";

const logs: unknown[][] = [];
beforeEach(() => {
  logs.length = 0;
  h.sendText = h.sendEmail = h.saveFacts = h.ask = null;
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
  vi.stubEnv("LOVABLE_API_KEY", "test-not-a-key");
  for (const k of [
    "FIRECRAWL",
    "APOLLO",
    "PERPLEXITY",
    "APIFY",
    "CLAY",
    "PARALLEL",
    "GOOGLE_DRIVE",
    "RESEND",
    "TELEGRAM",
    "INNGEST",
  ])
    vi.stubEnv(`${k}_API_KEY`, "test-not-a-key");
  vi.stubEnv("INNGEST_SIGNING_KEY", "test-not-a-key");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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

/** The log exists, mentions what the caller still needs, and never carries the witness. */
function expectSafeLog(keeps: string[] = []) {
  const out = serialized(logs.flat());
  expect(logs.length).toBeGreaterThan(0);
  for (const k of keeps) expect(out).toContain(k);
  expect(out).not.toContain(WITNESS);
}

const failWith = (status: number) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(`echo ${WITNESS} echo`, { status })),
  );
const msgOf = async (p: Promise<unknown>) =>
  (
    await p.then(
      () => null,
      (e: Error) => e,
    )
  )?.message;

// ---------- NK-0121: provider gateways outside *.server.ts ----------
describe("gateways log status and length, not the provider body (NK-0121 CA-1)", () => {
  it("firecrawl", async () => {
    failWith(500);
    expect(await msgOf(scrapeMarkdown("https://example.test"))).toBe(
      firecrawlErrorText(500, `echo ${WITNESS} echo`),
    );
    expectSafeLog(["500"]);
  });
  it("apollo-gateway", async () => {
    failWith(500);
    expect(await msgOf(findCompanies({} as ToolCtx, { query: { keywords: ["x"] } }))).toBe(
      apolloErrorText(500, `echo ${WITNESS} echo`),
    );
    expectSafeLog(["500"]);
  });
  it("perplexity", async () => {
    failWith(500);
    expect(await msgOf(perplexitySearch(["x"]))).toBe(
      perplexityErrorText(500, `echo ${WITNESS} echo`),
    );
    expectSafeLog(["500"]);
  });
  it("apify-gateway", async () => {
    failWith(500);
    expect(await msgOf(runActor({ id: "actor-x", maxUsd: 1 }, {}, { maxItems: 1 }))).toBe(
      apifyErrorText(500, `echo ${WITNESS} echo`),
    );
    expectSafeLog(["500"]);
  });
  it("clay-gateway", async () => {
    failWith(500);
    expect(await msgOf(clayIndustries())).toBe(clayErrorText(500, `echo ${WITNESS} echo`));
    expectSafeLog(["500"]);
  });
  it("parallel-gateway", async () => {
    failWith(500);
    expect(await msgOf(createTaskRun("x", "core", {}))).toBe(
      parallelErrorText(500, `echo ${WITNESS} echo`),
    );
    expectSafeLog(["500"]);
  });
  it("google-drive", async () => {
    failWith(500);
    const e = await getFile("file-x").then(
      () => null,
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(DriveError);
    expect((e as DriveError).message).toBe(driveErrorText(500, `echo ${WITNESS} echo`));
    expect((e as DriveError).status).toBe(500);
    expectSafeLog(["500"]);
  });
});

describe("ai.functions logs length, not the model output (NK-0121 CA-1)", () => {
  it("Advisor: invalid JSON quoting the witness", async () => {
    h.ask = async () => `${WITNESS} not json`;
    // Fake client: every query resolves to empty rows; the profile and the role rows exist.
    const chain = (table: string): object =>
      new Proxy(
        {},
        {
          get: (_t, prop: string) => {
            if (prop === "then")
              return (f: (v: unknown) => unknown) =>
                Promise.resolve({ data: [], error: null }).then(f);
            if (prop === "single")
              return () => Promise.resolve({ data: { current_org_id: "org-test" }, error: null });
            if (prop === "maybeSingle")
              return () =>
                Promise.resolve({
                  data:
                    table === "org_members"
                      ? { role: "owner", organizations: { currency: "EUR" } }
                      : null,
                  error: null,
                });
            return () => chain(table);
          },
        },
      );
    const supabase = { from: (t: string) => chain(t) };
    const fn = generateGtmAdvice as unknown as (a: unknown) => Promise<unknown>;
    expect(
      await msgOf(
        fn({
          data: { goal: "Objetivo ficticio suficientemente largo", horizon: "quarter" },
          context: { supabase, userId: "u1" },
        }),
      ),
    ).toBe("La IA no devolvió recomendaciones válidas. Inténtalo de nuevo.");
    expectSafeLog();
  });
});

// ---------- NK-0118: the eleven pending entries ----------
describe("provider bodies in *.server.ts (NK-0118 CA-1)", () => {
  it("email.server: Resend body", async () => {
    failWith(422);
    const r = (await sendEmail({ to: ["a@example.test"], subject: "s", text: "t" })) as {
      sent: boolean;
      status?: number;
      error?: string;
    };
    // CA-3: what is returned does not change (the caller still gets Resend's text), only the log does.
    expect(r).toEqual({ sent: false, status: 422, error: `Resend 422: echo ${WITNESS} echo` });
    expectSafeLog(["422"]);
  });
  it("posthog-sync.server: query body", async () => {
    failWith(500);
    const e = await connectPosthog({} as never, "o", "u", {
      host: "https://ph.example.test",
      projectId: "1",
      key: "phx_test",
    }).then(
      () => null,
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(PosthogError);
    expect((e as PosthogError).message).toBe(posthogErrorText(500, `echo ${WITNESS} echo`));
    expect((e as PosthogError).status).toBe(500);
    expectSafeLog(["500"]);
  });
  it("telegram.server: Telegram body", async () => {
    failWith(400);
    expect(await msgOf(tg("sendMessage", {}))).toBe("Telegram sendMessage failed [400]");
    expectSafeLog(["400"]);
  });
  it("inngest/send.server: Inngest body", async () => {
    failWith(500);
    expect(await msgOf(sendEvents([{ name: "nokko/ping", data: { at: "x" } } as never]))).toBe(
      "No se ha podido encolar la tarea en segundo plano [500].",
    );
    expectSafeLog(["500"]);
  });
});

/**
 * A fake client where every chain resolves through `resolve(table, op)`; the default is empty rows. A resolver that
 * throws makes that query throw as a rejected await or a synchronous call error.
 */
function fakeDb(resolve: (table: string, op: string) => unknown = () => undefined): Db {
  const chain = (table: string, ops: string[]): object =>
    new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          const run = (op: string) => {
            const r = resolve(table, op);
            return r === undefined
              ? { data: op === "await" ? [] : null, count: 0, error: null }
              : r;
          };
          if (prop === "then")
            return (f: (v: unknown) => unknown, g?: (e: unknown) => unknown) =>
              new Promise((ok) => ok(run("await"))).then(f, g);
          if (prop === "single" || prop === "maybeSingle")
            return () => new Promise((ok) => ok(run(prop)));
          return () => chain(table, [...ops, prop]);
        },
      },
    );
  return { from: (t: string) => chain(t, []) } as unknown as Db;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("whole errors in *.server.ts (NK-0118 CA-1)", () => {
  const MONDAY = new Date("2026-11-09T08:00:00Z");
  const weeklyDb = (over: (table: string, op: string) => unknown = () => undefined) =>
    fakeDb((table, op) => {
      const o = over(table, op);
      if (o !== undefined) return o;
      if (table === "organizations")
        return { data: [{ id: "org-1", name: "Org ficticia" }], error: null };
      if (table === "suggestions" && op === "maybeSingle")
        return { data: { id: "sug-1", notified_at: null }, error: null };
      if (table === "suggestions" && op === "single")
        return { data: { title: "Titulo", body: "Cuerpo" }, error: null };
      if (table === "org_members") return { data: [{ user_id: "u1", role: "owner" }], error: null };
      if (table === "channel_links")
        return { data: [{ user_id: "u1", chat_id: "chat-1" }], error: null };
      return undefined;
    });

  it("weekly-report.server: a company whose report fails", async () => {
    const db = weeklyDb((table, op) => {
      if (table === "suggestions" && op === "single") throw new Error(`db said ${WITNESS}`);
      return undefined;
    });
    const r = await runWeeklyReports(db, MONDAY);
    expect(r).toMatchObject({ created: 0, telegram: 0, email: 0 });
    expectSafeLog(["org-1"]);
  });
  it("weekly-report.server: a Telegram send that fails", async () => {
    h.sendText = () => Promise.reject(new Error(`telegram said ${WITNESS}`));
    const r = await runWeeklyReports(weeklyDb(), MONDAY);
    expect(r).toMatchObject({ created: 0, telegram: 0 });
    expectSafeLog();
  });

  const dailyDb = () =>
    fakeDb((table, op) => {
      if (table === "profiles" && op === "await")
        return {
          data: [{ id: "u1", email: "a@example.test", current_org_id: "org-1" }],
          error: null,
        };
      if (table === "org_members") return { data: [{ user_id: "u1", role: "owner" }], error: null };
      if (table === "job_locks") return { error: null };
      return undefined;
    });
  const DAILY_NOW = new Date("2026-11-09T07:00:00Z"); // 08:00 in Europe/Madrid, the default hour

  it("daily-email.server: a send that throws", async () => {
    h.sendEmail = () => Promise.reject(new Error(`resend said ${WITNESS}`));
    expect(await runDailyEmails(dailyDb(), DAILY_NOW)).toEqual({ sent: 0, failed: 1 });
    expectSafeLog();
  });
  it("daily-email.server: a refusal whose error text carries the provider body", async () => {
    h.sendEmail = async () => ({ sent: false, status: 403, error: `Resend 403: ${WITNESS}` });
    expect(await runDailyEmails(dailyDb(), DAILY_NOW)).toEqual({ sent: 0, failed: 1 });
    expectSafeLog(["403"]);
  });

  const noticeDb = () =>
    fakeDb((table, op) => {
      if (table === "notifications" && op === "await")
        return {
          data: [
            {
              id: "n1",
              org_id: "org-1",
              user_id: "u1",
              kind: "x",
              title: "t",
              body: "b",
              link: null,
              job_id: null,
            },
          ],
          error: null,
        };
      if (table === "channel_links") throw new Error(`db said ${WITNESS}`);
      return undefined;
    });
  it("notices.server: deliverJobNotice", async () => {
    expect(await deliverJobNotice(noticeDb(), "job-1")).toBe(0);
    expectSafeLog();
  });
  it("notices.server: flushHeldNotices", async () => {
    expect(await flushHeldNotices(noticeDb())).toBe(0);
    expectSafeLog();
  });

  it("after-response.server: the work fails", async () => {
    afterResponse("label-x", () => Promise.reject(new Error(`work said ${WITNESS}`)));
    await flush();
    expectSafeLog(["label-x"]);
  });
  it("after-response.server: waitUntil throws", async () => {
    requestCtx.run(
      {
        waitUntil: () => {
          throw new Error(`runtime said ${WITNESS}`);
        },
      },
      () => afterResponse("ok", async () => undefined),
    );
    await flush();
    expectSafeLog();
  });
});

// ---------- found by widening the scan to src/lib/** and *.functions.ts ----------
describe("other logs the widened scan found (NK-0121 CA-2)", () => {
  it("strategy-review-core: invalid answer quoting the witness (error message and output slice)", async () => {
    const d: ReviewDeps = {
      sources: [{ table: "deals", id: "d1", label: "Deal", facts: { stage: "lost" } }],
      mode: "normal",
      depth: "low",
      last: null,
      budget: { limit: null, spent: 0 },
      ask: async () => `${WITNESS} not json`,
      names: [],
    };
    const r = await runReview(d);
    expect(r.status).toBe("error");
    expect(r.notice).toBe(
      "La IA no devolvió una revisión válida. Se conserva la anterior; inténtalo de nuevo.",
    );
    expectSafeLog();
  });
  it("strategy-review-core: ask failed quoting the witness", async () => {
    const d: ReviewDeps = {
      sources: [{ table: "deals", id: "d1", label: "Deal", facts: { stage: "lost" } }],
      mode: "normal",
      depth: "low",
      last: null,
      budget: { limit: null, spent: 0 },
      ask: async () => {
        throw new Error(`provider said ${WITNESS}`);
      },
      names: [],
    };
    const r = await runReview(d);
    expect(r.status).toBe("error");
    expectSafeLog();
  });
  it("discoveries.functions: dismissing when saving the memory fails", async () => {
    h.saveFacts = () => Promise.reject(new Error(`memory said ${WITNESS}`));
    h.userDb = fakeDb((table, op) =>
      table === "discoveries" && op === "maybeSingle"
        ? {
            data: {
              id: "d-1",
              kind: "company",
              name: "Empresa ficticia",
              detail: {},
              status: "pending",
            },
            error: null,
          }
        : undefined,
    );
    const fn = decideDiscovery as unknown as (a: unknown) => Promise<unknown>;
    const result = await fn({
      data: { id: "11111111-1111-4111-8111-111111111111", decision: "dismiss" },
      context: { supabase: {}, userId: "u1" },
    });
    expect(result).toEqual({ ok: true, message: "Descartado. Nokko lo recordará." });
    expectSafeLog();
  });
});
