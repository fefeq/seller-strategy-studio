// The AI suggestion request of GTM Lab, built exactly as gtm-lab@44f385b does it (buildAiRequest and
// formJsonSchema of the core, no text added), so the eval measures the route and not another prompt (NK-0048 CA-11).
import { buildAiRequest, formJsonSchema, type Framework, type SavedDeliverableLike } from "./core";

export interface SuggestCall {
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

export function buildSuggestCall(
  framework: Framework,
  deliverableId: string,
  saved: ReadonlyMap<string, SavedDeliverableLike>,
): SuggestCall {
  const { system, user } = buildAiRequest(framework, deliverableId, saved);
  return { system, user, schema: formJsonSchema(framework, deliverableId) };
}
