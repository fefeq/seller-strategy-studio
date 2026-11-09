// Playbook library (server-side core), shared by the screen function and the background runner.
import { ask } from "@/lib/ai-gateway";
import { companyContext } from "@/lib/bmad/drafting";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import { loadAgentRules, RULES_READ_FAILED, rulesBlock } from "@/lib/knowledge-rules";
import {
  ADAPT_SYSTEM,
  acceptableAdaptation,
  adaptPrompt,
  missingPlays,
} from "@/lib/playbooks/adapt";

/**
 * Adds Nokko's playbooks the company still lacks, each adapted by the AI to the approved context. When the
 * adaptation loses the structure, keeps markers or the AI fails, the base text goes in instead.
 * The team's rules come from the common reader (SDD-20261109-rules-in-ai-readers, CA-7): read once per job, only when
 * there is an AI call, as a block after ADAPT_SYSTEM; Ciclo GTM's reglas_obligatorias stay out of contexto_empresa.
 */
export async function createLibraryCore(
  ctx: ToolCtx & { orgName: string },
  step: (s: string) => Promise<void> = async () => undefined,
) {
  const { data: existing } = await ctx.db
    .from("knowledge_docs")
    .select("title,section")
    .eq("org_id", ctx.orgId);
  const plays = missingPlays(existing ?? []);
  if (!plays.length)
    return {
      created: [] as { title: string; adapted: boolean }[],
      skipped: true,
      hasContext: false,
    };
  const cc = await companyContext(ctx.db, ctx.orgId);
  const hasContext =
    !!cc.setup.positioning || cc.setup.pillars.length > 0 || cc.setup.icps.length > 0;
  const rules = hasContext ? await loadAgentRules({ db: ctx.db, orgId: ctx.orgId }) : null;
  const block = rulesBlock(rules?.rules ?? []);
  const system = block ? `${ADAPT_SYSTEM}\n${block}` : ADAPT_SYSTEM;
  const { reglas_obligatorias: _rules, ...context } = cc;
  const created: { title: string; adapted: boolean }[] = [];
  for (const [i, play] of plays.entries()) {
    await step(`Jugada ${i + 1} de ${plays.length}: ${play.title}`);
    let body = play.body;
    let adapted = false;
    if (hasContext) {
      try {
        const text = await ask(system, adaptPrompt(play, { empresa: ctx.orgName, ...context }), {
          effort: "low",
        });
        if (acceptableAdaptation(play, text)) {
          body = text.trim();
          adapted = true;
        }
      } catch (e) {
        // Never the error or its message: it may quote the prompt, rules included (NK-0087, CA-8).
        console.error("playbook adaptation failed", play.id, safeErrorLog(e));
      }
    }
    const { error } = await ctx.db.from("knowledge_docs").insert({
      org_id: ctx.orgId,
      section: play.section,
      title: play.title,
      body,
      scope: "team",
      created_by: ctx.userId,
      updated_by: ctx.userId,
    });
    if (error) throw new Error(error.message);
    created.push({ title: play.title, adapted });
  }
  // A failed read is said in the job's notice (CA-7); the plays went in without the rules.
  return rules && !rules.ok
    ? { created, skipped: false, hasContext, mensaje: RULES_READ_FAILED }
    : { created, skipped: false, hasContext };
}
