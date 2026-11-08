// SDD-20261106-agent-rules-reader (NK-0076, NK-0087), CA-4 and §10: safeErrorLog keeps only safe fields of a provider
// error, never the request body, the response body, an unfiltered cause or the message (@ai-sdk/openai copies the
// provider's error.message, which may quote the prompt). Fictional rule.
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { APICallError, RetryError } from "ai";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

const RULE_TEXT = "REGLA-FICTICIA-7f3a nunca regalamos la implantación sin aprobación.";
const serialized = (x: unknown) =>
  `${inspect(x, { depth: null, showHidden: true })}\n${JSON.stringify(x)}`;

describe("safeErrorLog", () => {
  const api = new APICallError({
    message: `Content rejected in messages[0]: ${RULE_TEXT}`,
    url: "https://provider.invalid/v1/chat/completions",
    requestBodyValues: { messages: [{ role: "system", content: RULE_TEXT }] },
    statusCode: 400,
    responseBody: RULE_TEXT,
    isRetryable: true,
    cause: { prompt: RULE_TEXT },
  });

  it("keeps only name, statusCode, isRetryable, url and the message length", () => {
    expect(safeErrorLog(api)).toEqual({
      name: "AI_APICallError",
      messageLength: api.message.length,
      statusCode: 400,
      isRetryable: true,
      url: "https://provider.invalid/v1/chat/completions",
    });
    expect(serialized(safeErrorLog(api))).not.toContain("REGLA-FICTICIA-7f3a");
  });

  it("reads the API error inside a RetryError, without either message", () => {
    const retry = new RetryError({
      message: `Failed after 3 attempts. Last error: ${api.message}`,
      reason: "maxRetriesExceeded",
      errors: [api],
    });
    const out = safeErrorLog(retry);
    expect(out.name).toBe("AI_RetryError");
    expect(out.message).toBeUndefined();
    expect(out.lastError).toMatchObject({ name: "AI_APICallError", statusCode: 400 });
    expect(out.lastError?.message).toBeUndefined();
    expect(serialized(out)).not.toContain("REGLA-FICTICIA-7f3a");
  });

  it("drops the message of any error carrying a provider field", () => {
    const withStatus = Object.assign(new Error(RULE_TEXT), { statusCode: 500 });
    const withBody = Object.assign(new Error(RULE_TEXT), { responseBody: "x" });
    for (const e of [withStatus, withBody]) {
      expect(safeErrorLog(e).message).toBeUndefined();
      expect(serialized(safeErrorLog(e))).not.toContain("REGLA-FICTICIA-7f3a");
    }
  });

  it("keeps our own plain error message, bounded", () => {
    expect(safeErrorLog(new Error("La IA no está configurada")).message).toBe(
      "La IA no está configurada",
    );
    const long = safeErrorLog(new Error("x".repeat(5000)));
    expect(long.message?.length).toBeLessThanOrEqual(301);
    expect(long.messageLength).toBe(5000);
  });

  it("non-errors log only their type", () => {
    expect(safeErrorLog({ prompt: RULE_TEXT })).toEqual({ name: "object", messageLength: 0 });
    expect(safeErrorLog(undefined)).toEqual({ name: "undefined", messageLength: 0 });
  });
});
