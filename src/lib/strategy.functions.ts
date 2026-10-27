// Server functions to confirm, reject, undo or close a pending strategy change (SDD-20261027 F3). Each one is an explicit
// person's action (CA-39); the rules are in strategy-execute.ts and the writes in strategy-execute-core.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userCtx } from "@/lib/agent.functions";
import type { Db } from "@/lib/org-data";
import type { Json } from "@/integrations/supabase/types";

const run = (name: "apply" | "reject" | "undo" | "hand") =>
  createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d: { id: string; overwrite?: boolean }) => ({
      id: String(d.id),
      overwrite: d.overwrite === true,
    }))
    .handler(async ({ data, context }) => {
      const ctx = await userCtx(context.supabase as Db, context.userId);
      const core = await import("@/lib/strategy-execute-core");
      if (name === "apply") return core.applyChange(ctx, data.id, { overwrite: data.overwrite });
      if (name === "reject") return core.rejectChange(ctx, data.id);
      if (name === "undo") return core.undoChange(ctx, data.id);
      return core.markDoneByHand(ctx, data.id);
    });

export const applyStrategyChange = run("apply");
export const rejectStrategyChange = run("reject");
export const undoStrategyChange = run("undo");
export const doneByHandStrategyChange = run("hand");

// ---------- F4 · AI strategic review (Owner / Sales Leader) ----------

/** The one AI call of the review (SDD-20261027 H-6). «A fondo» (effort medium) only when the person asks for it. */
export const requestStrategyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode?: string; depth?: string }) => ({
    mode: d?.mode === "critical" ? ("critical" as const) : ("normal" as const),
    depth: d?.depth === "medium" ? ("medium" as const) : ("low" as const),
  }))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const [{ executeReview }, { ask }] = await Promise.all([
      import("@/lib/strategy-review-db"),
      import("@/lib/ai-gateway"),
    ]);
    const out = await executeReview(ctx, data, (system, user, opts) =>
      ask(system, user, opts as never),
    );
    return {
      status: out.status,
      notice: out.notice,
      created_at: out.created_at,
      suggestions: out.suggestions as unknown as Json,
    };
  });
