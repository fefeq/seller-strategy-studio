import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ask } from "@/lib/ai-gateway";
import type { Db } from "@/lib/org-data";
import { companyContext, draftArtifactCore, STYLE, subjectData } from "@/lib/bmad/drafting";
import { userCtx } from "@/lib/agent.functions";
import { ARTIFACTS, type ArtifactKind } from "@/lib/bmad/workflows";
import { getPersona } from "@/lib/bmad/personas";
import { canConvene, DEBATE_LEVELS, resolveParticipants, withRebuttal, type DebateLevel } from "@/lib/bmad/teams";

const KINDS = Object.keys(ARTIFACTS) as ArtifactKind[];
const LEVELS = Object.keys(DEBATE_LEVELS) as DebateLevel[];

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

const METHODS: Record<string, string> = {
  premortem: "Pre-mortem: imagina que dentro de 6 meses esto ha fracasado y explica por qué.",
  redteam: "Red team: ataca el documento como lo haría el competidor más fuerte.",
  first_principles: "Primeros principios: cuestiona cada supuesto y reconstruye desde lo que sabemos seguro.",
  socratic: "Preguntas socráticas: las preguntas incómodas que un consejero haría.",
  power_map: "Mapa de poder: quién decide, quién bloquea y qué intereses mueven a cada parte.",
};
export const REVIEW_METHODS = Object.keys(METHODS);

const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "findings", "revised"],
  properties: {
    summary: { type: "string" },
    findings: { type: "array", items: { type: "object", additionalProperties: false, required: ["severity", "issue", "fix"], properties: { severity: { type: "string", enum: ["alta", "media", "baja"] }, issue: { type: "string" }, fix: { type: "string" } } } },
    revised: { type: "string", description: "Documento completo revisado en markdown con los cambios aplicados" },
  },
};

export const deepReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { artifactId: string; method: string }) => {
    if (!METHODS[d.method]) throw new Error("Método no válido");
    return { artifactId: String(d.artifactId), method: d.method };
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const art = await subjectData(ctx.db, ctx.orgId, "artifact", data.artifactId);
    if (!art) throw new Error("Documento no encontrado");
    const cc = await companyContext(ctx.db, ctx.orgId);
    const raw = await ask(
      `Eres un revisor GTM senior. Aplica este método al documento: ${METHODS[data.method]} Devuelve de 3 a 7 hallazgos ordenados por severidad y el documento completo revisado. ${STYLE}`,
      JSON.stringify({ documento: art, contexto: cc }),
      { effort: "medium", schema: { name: "deep_review", schema: REVIEW_SCHEMA } },
    );
    try { return JSON.parse(raw) as { summary: string; findings: { severity: string; issue: string; fix: string }[]; revised: string }; }
    catch { throw new Error("La IA no devolvió una revisión válida. Inténtalo de nuevo."); }
  });

const SYNTH_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "agreements", "disagreements", "risks", "actions"],
  properties: {
    summary: { type: "string" },
    agreements: { type: "array", items: { type: "string" } },
    disagreements: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "owner_persona", "due_in_days"], properties: { title: { type: "string" }, owner_persona: { type: "string" }, due_in_days: { type: "integer" } } } },
  },
};

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
    const ids = resolveParticipants(data.level, data.participants);
    const [cc, subject] = await Promise.all([companyContext(ctx.db, ctx.orgId), subjectData(ctx.db, ctx.orgId, data.subjectType, data.subjectId)]);
    const shared = JSON.stringify({ empresa: ctx.orgName, moneda: ctx.currency, tema: data.topic, sujeto: subject, contexto: cc });
    const speak = (pid: string, round: string) => {
      const p = getPersona(pid)!;
      return ask(`Eres ${p.name} (${p.title}), personaje inspirado en ${p.inspiredBy}, en una mesa de debate "${DEBATE_LEVELS[data.level].label}" de NOKKO. ${p.tone} Tu foco: ${p.focus} ${round} Máximo 120 palabras, en primera persona, sin saludos. ${STYLE}`, shared, { effort: "low" }).then((t) => ({ persona: pid, round: round.startsWith("Ronda 1") ? 1 : 2, text: t.trim() }));
    };
    const r1 = await Promise.all(ids.map((id) => speak(id, "Ronda 1: da tu postura y tu recomendación principal desde tu papel.")));
    let turns = r1;
    if (withRebuttal(ids)) {
      const said = r1.map((t) => `${getPersona(t.persona)!.name}: ${t.text}`).join("\n\n");
      const r2 = await Promise.all(ids.map((id) => speak(id, `Ronda 2 (réplica): esto dijeron los demás:\n${said}\nResponde a la postura con la que más discrepes y ajusta tu recomendación.`)));
      turns = [...r1, ...r2];
    }
    const raw = await ask(
      `Eres NOKKO, moderador del debate. Sintetiza: resumen, acuerdos, desacuerdos, riesgos y de 3 a 6 acciones concretas (owner_persona = id de uno de: ${ids.join(", ")}). ${STYLE}`,
      JSON.stringify({ tema: data.topic, turnos: turns.map((t) => ({ quien: getPersona(t.persona)!.name, ronda: t.round, texto: t.text })) }),
      { effort: "low", schema: { name: "debate_synthesis", schema: SYNTH_SCHEMA } },
    );
    let synthesis: unknown;
    try { synthesis = JSON.parse(raw); } catch { throw new Error("La IA no devolvió la síntesis. Inténtalo de nuevo."); }
    const { data: row, error } = await ctx.db.from("debates").insert({ org_id: ctx.orgId, level: data.level, topic: data.topic, subject_type: data.subjectType, subject_id: data.subjectId, participants: ids, turns: turns as any, synthesis: synthesis as any }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
