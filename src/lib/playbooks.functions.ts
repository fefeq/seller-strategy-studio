import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userCtx } from "@/lib/agent.functions";
import type { Db } from "@/lib/org-data";

/** Owner or Sales Leader: adds the playbooks the company still lacks, adapted to its context (see library-core). */
export const createPlaybookLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!ctx.roles.some((r) => r === "owner" || r === "sales_leader"))
      throw new Error("Solo Owner o Sales Leader pueden crear la biblioteca.");
    const { createLibraryCore } = await import("@/lib/playbooks/library-core");
    return createLibraryCore(ctx);
  });
