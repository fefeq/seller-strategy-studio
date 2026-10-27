// Server functions to confirm, reject, undo or close a pending strategy change (SDD-20261027 F3). Each one is an explicit
// person's action (CA-39); the rules are in strategy-execute.ts and the writes in strategy-execute-core.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userCtx } from "@/lib/agent.functions";
import type { Db } from "@/lib/org-data";

const run = (name: "apply" | "reject" | "undo" | "hand") =>
  createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d: { id: string; overwrite?: boolean }) => ({ id: String(d.id), overwrite: d.overwrite === true }))
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
