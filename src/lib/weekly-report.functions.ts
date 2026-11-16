import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userCtx } from "@/lib/agent.functions";
import type { Db } from "@/lib/org-data";

/** Owner or Sales Leader: build this week's report now (replaces the pending one) instead of waiting for Monday. */
export const generateWeeklyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!ctx.roles.some((r) => r === "owner" || r === "sales_leader"))
      throw new Error("Solo Owner o Sales Leader pueden generar el informe.");
    const { saveWeeklyReportNow } = await import("@/lib/weekly-report.server");
    return saveWeeklyReportNow(ctx.db, ctx.orgId);
  });
