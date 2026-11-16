// Saves the review decision of an experiment (SDD-20261027 F2 · CA-29). Takes the client and the company explicitly, like the
// agent tools. The rules (what is required, what is proposed) are pure, in experiments.ts.
import type { Db } from "@/lib/org-data";
import { planDecision, type DecisionInput, type ExperimentLike } from "@/lib/experiments";

const COLUMNS =
  "id,title,status,hypothesis,metric,target,result,learning,success_threshold,close_rule,review_on,ends_on,decision";

/**
 * Closes, scales or adjusts an experiment: saves result, learning and decision, and — only when the person names the element —
 * leaves a pending strategic suggestion with the experiment as evidence. Nothing is applied to ICP, segments, positioning or
 * products: the person decides on the suggestion (F3 executes it).
 */
export async function decideExperiment(
  ctx: { db: Db; orgId: string; userId: string },
  id: string,
  input: DecisionInput,
  now = new Date(),
) {
  const { data: e } = await ctx.db
    .from("gtm_experiments")
    .select(COLUMNS)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!e) throw new Error("No encuentro ese experimento.");
  const plan = planDecision(e as ExperimentLike, input, now, ctx.userId);
  if (!plan.ok) throw new Error(plan.error);
  const { error } = await ctx.db
    .from("gtm_experiments")
    .update(plan.patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error)
    throw new Error("No pude guardar la decisión. No he cambiado nada; inténtalo de nuevo.");
  let proposed = false;
  if (plan.proposal) {
    const { syncStrategySuggestions } = await import("@/lib/strategy-core");
    await syncStrategySuggestions(ctx.db, ctx.orgId, [plan.proposal], now);
    proposed = true;
  }
  return { status: plan.patch.status ?? "running", proposed };
}
