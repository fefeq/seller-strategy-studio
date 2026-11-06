// /plays: activate or pause a play from the screen (Owner / Sales Leader). The same core as the agent tool set_play_enabled, so the screen,
// a direct call to this function and the agent all refuse a blocked or planned play with the same words.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { togglePlay } from "@/lib/plays/toggle";

export const setPlayEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ play_id: z.string().min(1).max(80), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    return togglePlay(ctx, data.play_id, data.enabled);
  });
