import { describe, expect, it, vi } from "vitest";
import { replyModelPorts, REPLY_MODEL } from "./classification-provider.server";

const response = () =>
  new Response(
    JSON.stringify({
      model: "anthropic/claude-opus-5.5",
      provider: "Anthropic",
      usage: { prompt_tokens: 10, completion_tokens: 5, is_byok: false, cost: 0.001 },
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              category: "other",
              confidence: 0.5,
              returnDate: null,
              referredName: null,
              referredEmail: null,
            }),
          },
        },
      ],
    }),
    { status: 200 },
  );
describe("NK-0174 fixed Opus route", () => {
  it("uses exactly Opus 5.5, Anthropic, no fallback, data collection denied and zero retention", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response());
    const ports = replyModelPorts(
      async () => {},
      { OPENROUTER_API_KEY: "synthetic-test-key" },
      fetcher,
    );
    const result = await ports.classify('{"untrusted_reply":"synthetic message"}');
    expect(REPLY_MODEL).toBe("anthropic/claude-opus-5.5");
    const init = fetcher.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("anthropic/claude-opus-5.5");
    expect(body.models).toBeUndefined();
    expect(body.provider).toEqual({
      order: ["anthropic"],
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    });
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.usage?.costUsd).toBe(0.001);
  });
  it("does not retry or fall back if no privacy-compatible provider is available", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response("Provider unavailable", { status: 404 }),
    );
    const ports = replyModelPorts(
      async () => {},
      { OPENROUTER_API_KEY: "synthetic-test-key" },
      fetcher,
    );
    await expect(ports.classify("synthetic")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
