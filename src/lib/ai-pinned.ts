// One OpenRouter call to ONE pinned model, with no model or provider fallback (SDD-20261101-gtm-lab-1-core,
// CA-7..CA-9). Unlike ask() it does not walk aiProviders(): GTM Lab must measure one route, and it returns why
// the model stopped, which model and provider answered, tokens and cost. Server-only (reads the key in the call).
import { openrouterErrorMessage, ProviderError } from "@/lib/ai-gateway";
import { OPENROUTER_BASE } from "@/lib/gemini";

export interface PinnedOpts {
  /** Strict JSON schema output; `output` is parsed only when there is one. */
  schema?: { name: string; schema: Record<string, unknown> };
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface PinnedUsage {
  /** Prompt tokens without the cached part, like Anthropic input_tokens. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** Measured cost in USD; null when OpenRouter does not report it. Never estimated. */
  costUsd: number | null;
  /** usage.is_byok as reported; null when it is not a boolean (hypothesis checked by the pilot, §16). */
  byok: boolean | null;
}

export interface PinnedResult {
  text: string;
  output: unknown;
  /** Anthropic stop reason: end_turn, max_tokens, refusal… */
  stopReason: string | null;
  model: string | null;
  provider: string | null;
  usage: PinnedUsage;
}

export const NO_OPENROUTER_KEY =
  "La IA no está configurada: falta la clave de OpenRouter (OPENROUTER_API_KEY).";

/** Request body: one model, Anthropic only, no fallbacks. Not openrouterRouting(): it adds `models`. */
export function openrouterPinnedBody(
  model: string,
  system: string,
  user: string,
  opts: PinnedOpts = {},
) {
  return {
    model,
    provider: { order: ["anthropic"], allow_fallbacks: false, require_parameters: true },
    reasoning: { effort: opts.effort ?? "low" },
    max_tokens: opts.maxTokens ?? 16000,
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      },
      { role: "user", content: user },
    ],
    ...(opts.schema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema },
          },
        }
      : {}),
    usage: { include: true },
  };
}

const FINISH_TO_STOP: Record<string, string> = {
  stop: "end_turn",
  length: "max_tokens",
  content_filter: "refusal",
};

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const money = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

function usageOf(raw: Raw): PinnedUsage {
  const cacheReadTokens = count(obj(raw.prompt_tokens_details).cached_tokens);
  const byok = typeof raw.is_byok === "boolean" ? raw.is_byok : null;
  // No falling from one cost field to the other: each billing mode has its own field.
  const costUsd =
    byok === true
      ? money(obj(raw.cost_details).upstream_inference_cost)
      : byok === false
        ? money(raw.cost)
        : null;
  return {
    inputTokens: Math.max(0, count(raw.prompt_tokens) - cacheReadTokens),
    outputTokens: count(raw.completion_tokens),
    cacheReadTokens,
    costUsd,
    byok,
  };
}

/** Parses a chat/completions body. An `error` in a 200 body is a provider error, never a model failure. */
export function parsePinnedResponse(body: string, hasSchema: boolean): PinnedResult {
  let json: Raw;
  try {
    json = obj(JSON.parse(body));
  } catch {
    throw new ProviderError("OpenRouter devolvió una respuesta inválida.", 502, body, "openrouter");
  }
  if (json.error) {
    const code = obj(json.error).code;
    const status = typeof code === "number" ? code : 502;
    throw new ProviderError(openrouterErrorMessage(status), status, body, "openrouter");
  }
  const choice = obj(Array.isArray(json.choices) ? json.choices[0] : undefined);
  const native = str(choice.native_finish_reason);
  const finish = str(choice.finish_reason);
  const stopReason = native ?? (finish ? (FINISH_TO_STOP[finish] ?? finish) : null);
  const content = obj(choice.message).content;
  const text = typeof content === "string" ? content : "";
  let output: unknown = null;
  // Same rule as gtm-lab anthropic.ts: the output only counts when the model finished normally.
  if (hasSchema && stopReason === "end_turn") {
    try {
      output = JSON.parse(text);
    } catch {
      output = null;
    }
  }
  return {
    text,
    output,
    stopReason,
    model: str(json.model),
    provider: str(json.provider),
    usage: usageOf(obj(json.usage)),
  };
}

function pinnedErrorMessage(status: number, model: string) {
  return status === 404
    ? `El modelo fijado (${model}) no está disponible en OpenRouter; revisa que tu clave del proveedor esté añadida en OpenRouter.`
    : openrouterErrorMessage(status);
}

/** One call, never retried and never handed to another provider. */
export async function askPinned(
  model: string,
  system: string,
  user: string,
  opts: PinnedOpts = {},
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<PinnedResult> {
  const key = env["OPENROUTER_API_KEY"];
  if (!key) throw new Error(NO_OPENROUTER_KEY);
  let res: Response;
  try {
    res = await fetchImpl(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Nokko",
      },
      body: JSON.stringify(openrouterPinnedBody(model, system, user, opts)),
    });
  } catch {
    throw new ProviderError(
      "OpenRouter no respondió; vuelve a intentarlo en un momento.",
      0,
      "",
      "openrouter",
    );
  }
  const body = await res.text().catch(() => "");
  if (!res.ok)
    throw new ProviderError(pinnedErrorMessage(res.status, model), res.status, body, "openrouter");
  return parsePinnedResponse(body, Boolean(opts.schema));
}
