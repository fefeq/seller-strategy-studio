import { describe, expect, it } from "vitest";
import { aiProvider, buildGenerateRequest, dataUrlToPart, extractText, geminiAgentModel, geminiErrorMessage, geminiModel, jevAnswerSchema, jevPrompt, normalizeJevAnswers, sanitizeSchema, SKIP_SIGNATURE, withThoughtSignatures, fixGeminiSseLine } from "./gemini";

describe("provider", () => {
  it("uses Gemini only when a key exists and not forced off", () => {
    expect(aiProvider({})).toBe("lovable");
    expect(aiProvider({ GEMINI_API_KEY: "  " })).toBe("lovable");
    expect(aiProvider({ GEMINI_API_KEY: "k" })).toBe("gemini");
    expect(aiProvider({ GEMINI_API_KEY: "k", AI_PROVIDER: "Lovable" })).toBe("lovable");
  });
  it("models fall back in order", () => {
    expect(geminiModel({})).toBe("gemini-3.8-flash");
    expect(geminiAgentModel({ GEMINI_MODEL: "a" })).toBe("a");
    expect(geminiAgentModel({ GEMINI_MODEL: "a", GEMINI_AGENT_MODEL: "b" })).toBe("b");
  });
});

describe("sanitizeSchema", () => {
  it("drops unsupported keywords but keeps property names", () => {
    const out = sanitizeSchema({ $schema: "x", type: "object", properties: { format: { type: "string", format: "uuid", pattern: "^a" }, n: { type: "number", minimum: 0, default: 1 } }, required: ["format"], additionalProperties: false });
    expect(out).toEqual({ type: "object", properties: { format: { type: "string" }, n: { type: "number", minimum: 0 } }, required: ["format"], additionalProperties: false });
  });
  it("turns nullable type arrays into anyOf and const into enum", () => {
    expect(sanitizeSchema({ type: ["string", "null"] })).toEqual({ anyOf: [{ type: "string" }, { type: "null" }] });
    expect(sanitizeSchema({ type: ["string"] })).toEqual({ type: "string" });
    expect(sanitizeSchema({ const: "a" })).toEqual({ enum: ["a"] });
  });
  it("recurses into items, anyOf and does not mutate the input", () => {
    const input = { type: "array", items: { type: "string", maxLength: 3 }, anyOf: [{ type: "string", pattern: "x" }] };
    const copy = JSON.stringify(input);
    expect(sanitizeSchema(input)).toEqual({ type: "array", items: { type: "string" }, anyOf: [{ type: "string" }] });
    expect(JSON.stringify(input)).toBe(copy);
  });
});

describe("generate request", () => {
  it("builds system, user, files and schema", () => {
    const r = buildGenerateRequest("sys", "hola", { effort: "medium", schema: { name: "s", schema: { type: "object", properties: { a: { type: "string", format: "email" } } } }, files: [{ filename: "a.pdf", dataUrl: "data:application/pdf;base64,QUJD" }] });
    expect(r.systemInstruction.parts[0]).toEqual({ text: "sys" });
    expect(r.contents[0]!.parts).toEqual([{ text: "hola" }, { inlineData: { mimeType: "application/pdf", data: "QUJD" } }]);
    expect(r.generationConfig).toMatchObject({ thinkingConfig: { thinkingLevel: "medium" }, responseMimeType: "application/json", responseJsonSchema: { type: "object", properties: { a: { type: "string" } } } });
  });
  it("omits schema config for free text and rejects non-data URLs", () => {
    expect(buildGenerateRequest("s", "u").generationConfig).toEqual({ thinkingConfig: { thinkingLevel: "low" } });
    expect(dataUrlToPart("https://x/y.pdf")).toBeNull();
    expect(() => buildGenerateRequest("s", "u", { files: [{ filename: "a.pdf", dataUrl: "nope" }] })).toThrow(/a\.pdf/);
  });
});

