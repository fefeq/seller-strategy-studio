import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ask } from "@/lib/ai-gateway";
import { userCtx } from "@/lib/agent.functions";
import { companyContext } from "@/lib/bmad/drafting";
import type { Db } from "@/lib/org-data";
import { ADAPT_SYSTEM, acceptableAdaptation, adaptPrompt, missingPlays } from "@/lib/playbooks/adapt";

/**
 * Owner or Sales Leader: adds Nokko's playbooks the company still lacks, each one adapted by the AI to
 * the approved context (positioning, pillars, ICP, segments, approved GTM documents). When the
 * adaptation loses the structure, keeps markers or the AI fails, the base text goes in instead, so the
 * team always ends up with a library it can edit.
 */
export const createPlaybookLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!ctx.roles.some((r) => r === "owner" || r === "sales_leader")) throw new Error("Solo Owner o Sales Leader pueden crear la biblioteca.");
    const { data: existing } = await ctx.db.from("knowledge_docs").select("title,section").eq("org_id", ctx.orgId);
    const plays = missingPlays(existing ?? []);
    if (!plays.length) return { created: [] as { title: string; adapted: boolean }[], skipped: true };
    const cc = await companyContext(ctx.db, ctx.orgId);
    const hasContext = !!cc.setup.positioning || cc.setup.pillars.length > 0 || cc.setup.icps.length > 0;
    const created: { title: string; adapted: boolean }[] = [];
    for (const play of plays) {
      let body = play.body;
      let adapted = false;
      if (hasContext) {
        try {
          const text = await ask(ADAPT_SYSTEM, adaptPrompt(play, { empresa: ctx.orgName, ...cc }), { effort: "low" });
          if (acceptableAdaptation(play, text)) { body = text.trim(); adapted = true; }
        } catch (e) { console.error("playbook adaptation failed", play.id, e); }
      }
      const { error } = await ctx.db.from("knowledge_docs").insert({ org_id: ctx.orgId, section: play.section, title: play.title, body, scope: "team" });
      if (error) throw new Error(error.message);
      created.push({ title: play.title, adapted });
    }
    return { created, skipped: false, hasContext };
  });
