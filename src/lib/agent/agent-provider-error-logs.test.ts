// @vitest-environment node
// SDD-20261106-agent-rules-reader (NK-0076), CA-4 and §10: the server log never carries the text of a rule. When the AI
// provider fails, the SDK's APICallError carries the whole request (requestBodyValues.messages = system prompt with the
// team's rules); runAgent must log only safe fields of it. Fictional rule, fake client.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { ToolCtx } from "@/lib/agent/tools";

const RULE_TEXT = "REGLA-FICTICIA-7f3a nunca regalamos la implantación sin aprobación.";

const h = vi.hoisted(() => ({
  fail: "none" as "none" | "api" | "retry" | "reject-plain" | "reject-custom",
  status: 500,
  // NK-0087: @ai-sdk/openai copies the provider's error.message from the response body into APICallError.message.
  ruleInMessage: false,
}));

vi.mock("ai", async (orig) => {
  const real = await orig<typeof import("ai")>();
  return {
    ...real,
    streamText: (o: {
      system: string;
      messages: unknown;
      onError?: (e: { error: unknown }) => void;
    }) => {
      if (h.fail === "none") return { text: Promise.resolve("Respuesta del modelo.") };
      // What @ai-sdk/openai throws on an HTTP error: the request body (system + messages) travels in the error.
      const api = new real.APICallError({
        message: h.ruleInMessage
          ? `Content rejected in messages[0]: ${o.system.slice(o.system.indexOf("REGLA-FICTICIA"))}`
          : "Internal Server Error",
        url: "https://provider.invalid/v1/chat/completions",
        requestBodyValues: {
          model: "m",
          messages: [{ role: "system", content: o.system }, o.messages],
        },
        statusCode: h.status,
        responseBody: JSON.stringify({ error: "boom", echo: o.system }),
        isRetryable: false,
        cause: new Error("socket", { cause: { prompt: o.system } }),
      });
      // NK-0087: a failing fetch rejects with a plain or custom-named error whose message quotes the request.
      const quote = o.system.slice(o.system.indexOf("REGLA-FICTICIA"));
      const err =
        h.fail === "reject-plain"
          ? new Error(`socket hang up while sending: ${quote}`)
          : h.fail === "reject-custom"
            ? Object.assign(new Error(`upstream refused prompt: ${quote}`), {
                name: "ProviderRefusal",
                body: quote,
              })
            : h.fail === "retry"
              ? new real.RetryError({
                  message: "Failed after 3 attempts",
                  reason: "maxRetriesExceeded",
                  errors: [api],
                })
              : api;
      o.onError?.({ error: err });
      const text = Promise.reject(err);
      text.catch(() => undefined);
      return { text };
    },
    tool: (t: unknown) => t,
    jsonSchema: () => ({}),
    stepCountIs: () => undefined,
  };
});
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({ chat: () => ({}), responses: () => ({}) }),
}));
vi.mock("@/lib/gemini", async (orig) => ({
  ...(await orig<typeof import("@/lib/gemini")>()),
  aiProviders: () => ["openrouter", "lovable"],
}));
vi.mock("@/lib/memory.server", () => ({
  memoryBlock: async () => "",
  learnFrom: async () => undefined,
  rememberDecision: async () => undefined,
}));
vi.mock("@/lib/after-response.server", () => ({ afterResponse: () => undefined }));

import { runAgent } from "@/lib/agent/agent.server";

/** Every logged argument, serialized at full depth both ways. */
function serialized(calls: unknown[][]): string {
  return calls
    .flat()
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
}

function fakeDb(): ToolCtx["db"] {
  const from = (table: string) => {
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            const data =
              table === "knowledge_docs"
                ? [
                    {
                      org_id: "org-1",
                      title: "Implantación",
                      body: RULE_TEXT,
                      section: "rules",
                      scope: "team",
                      mandatory: true,
                    },
                  ]
                : null;
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({ data, error: null, count: null }).then(ok);
          }
          return () => proxy;
        },
      },
    );
    return proxy;
  };
  return { from } as unknown as ToolCtx["db"];
}

const turn = () =>
  runAgent(
    {
      db: fakeDb(),
      orgId: "org-1",
      userId: "11111111-1111-4111-8111-111111111111",
      roles: ["ae"],
      currency: "EUR",
    },
    {
      conversationId: "conv-1",
      text: "¿Qué propongo?",
      channel: "telegram",
      mode: "chat",
      orgName: "Empresa Ficticia",
    },
  );

let errorSpy: MockInstance<typeof console.error>;
let warnSpy: MockInstance<typeof console.warn>;
beforeEach(() => {
  vi.restoreAllMocks();
  h.fail = "none";
  h.status = 500;
  h.ruleInMessage = false;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("provider failure: no rule text in any log argument (CA-4, §10)", () => {
  it.each(["api", "retry"] as const)("%s error, with fallback and final failure", async (kind) => {
    vi.stubEnv("LOVABLE_API_KEY", "test-not-a-key");
    h.fail = kind;
    await expect(turn()).rejects.toThrow();
    const calls = [...errorSpy.mock.calls, ...warnSpy.mock.calls];
    // The failure is still logged (stream error, fallback warning, final error)...
    expect(errorSpy.mock.calls.map((c) => c[0])).toContain("Agent stream error");
    expect(errorSpy.mock.calls.map((c) => c[0])).toContain("Agent error");
    expect(warnSpy).toHaveBeenCalled();
    const out = serialized(calls);
    expect(out).toContain("500");
    // ...but never the request body.
    expect(out).not.toContain("REGLA-FICTICIA-7f3a");
  });
});

describe("provider puts the rule in its error message (NK-0087, CA-4, §10)", () => {
  it.each([
    ["api", 400],
    ["api", 500],
    ["retry", 400],
    ["retry", 500],
  ] as const)("%s error, status %i", async (kind, status) => {
    vi.stubEnv("LOVABLE_API_KEY", "test-not-a-key");
    h.fail = kind;
    h.status = status;
    h.ruleInMessage = true;
    await expect(turn()).rejects.toThrow();
    const calls = [...errorSpy.mock.calls, ...warnSpy.mock.calls];
    expect(errorSpy.mock.calls.map((c) => c[0])).toContain("Agent stream error");
    expect(errorSpy.mock.calls.map((c) => c[0])).toContain("Agent error");
    const out = serialized(calls);
    expect(out).toContain(String(status));
    expect(out).not.toContain("REGLA-FICTICIA-7f3a");
  });
});

describe("fetch rejects with an error whose message quotes the rule (NK-0087, CA-4, §10)", () => {
  it.each(["reject-plain", "reject-custom"] as const)("%s", async (kind) => {
    vi.stubEnv("LOVABLE_API_KEY", "test-not-a-key");
    h.fail = kind;
    await expect(turn()).rejects.toThrow();
    const calls = [...errorSpy.mock.calls, ...warnSpy.mock.calls];
    expect(errorSpy.mock.calls.map((c) => c[0])).toContain("Agent stream error");
    expect(errorSpy.mock.calls.map((c) => c[0])).toContain("Agent error");
    expect(serialized(calls)).not.toContain("REGLA-FICTICIA-7f3a");
  });
});
