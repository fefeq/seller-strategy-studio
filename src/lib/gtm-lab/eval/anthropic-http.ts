// Anthropic Messages API over plain fetch, for the eval only (NOKKO has no @anthropic-ai/sdk). This is the HTTP
// translation of what @anthropic-ai/sdk 1.3.0 sends for gtm-lab@44f385b (SDD-20261101-gtm-lab-1-core CA-16/CA-18):
// POST /v1/messages, anthropic-version 2026-10-21, `betas` moved from the body to the anthropic-beta header
// (comma separated), x-api-key and, when set, anthropic-workspace-id. No retries: the SDK retries twice, we do not.
export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2026-10-21";

export type Env = Record<string, string | undefined>;

export interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Request headers, or null when there is no ANTHROPIC_API_KEY. Never logged nor written to the evidence. */
export function anthropicHeaders(
  env: Env,
  betas: readonly string[] = [],
): Record<string, string> | null {
  const key = env["ANTHROPIC_API_KEY"];
  if (!key) return null;
  const workspace = env["ANTHROPIC_WORKSPACE_ID"];
  return {
    "x-api-key": key,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
    ...(workspace ? { "anthropic-workspace-id": workspace } : {}),
    ...(betas.length ? { "anthropic-beta": betas.join(",") } : {}),
  };
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export interface AnthropicMessage {
  model: string;
  stop_reason: string | null;
  content: { type: string; text?: string }[];
  usage: AnthropicUsage;
}

/** The first text block, as gtm-lab reads it. */
export function textOf(message: AnthropicMessage): string | null {
  const block = message.content.find((b) => b.type === "text");
  return block && typeof block.text === "string" ? block.text : null;
}

export function parseOrNull(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// From gtm-lab@44f385b scripts/eval-suggest.mjs PRICES: published USD per million tokens (claude-api reference,
// 2026-11-01). Cache writes are 5-minute TTL.
export const PRICES: Readonly<
  Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>
> = Object.freeze({
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
});

/** Measured cost in USD; null when the model has no price (the original threw: here the pass goes «sin dato»). */
export function costUsd(model: string, usage: AnthropicUsage): number | null {
  // The API may answer with a dated id (e.g. claude-sonnet-5-5-2026…): match by prefix.
  const price = Object.entries(PRICES).find(
    ([id]) => model === id || model.startsWith(`${id}-`),
  )?.[1];
  if (!price) return null;
  return (
    (usage.input_tokens * price.input +
      usage.output_tokens * price.output +
      (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite) /
    1e6
  );
}
