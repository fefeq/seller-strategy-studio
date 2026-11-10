import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userCtx } from "@/lib/agent.functions";
import type { Db } from "@/lib/org-data";

/**
 * «Añadir reglas base» (SDD-20261110, NK-0128): Owner or Sales Leader adds the base rules the company still lacks to its Reglas
 * section. Runs as the caller (RLS client, so migration 0081 backs the role check) on the caller's active company.
 */
export const addDefaultRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const { addDefaultRulesCore } = await import("@/lib/default-rules");
    return addDefaultRulesCore(ctx);
  });
