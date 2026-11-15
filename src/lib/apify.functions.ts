// Apify from the screens (any member of the active company). Same cores as the agent tools (apify-core.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";

async function scope(context: { supabase: unknown; userId: string }) {
  const c = await userCtx(context.supabase as Db, context.userId);
  return { db: c.db, s: { orgId: c.orgId, userId: c.userId } };
}

/** Battlecard draft from a competitor's G2 reviews; the screen shows it and saves it to the hub on request. */
export const battlecardFromReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ competitor: z.string().trim().min(2).max(200), max: z.number().int().min(5).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, s } = await scope(context);
    const { battlecardCore } = await import("@/lib/apify-core");
    return battlecardCore(db, data.competitor, data.max, s);
  });

/** A+: current LinkedIn role of a stakeholder vs the record (read only; the screen offers to copy the new title). */
export const stakeholderRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ stakeholderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, s } = await scope(context);
    const { stakeholderRoleCore } = await import("@/lib/apify-core");
    return stakeholderRoleCore(db, data.stakeholderId, s);
  });

export const accountJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, s } = await scope(context);
    const { accountJobsCore } = await import("@/lib/apify-core");
    return accountJobsCore(db, data.accountId, s);
  });
