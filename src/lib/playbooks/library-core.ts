// Playbook library (server-side core), shared by the screen function and the background runner.
import { ask } from "@/lib/ai-gateway";
import { companyContext } from "@/lib/bmad/drafting";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { ADAPT_SYSTEM, acceptableAdaptation, adaptPrompt, missingPlays } from "@/lib/playbooks/adapt";

/**
 * Adds Nokko's playbooks the company still lacks, each adapted by the AI to the approved context. When the
 * adaptation loses the structure, keeps markers or the AI fails, the base text goes in instead.
 */
export async function createLibraryCore(ctx: ToolCtx & { orgName: string }, step: (s: string) => Promise<void> = async () => undefined) {
  const { data: existing } = await ctx.db.from("knowledge_docs").select("title,section").eq("org_id", ctx.orgId);
  const plays = missingPlays(existing ?? []);
  if (!plays.length) return { created: [] as { title: string; adapted: boolean }[], skipped: true, hasContext: false };
  const cc = await companyContext(ctx.db, ctx.orgId);
  const hasContext = !!cc.setup.positioning || cc.setup.pillars.length > 0 || cc.setup.icps.length > 0;
  const created: { title: string; adapted: boolean }[] = [];
  for (const [i, play] of plays.entries()) {
    await step(`Jugada ${i + 1} de ${plays.length}: ${play.title}`);
    let body = play.body;
    let adapted = false;
    if (hasContext) {
      try {
        const text = await ask(ADAPT_SYSTEM, adaptPrompt(play, { empresa: ctx.orgName, ...cc }), { effort: "low" });
        if (acceptableAdaptation(play, text)) { body = text.trim(); adapted = true; }
      } catch (e) { console.error("playbook adaptation failed", play.id, e); }
    }
    const { error } = await ctx.db.from("knowledge_docs").insert({ org_id: ctx.orgId, section: play.section, title: play.title, body, scope: "team", created_by: ctx.userId, updated_by: ctx.userId });
    if (error) throw new Error(error.message);
    created.push({ title: play.title, adapted });
  }
  return { created, skipped: false, hasContext };
}
