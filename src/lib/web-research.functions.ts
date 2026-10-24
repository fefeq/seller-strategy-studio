// Web research from the screens (any member of the active company). Same cores as the agent tools.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";

const AccountIn = z.object({ accountId: z.string().uuid() });

export const researchAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AccountIn.parse(d))
  .handler(async ({ data, context }) => {
    const c = await userCtx(context.supabase as Db, context.userId);
    const { researchAccountCore } = await import("@/lib/web-research-core");
    const { trackedRun } = await import("@/lib/orchestrator/runner");
    return trackedRun(c, "research_account", "manual", () => researchAccountCore(context.supabase, data.accountId));
  });

export const refreshSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AccountIn.parse(d))
  .handler(async ({ data, context }) => {
    await userCtx(context.supabase as Db, context.userId);
    const { refreshSignalsCore } = await import("@/lib/web-research-core");
    const r = await refreshSignalsCore(context.supabase, data.accountId);
    return { checked: r.checked, added: r.added.length };
  });
