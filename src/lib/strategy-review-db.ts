// Database side of the strategic review (SDD-20261027 F4): who may ask, last review, month budget, saving, usage and
// writing the suggestions through the same reconcile path as the fixed rules. The AI call is injected.
import type { Json } from "@/integrations/supabase/types";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { canUseAdvisor } from "@/lib/advisor";
import { monthBudget } from "@/lib/orchestrator/runner";
import { syncStrategySuggestions } from "@/lib/strategy-core";
import { dedupeAgainstFixed, type ReviewDepth, type ReviewMode } from "@/lib/strategy-review";
import { loadReviewSources } from "@/lib/strategy-review-load";
import {
  runReview,
  type ReviewDeps,
  type ReviewResult,
  type LastReview,
} from "@/lib/strategy-review-core";
import { readSuggestions } from "@/lib/strategy-review-read";
import { parseStrategy } from "@/lib/strategy-suggestions";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

export const REVIEW_FORBIDDEN =
  "Solo el Owner y el Sales Leader pueden pedir una revisión estratégica con IA";

export async function lastReview(
  ctx: Pick<ToolCtx, "db" | "orgId">,
): Promise<(LastReview & { mode: string; depth: string }) | null> {
  const { data } = await ctx.db
    .from("strategy_reviews")
    .select("id,created_at,input_fingerprint,suggestions,mode,depth")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        created_at: data.created_at,
        fingerprint: data.input_fingerprint,
        suggestions: readSuggestions(data.suggestions),
        mode: data.mode,
        depth: data.depth,
      }
    : null;
}

export type ReviewOutcome = ReviewResult & { created_at: string | null };

export async function executeReview(
  ctx: ToolCtx,
  opts: { mode: ReviewMode; depth: ReviewDepth },
  ask: ReviewDeps["ask"],
  now = new Date(),
): Promise<ReviewOutcome> {
  if (!canUseAdvisor(ctx.roles)) throw new Error(REVIEW_FORBIDDEN);
  const [last, sources, budget] = await Promise.all([
    lastReview(ctx),
    loadReviewSources(ctx.db, ctx.orgId),
    monthBudget(ctx),
  ]);
  const res = await runReview({
    sources,
    mode: opts.mode,
    depth: opts.depth,
    last,
    budget: { limit: budget.limit, spent: budget.spent },
    ask,
  });
  if (res.status !== "fresh") return { ...res, created_at: last?.created_at ?? null };

  const { data: open } = await ctx.db
    .from("suggestions")
    .select("dedupe_key,strategy")
    .eq("org_id", ctx.orgId)
    .eq("status", "pending")
    .like("detector", "strategy\\_%");
  const fixed = (open ?? []).flatMap((r) => {
    const m = parseStrategy(r.strategy);
    return m ? [{ dedupe_key: r.dedupe_key, strategy: m }] : [];
  });
  const shown = dedupeAgainstFixed(res.suggestions, fixed);
  const at = now.toISOString();
  const { error } = await ctx.db.from("strategy_reviews").insert({
    mode: opts.mode,
    depth: opts.depth,
    input_fingerprint: res.fingerprint!,
    suggestions: shown as unknown as Json,
    cost: res.cost,
    created_by: ctx.userId,
  });
  if (error) console.error("strategy review: save failed", safeErrorLog(error));
  await ctx.db.from("integration_usage").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    service: "ai",
    need: "strategy_review",
    trigger: "manual",
    cost: res.cost,
  });
  await syncStrategySuggestions(ctx.db, ctx.orgId, shown, now);
  return { ...res, suggestions: shown, created_at: at };
}
