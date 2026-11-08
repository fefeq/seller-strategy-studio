// SDD-20261106-agent-rules-reader (NK-0076), CA-4 and §10: safeErrorLog keeps only safe fields of a provider error,
// never the request body, the response body or an unfiltered cause. Fictional rule.
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { APICallError, RetryError } from "ai";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

const RULE_TEXT = "REGLA-FICTICIA-7f3a nunca regalamos la implantación sin aprobación.";
const serialized = (x: unknown) =>
  `${inspect(x, { depth: null, showHidden: true })}\n${JSON.stringify(x)}`;

describe("safeErrorLog", () => {
  const api = new APICallError({
    message: "Bad Request",
    url: "https://provider.invalid/v1/chat/completions",
    requestBodyValues: { messages: [{ role: "system", content: RULE_TEXT }] },
    statusCode: 400,
    responseBody: RULE_TEXT,
    isRetryable: true,
    cause: { prompt: RULE_TEXT },
  });

  it("keeps only name, statusCode, isRetryable, url and message", () => {
    expect(safeErrorLog(api)).toEqual({
      name: "AI_APICallError",
      message: "Bad Request",
      statusCode: 400,
      isRetryable: true,
      url: "https://provider.invalid/v1/chat/completions",
    });
    expect(serialized(safeErrorLog(api))).not.toContain("REGLA-FICTICIA-7f3a");
  });

  it("bounds the message", () => {
    const long = safeErrorLog(new Error("x".repeat(5000)));
    expect(long.message.length).toBeLessThanOrEqual(301);
  });

  it("reads the API error inside a RetryError, safely", () => {
    const retry = new RetryError({
      message: "Failed",
      reason: "maxRetriesExceeded",
      errors: [api],
    });
    const out = safeErrorLog(retry);
    expect(out.name).toBe("AI_RetryError");
    expect(out.lastError).toMatchObject({ name: "AI_APICallError", statusCode: 400 });
    expect(serialized(out)).not.toContain("REGLA-FICTICIA-7f3a");
  });

  it("non-errors log only their type", () => {
    expect(safeErrorLog({ prompt: RULE_TEXT })).toEqual({ name: "object", message: "" });
    expect(safeErrorLog(undefined)).toEqual({ name: "undefined", message: "" });
  });
});
