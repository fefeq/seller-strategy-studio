// Direct Google Gemini support (own API key, billed by Google) — pure helpers, no I/O, so they are unit-tested.
// Server code picks the provider with aiProvider(): GEMINI_API_KEY set → Gemini; otherwise the Lovable AI Gateway as before.

export type AiEnv = Record<string, string | undefined>;
export type AiProvider = "gemini" | "lovable";

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_OPENAI_BASE = `${GEMINI_BASE}/openai/`;
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

/** AI_PROVIDER=lovable forces the gateway; otherwise a GEMINI_API_KEY secret switches everything to Gemini. */
export function aiProvider(env: AiEnv): AiProvider {
  const forced = env["AI_PROVIDER"]?.trim().toLowerCase();
  if (forced === "lovable") return "lovable";
  if (env["GEMINI_API_KEY"]?.trim()) return "gemini";
  return "lovable";
}

export const geminiModel = (env: AiEnv) => env["GEMINI_MODEL"]?.trim() || DEFAULT_GEMINI_MODEL;

// ---------- JSON Schema sanitizer ----------

/** Keywords Gemini's structured output / function declarations reject or ignore; dropping them keeps the call valid. */
const DROP = new Set(["$schema", "$id", "format", "pattern", "minLength", "maxLength", "default", "examples", "example", "title", "$comment", "readOnly", "writeOnly", "deprecated", "propertyNames", "patternProperties", "const", "uniqueItems", "multipleOf", "exclusiveMinimum", "exclusiveMaximum"]);

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/**
 * Rewrites a (zod/OpenAI-flavoured) JSON Schema into the subset Gemini accepts: removes unsupported keywords
 * (format, pattern, lengths…), turns `type: [x, "null"]` into anyOf, and `const` into a one-value enum.
 * Property NAMES are never touched, only schema keywords. Pure: returns a new object.
 */
export function sanitizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchema);
  if (!node || typeof node !== "object") return node;
  const src = node as Record<string, Json>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === "properties" && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = Object.fromEntries(Object.entries(v).map(([name, sub]) => [name, sanitizeSchema(sub)]));
      continue;
    }
    if (k === "const") { out["enum"] = [v]; continue; }
    if (DROP.has(k)) continue;
    if (k === "type" && Array.isArray(v)) {
      const types = v.filter((t): t is string => typeof t === "string");
      if (types.length === 1) out[k] = types[0];
      else { out["anyOf"] = types.map((t) => ({ type: t })); }
      continue;
    }
    out[k] = sanitizeSchema(v);
  }
  // `const` + `type` together would leave a typed single-value enum: fine. A bare empty object schema stays as is.
  return out;
}

// ---------- generateContent (one-shot `ask`) ----------

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

/** `data:application/pdf;base64,AAAA` → inlineData part; null when it is not a base64 data URL. */
export function dataUrlToPart(dataUrl: string): GeminiPart | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  return m ? { inlineData: { mimeType: m[1]!, data: m[2]! } } : null;
}

export type AskOpts = { effort?: "low" | "medium"; schema?: { name: string; schema: unknown }; files?: { filename: string; dataUrl: string }[] };

export function buildGenerateRequest(system: string, user: string, opts: AskOpts = {}) {
  const parts: GeminiPart[] = [{ text: user }];
  for (const f of opts.files ?? []) {
    const p = dataUrlToPart(f.dataUrl);
    if (!p) throw new Error(`No se pudo leer el archivo «${f.filename}».`);
    parts.push(p);
  }
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      thinkingConfig: { thinkingLevel: opts.effort === "medium" ? "medium" : "low" },
      ...(opts.schema ? { responseMimeType: "application/json", responseJsonSchema: sanitizeSchema(opts.schema.schema) } : {}),
    },
  };
}

type GenResponse = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };

