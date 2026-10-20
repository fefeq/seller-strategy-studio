import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userCtx } from "@/lib/agent.functions";
import type { Db } from "@/lib/org-data";
import { buildOrgReport, WEEKLY_DETECTOR, weeklyKey } from "@/lib/weekly-report.server";
import { weekStart } from "@/lib/weekly-report";

/** Owner or Sales Leader: build this week's report now (replaces the pending one) instead of waiting for Monday. No Telegram or email: that is Monday's job. */
export const generateWeeklyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!ctx.roles.some((r) => r === "owner" || r === "sales_leader")) throw new Error("Solo Owner o Sales Leader pueden generar el informe.");
    const now = new Date();
    const key = weeklyKey(ctx.orgId, weekStart(now));
    const { report, text } = await buildOrgReport(ctx.db, ctx.orgId, now);
    const title = `Informe del lunes: ${report.headline}`;
    const { error } = await ctx.db.from("suggestions").upsert(
      { org_id: ctx.orgId, detector: WEEKLY_DETECTOR, dedupe_key: key, priority: 2, title, body: text, link: "/deals", action: null, user_id: null, status: "pending", updated_at: now.toISOString() },
      { onConflict: "org_id,dedupe_key" },
    );
    if (error) throw new Error(error.message);
    return { title };
  });
