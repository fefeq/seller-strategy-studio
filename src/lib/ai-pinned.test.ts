import { describe, expect, it, vi } from "vitest";
import { askPinned, openrouterPinnedBody, parsePinnedResponse } from "./ai-pinned";
import { ProviderError } from "./ai-gateway";

const MODEL = "anthropic/claude-sonnet-5.5";
const SCHEMA = {
  name: "suggestion",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["a"],
    properties: { a: { type: "string" } },
  },
};
const ENV = { OPENROUTER_API_KEY: "sk-or-test-fake" };

type Choice = { finish_reason?: string; native_finish_reason?: string; content?: string };
function completion(
  choice: Choice,
  usage: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    model: MODEL,
    provider: "Anthropic",
    choices: [
      {
        finish_reason: choice.finish_reason,
        native_finish_reason: choice.native_finish_reason,
        message: { content: choice.content ?? '{"a":"x"}' },
      },
    ],
    usage: { prompt_tokens: 1200, completion_tokens: 300, ...usage },
    ...extra,
  });
}

function fakeFetch(status: number, body: string) {
  return vi.fn(async () => new Response(body, { status }));
}

describe("openrouterPinnedBody (NK-0048 CA-7)", () => {
  const body = openrouterPinnedBody(MODEL, "SYS", "USER", { schema: SCHEMA });

  it("pins one model, with no models fallback list", () => {
    expect(body.model).toBe(MODEL);
    expect(body).not.toHaveProperty("models");
  });

  it("has a single provider object: Anthropic only, no fallbacks, parameters required", () => {
    expect(body.provider).toEqual({
      order: ["anthropic"],
      allow_fallbacks: false,
      require_parameters: true,
    });
  });

  it("defaults to low reasoning effort and 16000 max tokens, and reports usage", () => {
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.max_tokens).toBe(16000);
    expect(body.usage).toEqual({ include: true });
  });

  it("caches the system prompt and sends the user turn as is", () => {
    expect(body.messages).toEqual([
      {
        role: "system",
        content: [{ type: "text", text: "SYS", cache_control: { type: "ephemeral" } }],
      },
      { role: "user", content: "USER" },
    ]);
  });

  it("asks for strict JSON schema output when there is a schema", () => {
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "suggestion", strict: true, schema: SCHEMA.schema },
    });
  });

  it("has no response_format without a schema, and honours effort and max tokens", () => {
    const plain = openrouterPinnedBody(MODEL, "S", "U", { effort: "high", maxTokens: 500 });
    expect(plain).not.toHaveProperty("response_format");
    expect(plain.reasoning).toEqual({ effort: "high" });
    expect(plain.max_tokens).toBe(500);
  });

  it("has exactly these keys, so nothing else (like models) slips in", () => {
    expect(Object.keys(body).sort()).toEqual(
      [
        "max_tokens",
        "messages",
        "model",
        "provider",
        "reasoning",
        "response_format",
        "usage",
      ].sort(),
    );
  });
});

