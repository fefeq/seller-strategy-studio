// Debates and deep reviews (server-side cores). Shared by the screen functions and the background runner; every
// query filters by the company and inserts carry org_id, so they work with the user's or the admin client.
import { ask } from "@/lib/ai-gateway";
import { companyContext, STYLE, subjectData } from "@/lib/bmad/drafting";
import { MANDATORY_RULE } from "@/lib/bmad/sources";
import { getPersona } from "@/lib/bmad/personas";
import {
  DEBATE_LEVELS,
  resolveParticipants,
  withRebuttal,
  type DebateLevel,
} from "@/lib/bmad/teams";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import type { Json } from "@/integrations/supabase/types";

type Ctx = ToolCtx & { orgName: string };

export const REVIEW_METHOD_TEXT: Record<string, string> = {
  premortem: "Pre-mortem: imagina que dentro de 6 meses esto ha fracasado y explica por qué.",
  redteam: "Red team: ataca el documento como lo haría el competidor más fuerte.",
  first_principles:
    "Primeros principios: cuestiona cada supuesto y reconstruye desde lo que sabemos seguro.",
  socratic: "Preguntas socráticas: las preguntas incómodas que un consejero haría.",
  power_map: "Mapa de poder: quién decide, quién bloquea y qué intereses mueven a cada parte.",
};

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings", "revised"],
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "issue", "fix"],
        properties: {
          severity: { type: "string", enum: ["alta", "media", "baja"] },
          issue: { type: "string" },
          fix: { type: "string" },
        },
      },
    },
    revised: {
      type: "string",
      description: "Documento completo revisado en markdown con los cambios aplicados",
    },
  },
};

export type DeepReview = {
  summary: string;
  findings: { severity: string; issue: string; fix: string }[];
  revised: string;
};

export async function deepReviewCore(
  ctx: Ctx,
  data: { artifactId: string; method: string },
): Promise<DeepReview> {
  const method = REVIEW_METHOD_TEXT[data.method];
  if (!method) throw new Error("Método no válido");
  const art = await subjectData(ctx.db, ctx.orgId, "artifact", data.artifactId);
  if (!art) throw new Error("Documento no encontrado");
  const cc = await companyContext(ctx.db, ctx.orgId);
  const raw = await ask(
    `Eres un revisor GTM senior. Aplica este método al documento: ${method} Devuelve de 3 a 7 hallazgos ordenados por severidad y el documento completo revisado. ${STYLE} ${MANDATORY_RULE} Si el documento contradice alguna regla obligatoria, ese es un hallazgo de severidad alta.`,
    JSON.stringify({ documento: art, contexto: cc }),
    { effort: "medium", schema: { name: "deep_review", schema: REVIEW_SCHEMA } },
  );
  try {
    return JSON.parse(raw) as DeepReview;
  } catch {
    throw new Error("La IA no devolvió una revisión válida. Inténtalo de nuevo.");
  }
}

const SYNTH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "agreements", "disagreements", "risks", "actions"],
  properties: {
    summary: { type: "string" },
    agreements: { type: "array", items: { type: "string" } },
    disagreements: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "owner_persona", "due_in_days"],
        properties: {
          title: { type: "string" },
          owner_persona: { type: "string" },
          due_in_days: { type: "integer" },
        },
      },
    },
  },
};

export type DebateInput = {
  level: DebateLevel;
  topic: string;
  subjectType: string | null;
  subjectId: string | null;
  participants: string[];
};

/** Two rounds (the second only with enough people) and a synthesis; saved in debates. `step` reports progress. */
export async function runDebateCore(
  ctx: Ctx,
  data: DebateInput,
  step: (s: string) => Promise<void> = async () => undefined,
) {
  const ids = resolveParticipants(data.level, data.participants);
  const [cc, subject] = await Promise.all([
    companyContext(ctx.db, ctx.orgId),
    subjectData(ctx.db, ctx.orgId, data.subjectType, data.subjectId),
  ]);
  const shared = JSON.stringify({
    empresa: ctx.orgName,
    moneda: ctx.currency,
    tema: data.topic,
    sujeto: subject,
    contexto: cc,
  });
  const speak = (pid: string, round: string) => {
    const p = getPersona(pid)!;
    return ask(
      `Eres ${p.name} (${p.title}), personaje inspirado en ${p.inspiredBy}, en una mesa de debate "${DEBATE_LEVELS[data.level].label}" de Nokko. ${p.tone} Tu foco: ${p.focus} ${round} Máximo 120 palabras, en primera persona, sin saludos. ${STYLE} ${MANDATORY_RULE}`,
      shared,
      { effort: "low" },
    ).then((t) => ({ persona: pid, round: round.startsWith("Ronda 1") ? 1 : 2, text: t.trim() }));
  };
  await step("Ronda 1");
  const r1 = await Promise.all(
    ids.map((id) =>
      speak(id, "Ronda 1: da tu postura y tu recomendación principal desde tu papel."),
    ),
  );
  let turns = r1;
  if (withRebuttal(ids)) {
    await step("Ronda 2 (réplicas)");
    const said = r1.map((t) => `${getPersona(t.persona)!.name}: ${t.text}`).join("\n\n");
    const r2 = await Promise.all(
      ids.map((id) =>
        speak(
          id,
          `Ronda 2 (réplica): esto dijeron los demás:\n${said}\nResponde a la postura con la que más discrepes y ajusta tu recomendación.`,
        ),
      ),
    );
    turns = [...r1, ...r2];
  }
  await step("Síntesis");
  const raw = await ask(
    `Eres Nokko, moderador del debate. Sintetiza: resumen, acuerdos, desacuerdos, riesgos y de 3 a 6 acciones concretas (owner_persona = id de uno de: ${ids.join(", ")}). ${STYLE} ${MANDATORY_RULE}`,
    JSON.stringify({
      tema: data.topic,
      turnos: turns.map((t) => ({
        quien: getPersona(t.persona)!.name,
        ronda: t.round,
        texto: t.text,
      })),
    }),
    { effort: "low", schema: { name: "debate_synthesis", schema: SYNTH_SCHEMA } },
  );
  let synthesis: { summary?: string; actions?: unknown[] };
  try {
    synthesis = JSON.parse(raw);
  } catch {
    throw new Error("La IA no devolvió la síntesis. Inténtalo de nuevo.");
  }
  const { data: row, error } = await ctx.db
    .from("debates")
    .insert({
      org_id: ctx.orgId,
      level: data.level,
      topic: data.topic,
      subject_type: data.subjectType,
      subject_id: data.subjectId,
      participants: ids,
      turns: turns as unknown as Json,
      synthesis: synthesis as unknown as Json,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: row.id as string, actions: synthesis.actions?.length ?? 0 };
}
