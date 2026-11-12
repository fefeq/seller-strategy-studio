// @vitest-environment node
// NK-0149 (same pattern as NK-0118/0142): the console calls in src/lib that used to log error.message or
// (e as Error).message are driven with a witness text inside the error. The witness must not reach any console.*
// argument, the log must still exist, and what the function returns does not change. Fictional witness.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS = "SECRET-ERROR-MESSAGE-456";
const h = vi.hoisted(() => ({ witness: "SECRET-ERROR-MESSAGE-456" }));

vi.mock("@/lib/firecrawl", () => ({ search: () => Promise.reject(new Error(h.witness)) }));
vi.mock("@/lib/perplexity", () => ({
  perplexitySearch: () => Promise.reject(new Error(h.witness)),
}));
vi.mock("@/lib/parallel-gateway", () => ({
  parallelSearch: () => Promise.reject(new Error(h.witness)),
}));

import { searchBoth } from "@/lib/web-search";
import { trySend } from "@/lib/inngest/send.server";
import { loadAgentRules } from "@/lib/knowledge-rules";
import { logUsage } from "@/lib/orchestrator/runner";
import { notifyAutopilot } from "@/lib/notices.server";
import { saveFacts } from "@/lib/memory.server";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import type { Db } from "@/lib/org-data";

const logs: unknown[][] = [];
beforeEach(() => {
  logs.length = 0;
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const serialized = () =>
  logs
    .flat()
    .map((x) => `${inspect(x, { depth: null, showHidden: true })}\n${safeJson(x)}`)
    .join("\n");
function safeJson(x: unknown) {
  try {
    return JSON.stringify(x) ?? "";
  } catch {
    return "";
  }
}
function expectSafeLog(label: string) {
  const out = serialized();
  expect(logs.length).toBeGreaterThan(0);
  expect(out).toContain(label);
  expect(out).not.toContain(WITNESS);
}

/** Every query resolves to `result`, whatever the chain. */
const dbReturning = (result: unknown): Db => {
  const chain = (): object =>
    new Proxy(
      {},
      {
        get: (_t, prop: string) =>
          prop === "then"
            ? (f: (v: unknown) => unknown) => Promise.resolve(result).then(f)
            : prop === "single" || prop === "maybeSingle"
              ? () => Promise.resolve(result)
              : () => chain(),
      },
    );
  return { from: () => chain() } as unknown as Db;
};

// Supabase errors reach the logs both as an Error and as a plain { message } object.
const dbErrors: [string, unknown][] = [
  ["Error instance", new Error(WITNESS)],
  ["plain object", { message: WITNESS, code: "X1" }],
];

describe("src/lib logs never carry the error message (NK-0149 CA-1)", () => {
  it("web-search: three providers fail, the search throws the first error as before", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test-not-a-key");
    vi.stubEnv("PARALLEL_API_KEY", "test-not-a-key");
    await expect(searchBoth({ query: "x" }, { queries: ["x"] })).rejects.toThrow(WITNESS);
    // all three failed: nothing is logged and the first error is thrown (unchanged)
    expect(logs).toEqual([]);
  });
  it("web-search: two providers fail and one answers", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test-not-a-key");
    vi.stubEnv("PARALLEL_API_KEY", "test-not-a-key");
    // firecrawl skipped (null) so it resolves; perplexity and parallel reject.
    expect(await searchBoth(null, { queries: ["x"] })).toEqual([]);
    expectSafeLog("Perplexity search failed");
    expect(serialized()).toContain("Parallel search failed");
  });
  it("inngest/send.server: trySend returns false and logs no message", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-not-a-key");
    vi.stubEnv("INNGEST_API_KEY", "test-not-a-key");
    vi.stubEnv("INNGEST_SIGNING_KEY", "test-not-a-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(WITNESS);
      }),
    );
    expect(await trySend([{ name: "nokko/ping", data: { at: "x" } } as never])).toBe(false);
    expectSafeLog("inngest trySend");
  });

  describe.each(dbErrors)("database error as %s", (_n, err) => {
    it("knowledge-rules: load failure stays ok false", async () => {
      const r = await loadAgentRules({
        db: dbReturning({ data: null, error: err }),
        orgId: "org-1",
      });
      expect(r).toEqual({ ok: false, rules: [] });
      expectSafeLog("knowledge rules load failed");
    });
    it("orchestrator/runner: usage insert failure", async () => {
      const ctx = { db: dbReturning({ data: null, error: err }), orgId: "org-1", userId: "u1" };
      await logUsage(
        ctx as unknown as ToolCtx,
        "complete_account" as never,
        [{ service: "apollo", cost: 1 } as never],
        "manual" as never,
      );
      expectSafeLog("integration_usage insert failed");
    });
    it("notices.server: notifyAutopilot insert failure returns 0", async () => {
      const db = dbReturning({ data: [{ user_id: "u1" }], error: err });
      expect(
        await notifyAutopilot(db as never, "org-1", { researched: 1, prepped: 0, cooling: 0 }),
      ).toBe(0);
      expectSafeLog("notifyAutopilot");
    });
    it("memory.server: insert failure does not throw", async () => {
      const ctx = { db: dbReturning({ data: null, error: err }), orgId: "org-1", userId: "u1" };
      const r = await saveFacts(
        ctx as unknown as ToolCtx,
        [{ scope: "company", kind: "fact", content: "dato ficticio" } as never],
        "test",
        [],
      );
      expect(r).toEqual({ added: 1, replaced: 0 });
      expectSafeLog("memory insert failed");
    });
  });
});
