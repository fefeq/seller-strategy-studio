// «Hazlo ahora»: Owner / Sales Leader run the autopilot for their company without waiting for the hourly job.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";

export const runAutopilotNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!ctx.roles.some((r) => r === "owner" || r === "sales_leader"))
      throw new Error("Solo el Owner o el Sales Leader pueden lanzarlo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { autopilotForOrg } = await import("@/lib/autopilot.server");
    return autopilotForOrg(supabaseAdmin, ctx.orgId, new Date());
  });
