// Reference generation by Anthropic direct, as gtm-lab@44f385b supabase/functions/_shared/anthropic.ts sends it
// (:31-39) and reads it (:42-50), translated from the SDK to HTTP (see anthropic-http.ts). Same prompt as the
// OpenRouter passes, so the comparison changes only the route (NK-0048 CA-18). Pure; the call lives in the script.
import type { SuggestCall } from "../suggest-request";
import {
  ANTHROPIC_MESSAGES_URL,
  anthropicHeaders,
  parseOrNull,
  textOf,
  type AnthropicMessage,
  type Env,
  type HttpRequest,
} from "./anthropic-http";

export const REFERENCE_MODEL = "claude-sonnet-5-5";
export const REFERENCE_BETAS = ["server-side-fallback-2026-07-01"] as const;

export function referenceBody(call: SuggestCall): Record<string, unknown> {
  return {
    model: REFERENCE_MODEL,
    max_tokens: 16000,
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: call.schema } },
    // Stable instructions first and cached; the project context goes in the user turn.
    system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: call.user }],
  };
}

/** Full HTTP request, or null without ANTHROPIC_API_KEY. */
export function referenceRequest(call: SuggestCall, env: Env): HttpRequest | null {
  const headers = anthropicHeaders(env, REFERENCE_BETAS);
  return headers ? { url: ANTHROPIC_MESSAGES_URL, headers, body: referenceBody(call) } : null;
}

export interface ReferenceResult {
  stopReason: string | null;
  /** Parsed JSON when the model finished normally; null otherwise. */
  output: unknown;
  /** Model that actually answered (it can be a server-side fallback). */
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

/** anthropic.ts:42-50: the output only counts with end_turn. */
export function referenceResult(message: AnthropicMessage): ReferenceResult {
  const text = textOf(message);
  return {
    stopReason: message.stop_reason,
    output: message.stop_reason === "end_turn" && text !== null ? parseOrNull(text) : null,
    model: message.model,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    },
  };
}
