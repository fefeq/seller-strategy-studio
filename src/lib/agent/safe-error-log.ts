// SDD-20261106-agent-rules-reader, CA-4 and §10: the server log never carries the text of a rule.
// An AI SDK APICallError carries the whole request (requestBodyValues.messages = system prompt with the team's rules)
// and the response body; a full-depth serializer (Workers/nitro) would print them. No message text either: the SDK
// copies the provider's error.message into it, and a failing fetch may quote the request (NK-0087). A log that needs a
// readable text uses its own constant label, never the error's message.

export type SafeErrorLog = {
  name: string;
  messageLength: number;
  statusCode?: number;
  isRetryable?: boolean;
  url?: string;
  lastError?: SafeErrorLog;
};

const MAX_URL = 300;

type Fields = Error & {
  statusCode?: unknown;
  isRetryable?: unknown;
  url?: unknown;
  lastError?: unknown;
};

/** Safe fields of a thrown value: name, message length, statusCode, isRetryable, url (and the same for
 *  RetryError.lastError). Never the message text, bodies or cause. */
export function safeErrorLog(e: unknown, depth = 0): SafeErrorLog {
  if (!(e instanceof Error)) return { name: e === null ? "null" : typeof e, messageLength: 0 };
  const f = e as Fields;
  const out: SafeErrorLog = {
    name: String(f.name),
    messageLength: String(f.message ?? "").length,
  };
  if (typeof f.statusCode === "number") out.statusCode = f.statusCode;
  if (typeof f.isRetryable === "boolean") out.isRetryable = f.isRetryable;
  if (typeof f.url === "string") out.url = f.url.slice(0, MAX_URL);
  if (depth === 0 && f.lastError !== undefined) out.lastError = safeErrorLog(f.lastError, 1);
  return out;
}
