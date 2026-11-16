import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveCustomPlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.uuid(),
        playId: z.uuid(),
        action: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("toggle"), enabled: z.boolean() }),
          z.object({
            kind: z.literal("result"),
            sample: z.number().int().positive(),
            successes: z.number().int().nonnegative(),
          }),
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { saveCustomPlayControl } = await import("@/lib/plays/custom/controls.server");
    return saveCustomPlayControl(
      context.supabase,
      context.userId,
      data.orgId,
      data.playId,
      data.action,
    );
  });