/** Concatenates the visible text of the first candidate (thought parts are skipped). Throws in Spanish when blocked/empty. */
export function extractText(body: unknown): string {
  const r = body as GenResponse | null;
  const c = r?.candidates?.[0];
  const text = (c?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
  if (text) return text;
  if (r?.promptFeedback?.blockReason || c?.finishReason === "SAFETY" || c?.finishReason === "PROHIBITED_CONTENT") throw new Error("Gemini bloqueó la petición por sus filtros de seguridad. Reformula el texto e inténtalo de nuevo.");
  throw new Error("La IA no respondió");
}

// ---------- Errors ----------

/** Gemini HTTP failure → message for the user (Spanish, what happened + what to do). */
export function geminiErrorMessage(status: number, body = ""): string {
  let detail = "";
  try { detail = (JSON.parse(body) as { error?: { message?: string; status?: string } }).error?.message ?? ""; } catch { /* not JSON */ }
  if (status === 429) return /quota|billing|exceeded your current/i.test(detail)
    ? "Se ha agotado la cuota de la clave de Gemini. Revisa el plan y la facturación en Google AI Studio."
    : "Demasiadas peticiones, inténtalo en un momento.";
  if (status === 401 || status === 403 || (status === 400 && /API key not valid|API_KEY_INVALID/i.test(detail))) return "La clave de Gemini no es válida o no tiene permisos. Revisa el secreto GEMINI_API_KEY.";
  if (status === 404) return "El modelo de Gemini configurado no existe. Revisa el secreto GEMINI_MODEL.";
  if (status >= 500) return "Gemini no respondió; vuelve a intentarlo en un momento.";
  return "La IA rechazó la petición.";
}

// ---------- Jev replacement (typed judgments through structured output) ----------

type JevQuestion =
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

export type JevRequest = { state: unknown; questions: Record<string, unknown> };

/** Answers shape: { [id]: { score|noul|choice, confidence } } — the same one parseQualification reads from Jev. */
export function jevAnswerSchema(questions: Record<string, unknown>) {
  const props: Record<string, unknown> = {};
  for (const [id, raw] of Object.entries(questions)) {
    const q = raw as JevQuestion;
    const confidence = { type: "number", minimum: 0, maximum: 1 };
    if (q.type === "score") props[id] = { type: "object", properties: { score: { type: "integer", minimum: 0, maximum: Math.max(0, q.criteria.length - 1) }, confidence }, required: ["score", "confidence"] };
    else if (q.type === "noul") props[id] = { type: "object", properties: { noul: { type: "number", minimum: 0, maximum: 1 }, confidence }, required: ["noul", "confidence"] };
    else props[id] = { type: "object", properties: { choice: { type: "string", enum: Object.keys(q.criteria) }, confidence }, required: ["choice", "confidence"] };
  }
  return { type: "object", properties: { answers: { type: "object", properties: props, required: Object.keys(props) } }, required: ["answers"] };
}

export const JEV_SYSTEM = "Eres un evaluador comercial preciso. Respondes SOLO con el JSON pedido, juzgando únicamente con los datos de `state`; nunca inventas datos. Si la información no basta, elige la opción más prudente y baja la confianza.";

/** Turns the Jev question set into one Gemini prompt: each question with its criteria spelled out. */
export function jevPrompt(req: JevRequest): string {
  const lines: string[] = ["DATOS (state):", JSON.stringify(req.state), "", "PREGUNTAS. Responde cada una en answers[id]. `confidence` va de 0 (nada seguro) a 1 (muy seguro)."];
  for (const [id, raw] of Object.entries(req.questions)) {
    const q = raw as JevQuestion;
    lines.push("", `## ${id} (${q.type})`, q.instructions);
    if (q.type === "score") {
      lines.push("`score` es un entero; elige el nivel que mejor describe el caso:", ...q.criteria.map((c, i) => `- ${i}: ${c}`));
    } else if (q.type === "noul") {
      lines.push("`noul` es la probabilidad (0 a 1) de que la respuesta sea SÍ:", `- Sí (1): ${q.criteria.true}`, `- No (0): ${q.criteria.false}`);
    } else {
      lines.push("`choice` es exactamente una de estas claves:", ...Object.entries(q.criteria).map(([k, c]) => `- ${k}: ${c}`));
    }
  }
  return lines.join("\n");
}

/** Validates the structure Gemini returned against the questions asked (never fills gaps). */
export function normalizeJevAnswers(text: string, questions: Record<string, unknown>): { answers: Record<string, Record<string, unknown>> } {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("La IA devolvió una respuesta no válida"); }
  const answers = (parsed as { answers?: Record<string, Record<string, unknown>> } | null)?.answers;
  if (!answers || typeof answers !== "object") throw new Error("La IA devolvió una respuesta no válida");
  for (const [id, raw] of Object.entries(questions)) {
    const q = raw as JevQuestion; const a = answers[id];
    const ok = q.type === "score" ? Number.isInteger(a?.["score"]) && (a!["score"] as number) >= 0 && (a!["score"] as number) < q.criteria.length
      : q.type === "noul" ? typeof a?.["noul"] === "number"
      : typeof a?.["choice"] === "string" && a["choice"] in q.criteria;
    if (!ok) throw new Error(`Falta la respuesta «${id}» de la IA`);
  }
  return { answers };
}

// ---------- Agent (OpenAI-compatible chat endpoint) ----------

/** Model for the chat agent: GEMINI_AGENT_MODEL, else GEMINI_MODEL, else the default. */
export const geminiAgentModel = (env: AiEnv) => env["GEMINI_AGENT_MODEL"]?.trim() || geminiModel(env);

export const SKIP_SIGNATURE = "skip_thought_signature_validator";

/**
 * Gemini 3 validates a "thought signature" on every tool call replayed in a request; the AI SDK's OpenAI provider does not
 * carry it. Adds Google's documented skip value to assistant tool_calls that have none. Returns the body unchanged if it is
 * not a chat request. Pure: takes and returns a JSON string.
 */
export function withThoughtSignatures(bodyText: string): string {
  let b: { messages?: { role?: string; tool_calls?: { extra_content?: unknown }[] }[] };
  try { b = JSON.parse(bodyText); } catch { return bodyText; }
  if (!Array.isArray(b?.messages)) return bodyText;
  for (const m of b.messages) {
    if (m.role !== "assistant" || !Array.isArray(m.tool_calls)) continue;
    for (const tc of m.tool_calls) if (!tc.extra_content) tc.extra_content = { google: { thought_signature: SKIP_SIGNATURE } };
  }
  return JSON.stringify(b);
}

/** Same request without generationConfig.thinkingConfig, for models that do not accept `thinkingLevel` (e.g. 2.5 family). */
export function withoutThinking<T>(body: T): T {
  const b = body as { generationConfig?: Record<string, unknown> };
  if (!b?.generationConfig || !("thinkingConfig" in b.generationConfig)) return body;
  const { thinkingConfig: _t, ...rest } = b.generationConfig;
  return { ...b, generationConfig: rest } as T;
}
