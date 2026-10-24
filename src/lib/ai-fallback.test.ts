import { describe, expect, it } from "vitest";
import { aiProviders, shouldFallBack } from "./gemini";
import { ProviderError, withFallback } from "./ai-gateway";

describe("AI provider chain", () => {
  it("tries Gemini first and the Lovable AI as the last resort", () => {
    expect(aiProviders({ GEMINI_API_KEY: "g" })).toEqual(["gemini", "lovable"]);
    expect(aiProviders({ GEMINI_API_KEY: "g", OPENROUTER_API_KEY: "o" })).toEqual(["gemini", "openrouter", "lovable"]);
    expect(aiProviders({})).toEqual(["lovable"]);
  });
  it("can run on own keys only", () => {
    expect(aiProviders({ GEMINI_API_KEY: "g", OPENROUTER_API_KEY: "o", AI_LOVABLE_FALLBACK: "off" })).toEqual(["gemini", "openrouter"]);
    expect(aiProviders({ AI_LOVABLE_FALLBACK: "off" })).toEqual(["lovable"]);
    expect(aiProviders({ GEMINI_API_KEY: "g", AI_PROVIDER: "lovable" })).toEqual(["lovable"]);
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
    await expect(withFallback(["gemini", "lovable"], async (p) => {
      if (p === "gemini") throw new ProviderError("sin cuota", 429);
      throw new Error("Sin créditos");
    })).rejects.toThrow("Sin créditos");
  });
});
