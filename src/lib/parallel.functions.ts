// Parallel from the screens (any member of the active company). Same cores as the agent tools (parallel-core.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";

async function scope(context: { supabase: unknown; userId: string }) {
  const c = await userCtx(context.supabase as Db, context.userId);
  return { db: c.db, s: { orgId: c.orgId, userId: c.userId } };
}

export const startReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, s } = await scope(context);
    const { startAccountReport } = await import("@/lib/parallel-core");
    return startAccountReport(db, s, data.accountId);
  });

export const startIcpListFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        icpId: z.string().uuid().nullable(),
        criteria: z.string().max(1000),
        count: z.number().int().min(5).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, s } = await scope(context);
    const { startIcpList } = await import("@/lib/parallel-core");
    return startIcpList(db, s, data);
  });

/** Polled by the screen every few seconds while a run is open (and on load for pending ones). */
export const checkRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { s } = await scope(context);
    const { checkRun } = await import("@/lib/parallel-core");
    return checkRun(s, data.id);
  });

export const enrichTableFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ accountIds: z.array(z.string().uuid()).min(1).max(25) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, s } = await scope(context);
    const { enrichTable } = await import("@/lib/parallel-core");
    return enrichTable(db, s, data.accountIds);
  });
