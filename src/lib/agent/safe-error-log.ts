// SDD-20261106-agent-rules-reader, CA-4 and §10: the server log never carries the text of a rule.
// An AI SDK APICallError carries the whole request (requestBodyValues.messages = system prompt with the team's rules)
// and the response body; a full-depth serializer (Workers/nitro) would print them. Log only these fields.

const MAX_MESSAGE = 300;

export type SafeErrorLog = {
  name: string;
  message: string;
  statusCode?: number;
  isRetryable?: boolean;
  url?: string;
  lastError?: SafeErrorLog;
};

const bounded = (s: string) => (s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE)}…` : s);

/** Safe fields of a thrown value: name, bounded message, statusCode, isRetryable, url (and the same for RetryError.lastError). */
export function safeErrorLog(e: unknown, depth = 0): SafeErrorLog {
  if (!(e instanceof Error)) return { name: e === null ? "null" : typeof e, message: "" };
  const f = e as Error & {
    statusCode?: unknown;
    isRetryable?: unknown;
    url?: unknown;
    lastError?: unknown;
  };
  const out: SafeErrorLog = { name: String(f.name), message: bounded(String(f.message ?? "")) };
  if (typeof f.statusCode === "number") out.statusCode = f.statusCode;
  if (typeof f.isRetryable === "boolean") out.isRetryable = f.isRetryable;
  if (typeof f.url === "string") out.url = bounded(f.url);
  if (depth === 0 && f.lastError !== undefined) out.lastError = safeErrorLog(f.lastError, 1);
  return out;
}
