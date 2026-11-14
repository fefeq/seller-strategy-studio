import { askPinned } from "@/lib/ai-pinned";
import { CLASSIFICATION_JSON_SCHEMA } from "./classification";
import { CLASSIFICATION_SYSTEM, DRAFT_SYSTEM, type ReplyPorts } from "./classification-core";

export const REPLY_MODEL = "anthropic/claude-opus-5.5";

/** Explicit privacy constraints apply only to mailbox calls, not the shared AI chain. */
export function replyModelPorts(
  record: ReplyPorts["record"],
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
): ReplyPorts {
  const privateFetch: typeof fetch = async (input, init) => {
    if (typeof init?.body !== "string") throw new Error("La solicitud privada de IA no es válida.");
    const body = JSON.parse(init.body) as { provider: Record<string, unknown> };
    body.provider = { ...body.provider, data_collection: "deny", zdr: true };
    return fetchImpl(input, { ...init, body: JSON.stringify(body) });
  };
  async function run(system: string, input: string, classify: boolean) {
    const result = await askPinned(REPLY_MODEL, system, input, {
      effort: "low", maxTokens: classify ? 1200 : 2000,
      ...(classify ? { schema: { name: "private_reply_classification", schema: CLASSIFICATION_JSON_SCHEMA } } : {}),
    }, env, privateFetch);
    return {
      output: classify ? result.output : result.text,
      completed: result.stopReason === "end_turn" && result.model === REPLY_MODEL,
      usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd },
    };
  }
  return { classify: (input) => run(CLASSIFICATION_SYSTEM, input, true), draft: (input) => run(DRAFT_SYSTEM, input, false), record };
}