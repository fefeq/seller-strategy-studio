import { describe, expect, it } from "vitest";
import { aiProviders, openrouterModels, openrouterRouting, shouldFallBack } from "./gemini";
import { ProviderError, withFallback } from "./ai-gateway";

describe("AI provider chain", () => {
  it("with OpenRouter: OpenRouter first, then Gemini, and never the Lovable AI", () => {
    expect(aiProviders({ GEMINI_API_KEY: "g", OPENROUTER_API_KEY: "o" })).toEqual([
      "openrouter",
      "gemini",
    ]);
    expect(aiProviders({ OPENROUTER_API_KEY: "o" })).toEqual(["openrouter"]);
    expect(aiProviders({ OPENROUTER_API_KEY: "o", AI_LOVABLE_FALLBACK: "on" })).toEqual([
      "openrouter",
      "lovable",
    ]);
  });
  it("without OpenRouter: Gemini with the Lovable AI as safety net (unless switched off)", () => {
    expect(aiProviders({ GEMINI_API_KEY: "g" })).toEqual(["gemini", "lovable"]);
    expect(aiProviders({ GEMINI_API_KEY: "g", AI_LOVABLE_FALLBACK: "off" })).toEqual(["gemini"]);
    expect(aiProviders({})).toEqual(["lovable"]);
    expect(aiProviders({ AI_LOVABLE_FALLBACK: "off" })).toEqual(["lovable"]);
    expect(aiProviders({ GEMINI_API_KEY: "g", AI_PROVIDER: "lovable" })).toEqual(["lovable"]);
  });
  it("OpenRouter tries Gemini, Claude and GPT in that order by default; OPENROUTER_MODEL overrides", () => {
    expect(openrouterModels({})).toEqual([
      "google/gemini-3.8-flash",
      "anthropic/claude-sonnet-5.5",
      "openai/gpt-6.1-sol",
    ]);
    expect(openrouterRouting({}).models).toHaveLength(3);
    expect(openrouterModels({ OPENROUTER_MODEL: "anthropic/claude-sonnet-5.5" })).toEqual([
      "anthropic/claude-sonnet-5.5",
    ]);
    expect(
      openrouterRouting({ OPENROUTER_MODEL: "anthropic/claude-sonnet-5.5" }).models,
    ).toBeUndefined();
    expect(openrouterModels({ OPENROUTER_MODEL: "a, b, c, d" })).toEqual(["a", "b", "c"]);
  });
  it("falls back when quota runs out, not on a bad request", () => {
    expect(shouldFallBack(429)).toBe(true);
    expect(shouldFallBack(503)).toBe(true);
    expect(shouldFallBack(400)).toBe(false);
    expect(shouldFallBack(400, "API key not valid")).toBe(true);
  });
  it("uses the next provider when Gemini has no quota", async () => {
    const tried: string[] = [];
    const out = await withFallback(["gemini", "openrouter", "lovable"], async (p) => {
      tried.push(p);
      if (p === "gemini") throw new ProviderError("sin cuota", 429);
      return p;
    });
    expect(out).toBe("openrouter");
    expect(tried).toEqual(["gemini", "openrouter"]);
  });
  it("never retries past a Lovable AI error", async () => {
    await expect(
      withFallback(["gemini", "lovable"], async (p) => {
        if (p === "gemini") throw new ProviderError("sin cuota", 429);
        throw new Error("Sin créditos");
      }),
    ).rejects.toThrow("Sin créditos");
  });
});