describe("extractText and errors", () => {
  it("joins visible parts and skips thoughts", () => {
    expect(extractText({ candidates: [{ content: { parts: [{ text: "pensando", thought: true }, { text: "Hola " }, { text: "mundo" }] } }] })).toBe("Hola mundo");
  });
  it("explains blocked and empty answers", () => {
    expect(() => extractText({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(/filtros de seguridad/);
    expect(() => extractText({ candidates: [{ content: { parts: [] } }] })).toThrow("La IA no respondió");
  });
  it("maps HTTP errors to Spanish actions", () => {
    expect(geminiErrorMessage(429, JSON.stringify({ error: { message: "You exceeded your current quota" } }))).toMatch(/cuota/);
    expect(geminiErrorMessage(429)).toMatch(/Demasiadas/);
    expect(geminiErrorMessage(400, JSON.stringify({ error: { message: "API key not valid" } }))).toMatch(/GEMINI_API_KEY/);
    expect(geminiErrorMessage(403)).toMatch(/GEMINI_API_KEY/);
    expect(geminiErrorMessage(404)).toMatch(/GEMINI_MODEL/);
    expect(geminiErrorMessage(503)).toMatch(/no respondió/);
  });
});

const Q = {
  intent: { type: "score", instructions: "¿Intención?", criteria: ["nula", "media", "alta"] },
  not_buyer: { type: "noul", instructions: "¿No comprador?", criteria: { true: "spam", false: "empresa" } },
  segment: { type: "choice", instructions: "¿Segmento?", criteria: { segmento_1: "pyme", ninguno: "ninguno" } },
};

describe("Jev replacement", () => {
  it("builds a schema with one entry per question", () => {
    const s = jevAnswerSchema(Q) as unknown as { properties: { answers: { required: string[]; properties: Record<string, { properties: Record<string, unknown> }> } } };
    expect(s.properties.answers.required).toEqual(["intent", "not_buyer", "segment"]);
    expect(s.properties.answers.properties.intent.properties.score).toMatchObject({ type: "integer", minimum: 0, maximum: 2 });
    expect(s.properties.answers.properties.segment.properties.choice.enum).toEqual(["segmento_1", "ninguno"]);
  });
  it("spells every criterion in the prompt", () => {
    const p = jevPrompt({ state: { lead: { empresa: "Acme" } }, questions: Q });
    expect(p).toContain("Acme");
    expect(p).toContain("- 2: alta");
    expect(p).toContain("- Sí (1): spam");
    expect(p).toContain("- segmento_1: pyme");
  });
  it("accepts complete answers and rejects missing or out-of-range ones", () => {
    const ok = JSON.stringify({ answers: { intent: { score: 2, confidence: 0.8 }, not_buyer: { noul: 0.1, confidence: 0.9 }, segment: { choice: "ninguno", confidence: 0.4 } } });
    expect(normalizeJevAnswers(ok, Q).answers.intent).toEqual({ score: 2, confidence: 0.8 });
    expect(() => normalizeJevAnswers(JSON.stringify({ answers: { intent: { score: 5 }, not_buyer: { noul: 0 }, segment: { choice: "ninguno" } } }), Q)).toThrow(/intent/);
    expect(() => normalizeJevAnswers(JSON.stringify({ answers: { intent: { score: 1 }, not_buyer: { noul: 0 }, segment: { choice: "otro" } } }), Q)).toThrow(/segment/);
    expect(() => normalizeJevAnswers("no json", Q)).toThrow(/no válida/);
  });
});

describe("withThoughtSignatures", () => {
  it("adds the skip signature to assistant tool calls only when missing", () => {
    const body = JSON.stringify({ messages: [{ role: "user", content: "x" }, { role: "assistant", tool_calls: [{ id: "1" }, { id: "2", extra_content: { google: { thought_signature: "real" } } }] }] });
    const out = JSON.parse(withThoughtSignatures(body));
    expect(out.messages[1].tool_calls[0].extra_content.google.thought_signature).toBe(SKIP_SIGNATURE);
    expect(out.messages[1].tool_calls[1].extra_content.google.thought_signature).toBe("real");
  });
  it("leaves non-chat or invalid bodies alone", () => {
    expect(withThoughtSignatures("not json")).toBe("not json");
    expect(withThoughtSignatures('{"a":1}')).toBe('{"a":1}');
  });
});

describe("fixGeminiSseLine", () => {
  it("numbers streamed tool calls and marks the finish as tool_calls, as the AI SDK requires", () => {
    const line = 'data: ' + JSON.stringify({ choices: [{ index: 0, finish_reason: "stop", delta: { tool_calls: [{ id: "a", function: { name: "list_deals", arguments: "{}" } }, { id: "b", function: { name: "search", arguments: "{}" } }] } }] });
    const out = JSON.parse(fixGeminiSseLine(line).slice(5));
    expect(out.choices[0].delta.tool_calls.map((t: { index: number }) => t.index)).toEqual([0, 1]);
    expect(out.choices[0].finish_reason).toBe("tool_calls");
  });
  it("leaves text chunks, [DONE] and calls that already have an index unchanged", () => {
    const text = 'data: {"choices":[{"index":0,"finish_reason":"stop","delta":{"content":"hola"}}]}';
    expect(fixGeminiSseLine(text)).toBe(text);
    expect(fixGeminiSseLine("data: [DONE]")).toBe("data: [DONE]");
    const indexed = 'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":3,"id":"a"}]}}]}';
    expect(fixGeminiSseLine(indexed)).toBe(indexed);
  });
});
