// Orchestrator from the screens: the user asks for a need, Nokko picks the services (src/lib/orchestrator/).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { completeAccount, connectedServices, monthBudget } from "@/lib/orchestrator/runner";

export const orchestrateCompleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => completeAccount(await userCtx(context.supabase as Db, context.userId), data.accountId, "manual"));

export const orchestratorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await userCtx(context.supabase as Db, context.userId);
    const b = await monthBudget(c);
    const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
    const { data } = await c.db.from("integration_usage").select("service,cost,trigger").eq("org_id", c.orgId).gte("created_at", start.toISOString());
    const byService: Record<string, { calls: number; cost: number }> = {};
    let automatic = 0;
    for (const r of data ?? []) {
      const s = (byService[r.service] ??= { calls: 0, cost: 0 });
      s.calls++; s.cost += Number(r.cost || 0);
      if (r.trigger === "automatic") automatic += Number(r.cost || 0);
    }
    return { connected: connectedServices(), spent: b.spent, limit: b.limit, warn: b.warn, paused: b.paused, pct: b.pct, automatic, byService };
  });