describe("parsePinnedResponse (NK-0048 CA-8)", () => {
  it("uses native_finish_reason when present and parses output only on end_turn with a schema", () => {
    const r = parsePinnedResponse(
      completion({ finish_reason: "stop", native_finish_reason: "end_turn" }),
      true,
    );
    expect(r.stopReason).toBe("end_turn");
    expect(r.output).toEqual({ a: "x" });
    expect(r.text).toBe('{"a":"x"}');
    expect(r.model).toBe(MODEL);
    expect(r.provider).toBe("Anthropic");
  });

  it.each([
    ["stop", "end_turn"],
    ["length", "max_tokens"],
    ["content_filter", "refusal"],
    ["tool_calls", "tool_calls"],
  ])("maps finish_reason %s to %s when there is no native reason", (finish, expected) => {
    expect(parsePinnedResponse(completion({ finish_reason: finish }), true).stopReason).toBe(
      expected,
    );
  });

  it("keeps native Anthropic reasons as they are", () => {
    const r = parsePinnedResponse(
      completion({ finish_reason: "stop", native_finish_reason: "refusal" }),
      true,
    );
    expect(r.stopReason).toBe("refusal");
    expect(r.output).toBeNull();
  });

  it("output is null when cut, without schema, or when the text is not JSON", () => {
    expect(
      parsePinnedResponse(completion({ native_finish_reason: "max_tokens" }), true).output,
    ).toBeNull();
    expect(
      parsePinnedResponse(completion({ native_finish_reason: "end_turn" }), false).output,
    ).toBeNull();
    expect(
      parsePinnedResponse(
        completion({ native_finish_reason: "end_turn", content: "no json" }),
        true,
      ).output,
    ).toBeNull();
  });

  it("splits cached tokens out of prompt_tokens, like Anthropic input_tokens", () => {
    const r = parsePinnedResponse(
      completion(
        { native_finish_reason: "end_turn" },
        { prompt_tokens_details: { cached_tokens: 1000 } },
      ),
      true,
    );
    expect(r.usage).toMatchObject({ inputTokens: 200, outputTokens: 300, cacheReadTokens: 1000 });
  });

  it("cached tokens are 0 when not reported", () => {
    const r = parsePinnedResponse(completion({ native_finish_reason: "end_turn" }), true);
    expect(r.usage).toMatchObject({ inputTokens: 1200, cacheReadTokens: 0 });
  });

  it("BYOK: cost is the upstream inference cost", () => {
    const r = parsePinnedResponse(
      completion(
        { native_finish_reason: "end_turn" },
        { is_byok: true, cost: 0.0001, cost_details: { upstream_inference_cost: 0.0123 } },
      ),
      true,
    );
    expect(r.usage.byok).toBe(true);
    expect(r.usage.costUsd).toBe(0.0123);
  });

  it("BYOK without upstream cost: null, never usage.cost", () => {
    const r = parsePinnedResponse(
      completion({ native_finish_reason: "end_turn" }, { is_byok: true, cost: 0.0001 }),
      true,
    );
    expect(r.usage.costUsd).toBeNull();
  });

  it("not BYOK: cost is usage.cost, never the upstream cost", () => {
    const r = parsePinnedResponse(
      completion(
        { native_finish_reason: "end_turn" },
        { is_byok: false, cost: 0.02, cost_details: { upstream_inference_cost: 0.5 } },
      ),
      true,
    );
    expect(r.usage.byok).toBe(false);
    expect(r.usage.costUsd).toBe(0.02);
    const missing = parsePinnedResponse(
      completion(
        { native_finish_reason: "end_turn" },
        { is_byok: false, cost_details: { upstream_inference_cost: 0.5 } },
      ),
      true,
    );
    expect(missing.usage.costUsd).toBeNull();
  });

  it("no BYOK mark: byok and cost are null, even if both cost fields come", () => {
    const r = parsePinnedResponse(
      completion(
        { native_finish_reason: "end_turn" },
        { cost: 0.02, cost_details: { upstream_inference_cost: 0.01 } },
      ),
      true,
    );
    expect(r.usage.byok).toBeNull();
    expect(r.usage.costUsd).toBeNull();
  });

  it.each([[-1], ["0.01"], [Number.NaN], [null]])(
    "a cost of %s is null, never estimated",
    (cost) => {
      const r = parsePinnedResponse(
        completion({ native_finish_reason: "end_turn" }, { is_byok: false, cost }),
        true,
      );
      expect(r.usage.costUsd).toBeNull();
    },
  );

  it("a cost of 0 is kept", () => {
    const r = parsePinnedResponse(
      completion({ native_finish_reason: "end_turn" }, { is_byok: false, cost: 0 }),
      true,
    );
    expect(r.usage.costUsd).toBe(0);
  });

  it("HTTP 200 with an error in the body is a provider error, not a model failure", () => {
    const body = JSON.stringify({ error: { code: 429, message: "rate" } });
    expect(() => parsePinnedResponse(body, true)).toThrow(ProviderError);
    expect(() => parsePinnedResponse(body, true)).toThrow(/demasiadas peticiones/);
  });

  it("an invalid body is a provider error", () => {
    expect(() => parsePinnedResponse("<html>", true)).toThrow(/respuesta inválida/);
  });
});

describe("askPinned errors (NK-0048 CA-9)", () => {
  it("without OPENROUTER_API_KEY it fails before any network call", async () => {
    const fetchImpl = fakeFetch(200, completion({ native_finish_reason: "end_turn" }));
    await expect(askPinned(MODEL, "S", "U", { schema: SCHEMA }, {}, fetchImpl)).rejects.toThrow(
      "La IA no está configurada: falta la clave de OpenRouter (OPENROUTER_API_KEY).",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a 404 names the pinned model, not OPENROUTER_MODEL", async () => {
    const call = askPinned(MODEL, "S", "U", {}, ENV, fakeFetch(404, "{}"));
    await expect(call).rejects.toThrow(
      `El modelo fijado (${MODEL}) no está disponible en OpenRouter; revisa que tu clave del proveedor esté añadida en OpenRouter.`,
    );
  });

  it.each([
    [402, /Sin saldo en OpenRouter/],
    [401, /clave de OpenRouter no es válida/],
    [500, /OpenRouter no respondió/],
  ])("HTTP %s uses openrouterErrorMessage", async (status, message) => {
    const call = askPinned(MODEL, "S", "U", {}, ENV, fakeFetch(status, "{}"));
    await expect(call).rejects.toThrow(message);
    await expect(
      askPinned(MODEL, "S", "U", {}, ENV, fakeFetch(status, "{}")),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("a network failure is a provider error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(askPinned(MODEL, "S", "U", {}, ENV, fetchImpl)).rejects.toThrow(
      /OpenRouter no respondió/,
    );
  });

  it("never falls back: one call, to OpenRouter only, with the pinned body", async () => {
    const fetchImpl = fakeFetch(503, "{}");
    await expect(askPinned(MODEL, "S", "U", { schema: SCHEMA }, ENV, fetchImpl)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(String(init.body))).toEqual(
      openrouterPinnedBody(MODEL, "S", "U", { schema: SCHEMA }),
    );
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-test-fake");
  });

  it("returns the parsed result on success", async () => {
    const r = await askPinned(
      MODEL,
      "S",
      "U",
      { schema: SCHEMA },
      ENV,
      fakeFetch(
        200,
        completion(
          { native_finish_reason: "end_turn" },
          { is_byok: true, cost_details: { upstream_inference_cost: 0.01 } },
        ),
      ),
    );
    expect(r).toMatchObject({
      stopReason: "end_turn",
      output: { a: "x" },
      usage: { costUsd: 0.01, byok: true },
    });
  });
});
