// SDD-20261106-agent-rules-reader, CA-4 and §10: the server log never carries the text of a rule.
// An AI SDK APICallError carries the whole request (requestBodyValues.messages = system prompt with the team's rules)
// and the response body; a full-depth serializer (Workers/nitro) would print them. Its message is not safe either:
// @ai-sdk/openai copies the provider's error.message from the response body into it (NK-0087). Log only these fields.

const MAX_MESSAGE = 300;

export type SafeErrorLog = {
  name: string;
  /** Only for our own plain errors; a provider error's message may quote the prompt. */
  message?: string;
  messageLength: number;
  statusCode?: number;
  isRetryable?: boolean;
  url?: string;
  lastError?: SafeErrorLog;
};

type Fields = Error & {
  statusCode?: unknown;
  isRetryable?: unknown;
  url?: unknown;
  lastError?: unknown;
};

const PROVIDER_FIELDS = [
  "statusCode",
  "responseBody",
  "requestBodyValues",
  "url",
  "lastError",
  "errors",
  "data",
];

const bounded = (s: string) => (s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE)}…` : s);

/** From the AI SDK (AI_* names) or carrying any provider field: its message is not ours to log. */
const fromProvider = (f: Error) =>
  String(f.name).startsWith("AI_") || PROVIDER_FIELDS.some((k) => k in f);

/** Safe fields of a thrown value: name, statusCode, isRetryable, url, message length (and the same for
 *  RetryError.lastError). The message text only for our own plain errors. */
export function safeErrorLog(e: unknown, depth = 0): SafeErrorLog {
  if (!(e instanceof Error)) return { name: e === null ? "null" : typeof e, messageLength: 0 };
  const f = e as Fields;
  const text = String(f.message ?? "");
  const out: SafeErrorLog = { name: String(f.name), messageLength: text.length };
  if (!fromProvider(f)) out.message = bounded(text);
  if (typeof f.statusCode === "number") out.statusCode = f.statusCode;
  if (typeof f.isRetryable === "boolean") out.isRetryable = f.isRetryable;
  if (typeof f.url === "string") out.url = bounded(f.url);
  if (depth === 0 && f.lastError !== undefined) out.lastError = safeErrorLog(f.lastError, 1);
  return out;
}
