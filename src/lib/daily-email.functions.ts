// «Envíame el resumen ahora» from Equipo → Avisos: today's daily email, only to the person asking.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";

export const sendMyDailyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendDailyEmailNow } = await import("@/lib/daily-email.server");
    return sendDailyEmailNow(supabaseAdmin, ctx.userId, ctx.orgId);
  });
