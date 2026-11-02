import { describe, expect, it } from "vitest";
import { costUsd } from "./anthropic-http";
import {
  referenceBody,
  referenceRequest,
  referenceResult,
  REFERENCE_MODEL,
} from "./reference-request";

// NK-0048 CA-18: literal copy of gtm-lab@44f385b supabase/functions/_shared/anthropic.ts:5 (MODEL), :31-40
// (request) and :42-50 (output rule). Do not edit: it is the reference the HTTP request is compared to.
const MODEL = "claude-sonnet-5-5";
type Request = { system: string; user: string; schema: Record<string, unknown> };
type Response = { stop_reason: string | null; content: { type: string; text: string }[] };
// prettier-ignore
function originalSdkParams(request: Request) {
  return {
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: request.schema } },
      // Stable instructions first and cached; the project context goes in the user turn.
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: request.user }],
    };
}
// prettier-ignore
function originalOutput(response: Response) {
    let output: unknown = null;
    const text = response.content.find((block) => block.type === "text");
    if (response.stop_reason === "end_turn" && text?.type === "text") {
      try {
        output = JSON.parse(text.text);
      } catch {
        output = null;
      }
    }
  return output;
}

/** What @anthropic-ai/sdk 1.3.0 sends for client.beta.messages.create: betas leave the body for a header. */
function sdkToHttp(
  params: Record<string, unknown>,
  env: { ANTHROPIC_API_KEY: string; ANTHROPIC_WORKSPACE_ID?: string },
) {
  const { betas, ...body } = params as { betas: string[] } & Record<string, unknown>;
  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2026-10-21",
      "content-type": "application/json",
      ...(env.ANTHROPIC_WORKSPACE_ID
        ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID }
        : {}),
      "anthropic-beta": betas.join(","),
    },
    body,
  };
}

const CALL = {
  system: "Instrucciones ficticias",
  user: "# Paso: ficticio",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["a"],
    properties: { a: { type: "string" } },
  },
};

describe("reference request (NK-0048 CA-18)", () => {
  it("equals the SDK call of anthropic.ts, translated to HTTP", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-test-fake" };
    expect(referenceRequest(CALL, env)).toEqual(sdkToHttp(originalSdkParams(CALL), env));
  });

  it("keeps anthropic-workspace-id when set", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-test-fake", ANTHROPIC_WORKSPACE_ID: "wrkspc_fake" };
    expect(referenceRequest(CALL, env)).toEqual(sdkToHttp(originalSdkParams(CALL), env));
  });

  it("keeps fallbacks and output_config in the body, and betas out of it", () => {
    const body = referenceBody(CALL);
    expect(body.fallbacks).toBe("default");
    expect(body).not.toHaveProperty("betas");
    expect(REFERENCE_MODEL).toBe(MODEL);
  });

  it("is null without a key", () => {
    expect(referenceRequest(CALL, {})).toBeNull();
  });
});

describe("reference output rule (anthropic.ts:42-50)", () => {
  const message = (stop: string | null, text: string) => ({
    model: "claude-sonnet-5-5-20261101",
    stop_reason: stop,
    content: [
      { type: "thinking", text: "" },
      { type: "text", text },
    ],
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900 },
  });

  it.each([
    ["end_turn", '{"a":"x"}'],
    ["end_turn", "no json"],
    ["max_tokens", '{"a":"x"}'],
    ["refusal", ""],
    [null, '{"a":"x"}'],
  ])("stop %s with %s gives the same output as the original", (stop, text) => {
    expect(referenceResult(message(stop, text)).output).toEqual(
      originalOutput(message(stop, text)),
    );
  });

  it("reports the model that answered and the tokens as anthropic.ts does", () => {
    expect(referenceResult(message("end_turn", "{}"))).toMatchObject({
      model: "claude-sonnet-5-5-20261101",
      usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 900 },
    });
  });
});

describe("PRICES cost (eval-suggest.mjs costUsd)", () => {
  it("matches dated model ids by prefix and adds cache reads and writes", () => {
    const usage = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    };
    expect(costUsd("claude-sonnet-5-5-20261101", usage)).toBeCloseTo(2 + 10 + 0.2 + 2.5);
    expect(costUsd("claude-opus-5-5", usage)).toBeCloseTo(4 + 20 + 0.2 + 5);
  });

  it("a model without price has no cost («sin dato»), never a guess", () => {
    expect(costUsd("claude-haiku-5-5", { input_tokens: 1, output_tokens: 1 })).toBeNull();
  });
});
