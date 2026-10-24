// Memory from the screens: learn from a meeting after its notes are saved.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";

export const learnFromMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ meetingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await userCtx(context.supabase as Db, context.userId);
    const { data: m } = await c.db.from("meetings").select("title,objective,notes,call_notes,next_steps,account_id,accounts(name)").eq("id", data.meetingId).eq("org_id", c.orgId).maybeSingle();
    if (!m) return { added: 0, replaced: 0 };
    const cn = (m.call_notes ?? {}) as Record<string, string>;
    const text = [`Reunión: ${m.title ?? ""}`, m.objective && `Objetivo: ${m.objective}`, ...Object.entries(cn).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), m.notes && `Notas: ${m.notes}`, m.next_steps && `Siguientes pasos: ${m.next_steps}`].filter(Boolean).join("\n");
    const { learnFrom } = await import("@/lib/memory.server");
    return learnFrom(c, { source: "meeting", text, accountId: m.account_id, accountName: (m as any).accounts?.name ?? null });
  });
