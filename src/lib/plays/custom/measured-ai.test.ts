// @vitest-environment node
import { describe, expect, it } from "vitest";
import { selectSignals } from "./measured-ai.server";

describe("NK-0171 CA-4 measured selection", () => {
  it("keeps BYOK upstream cost, tokens and configured model without fallback", async () => {
    let request: Record<string, unknown> = {};
    const fetcher: typeof fetch = async (_url, init) => {
      request = JSON.parse(String(init?.body));
      return Response.json({ model: "google/test", choices: [{ finish_reason: "stop", message: { content: '{"selected":[0]}' } }], usage: { is_byok: true, cost: 9, cost_details: { upstream_inference_cost: 0.12 }, prompt_tokens: 17, completion_tokens: 4 } });
    };
    const r = await selectSignals("Evento", [{ title: "Aviso", url: "https://example.com/1", snippet: "Aviso público", date: "2026-11-13", source: "web", provider: "firecrawl" }], { OPENROUTER_API_KEY: "synthetic", OPENROUTER_MODEL: "google/test,anthropic/test" }, fetcher);
    expect(r.selected).toEqual([0]);
    expect(r.cost).toEqual({ provider: "google/test", amount: 0.12, cost_kind: "ai_measured", currency: "USD", input_tokens: 17, output_tokens: 4 });
    expect(request.model).toBe("google/test");
    expect(request).not.toHaveProperty("models");
    expect(request.provider).toMatchObject({ allow_fallbacks: false });
  });
  it("missing measured usage is not invented as a real zero", async () => {
    const r = await selectSignals("Evento", [], { OPENROUTER_API_KEY: "synthetic" }, async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"selected":[]}' } }] }));
    expect(r.cost.cost_kind).toBe("ai_sin_dato");
    expect(r.cost.input_tokens).toBeNull();
  });
  it("denial is terminal and made once", async () => {
    let calls = 0;
    await expect(selectSignals("Evento", [], { OPENROUTER_API_KEY: "synthetic" }, async () => { calls++; return Response.json({}, { status: 403 }); })).rejects.toMatchObject({ status: 403 });
    expect(calls).toBe(1);
  });
  it("empty text or refusal never counts as a successful selection", async () => {
    await expect(selectSignals("Evento", [], { OPENROUTER_API_KEY: "synthetic" }, async () => Response.json({ choices: [{ finish_reason: "content_filter", message: { content: "" } }] }))).rejects.toMatchObject({ refusal: true });
  });
});