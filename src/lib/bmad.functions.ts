import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { draftArtifactCore } from "@/lib/bmad/drafting";
import { userCtx } from "@/lib/agent.functions";
import { ARTIFACTS, type ArtifactKind } from "@/lib/bmad/workflows";
import { canConvene, DEBATE_LEVELS, type DebateLevel } from "@/lib/bmad/teams";
import { REVIEW_METHOD_TEXT, deepReviewCore, runDebateCore } from "@/lib/bmad/debate-core";

const KINDS = Object.keys(ARTIFACTS) as ArtifactKind[];
const LEVELS = Object.keys(DEBATE_LEVELS) as DebateLevel[];
export const REVIEW_METHODS = Object.keys(REVIEW_METHOD_TEXT);

export const draftArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: string; notes?: string; dealId?: string | null }) => {
    if (!KINDS.includes(d.kind as ArtifactKind)) throw new Error("Tipo de documento no válido");
    return { kind: d.kind as ArtifactKind, notes: String(d.notes ?? "").slice(0, 6000), dealId: d.dealId ? String(d.dealId) : null };
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    return draftArtifactCore(ctx, data);
  });

export const deepReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { artifactId: string; method: string }) => {
    if (!REVIEW_METHOD_TEXT[d.method]) throw new Error("Método no válido");
    return { artifactId: String(d.artifactId), method: d.method };
  })
  .handler(async ({ data, context }) => deepReviewCore(await userCtx(context.supabase as Db, context.userId), data));

export const runDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { level: string; topic: string; subjectType?: string | null; subjectId?: string | null; participants?: string[] }) => {
    if (!LEVELS.includes(d.level as DebateLevel)) throw new Error("Nivel no válido");
    const topic = String(d.topic ?? "").trim();
    if (!topic) throw new Error("Escribe el tema del debate");
    const st = ["deal", "account", "artifact"].includes(String(d.subjectType)) ? String(d.subjectType) : null;
    return { level: d.level as DebateLevel, topic: topic.slice(0, 2000), subjectType: st, subjectId: st && d.subjectId ? String(d.subjectId) : null, participants: Array.isArray(d.participants) ? d.participants.map(String) : [] };
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!canConvene(data.level, ctx.roles)) throw new Error("Tu rol no puede convocar este nivel de debate");
    const r = await runDebateCore(ctx, data);
    return { id: r.id };
  });
