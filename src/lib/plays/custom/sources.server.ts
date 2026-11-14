import { planFor, type Service } from "@/lib/orchestrator/planner";
import { connectedServices, monthBudget } from "@/lib/orchestrator/runner";
import { SOURCE_REGISTRY, type Step } from "./model";
import type { TaggedItem } from "./engine";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import type { Trigger } from "@/lib/orchestrator/usage";
import type { StepPayload } from "./step-output";
import { newsItems } from "@/lib/web-research";
export async function readStepSource(c: ToolCtx, step: Step, trigger: Trigger): Promise<{ signals: TaggedItem[]; usage: StepPayload["usage"] }> {
  const def = SOURCE_REGISTRY[step.source];
  if (!def.need) throw new Error("Este paso requiere una fuente que aún no admite ejecución. Revisa el play.");
  const budget = await monthBudget(c);
  const plan = planFor({ need: def.need, connected: connectedServices(), budget: { remaining: budget.remaining, paused: budget.paused, automatic: trigger === "automatic" } });
  const chosen = plan.steps.find(o => step.source === "reviews" ? o.service === "apify" : ["firecrawl","perplexity","parallel"].includes(o.service));
  if (!chosen) throw new Error(plan.blocked ?? "No hay una fuente pública disponible para este paso.");
  // One provider, not searchTagged's allSettled/fallback path: terminal denials cannot be swallowed.
  let signals: TaggedItem[];
  if (chosen.service === "apify") {
    const { competitorReviewsCore } = await import("@/lib/apify-core");
    const r = await competitorReviewsCore(step.question,8);
    signals = r.reviews.filter(x => !!x.url).map(x => ({ title:x.title,url:x.url ?? r.product.url,snippet:x.text,date:x.date,source:"G2",provider:"apify" }));
  } else if (chosen.service === "firecrawl") {
    const { search } = await import("@/lib/firecrawl");
    signals = newsItems(await search(step.question,{ limit:8,sources:["web","news"] }),8).map(x => ({ ...x,provider:"firecrawl" }));
  } else if (chosen.service === "perplexity") {
    const { perplexitySearch } = await import("@/lib/perplexity");
    signals = newsItems(await perplexitySearch([step.question],{ maxResults:8 }),8).map(x => ({ ...x,provider:"perplexity" }));
  } else {
    const { parallelSearch } = await import("@/lib/parallel-gateway");
    signals = newsItems(await parallelSearch(step.question,[step.question],{ max:8 }),8).map(x => ({ ...x,provider:"parallel" }));
  }
  return { signals, usage:[{ service:chosen.service,need:def.need,trigger,cost:chosen.cost }] };
}
export function runtimeServices(): Service[] { return connectedServices(); }