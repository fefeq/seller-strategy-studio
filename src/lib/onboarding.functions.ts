// «Rehacer con IA» for one onboarding block. Leadership only, like the rest of the strategy setup.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { mergeBlock, REDO_HINT_MAX, type BlockId } from "@/lib/onboarding";
import type { SetupProposal } from "@/lib/setup-extraction";
import type { Json } from "@/integrations/supabase/types";

const BLOCK = z.enum(["company", "icp", "segments", "positioning", "messages", "goals"]);
const HINT = z.string().trim()
  .min(2, "Escribe qué quieres que cambie (al menos un par de palabras).")
  .max(REDO_HINT_MAX, `El texto es demasiado largo: el máximo son ${REDO_HINT_MAX.toLocaleString("es-ES")} caracteres. Recórtalo y vuelve a intentarlo.`);

export const redoOnboardingBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const r = z.object({ block: BLOCK, hint: HINT }).safeParse(d);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "La indicación no es válida.");
    return r.data;
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!ctx.roles.some((r) => r === "owner" || r === "sales_leader")) throw new Error("Solo el Owner o el Sales Leader pueden rehacer la estrategia.");
    const { data: s } = await ctx.db.from("onboarding_sessions").select("proposal").eq("org_id", ctx.orgId).eq("user_id", ctx.userId).maybeSingle();
    const prev = s?.proposal as unknown as SetupProposal | null;
    if (!prev) throw new Error("Aún no hay propuesta: primero deja que Nokko lea tus fuentes.");
    const { redoBlockCore } = await import("@/lib/setup-extract.server");
    const next = await redoBlockCore(ctx, prev, data.block, data.hint);
    const merged = mergeBlock(prev, next, data.block as BlockId);
    const { error } = await ctx.db.from("onboarding_sessions").update({ proposal: merged as unknown as Json, updated_at: new Date().toISOString() }).eq("org_id", ctx.orgId).eq("user_id", ctx.userId);
    if (error) throw new Error(error.message);
    return merged;
  });
