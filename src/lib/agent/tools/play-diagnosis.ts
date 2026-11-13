// Diagnóstico de plays (SDD-20261112-diagnosis-in-chat): diagnose_play_teams (read, any member), save_play_plan and add_default_rules
// (write, owner and sales_leader). Part of the single registry in ../tools.ts, right after ONBOARDING_TOOLS.
// planFor is shared by diagnose_play_teams and save_play_plan, so what is saved is what would have been shown with the same data. It reads
// the company's state, the play rows and the plan; it has no voice, no rules and no writes. Nothing here activates a play: save_play_plan
// only leaves suggestions whose action (set_play_enabled) runs when a person approves each one. Voice is only counted, never returned.
import { z } from "zod";
import { def, ok } from "../tool-kit";
import type { AgentTool, ToolCtx } from "../tool-kit";
import { onboardingStatusFor } from "./onboarding";
import { playStateRows } from "./plays";
import type { Json } from "@/integrations/supabase/types";
import { addDefaultRulesCore, missingDefaultRuleTitles } from "@/lib/default-rules";
import { loadVoice, VOICE_MAX_EXAMPLES } from "@/lib/knowledge-voice";
import { CATALOG } from "@/lib/plays/catalog";
import {
  BOTTLENECK_WORD,
  PLAYS_DIAGNOSIS_DETECTOR,
  TEAM_IDS,
  partitionPlanSuggestions,
  playDiagnosisText,
  prioritizeTeams,
  type ActivationStep,
  type DiagnosisAnswers,
  type ReglasInfo,
  type VozInfo,
} from "@/lib/plays/diagnosis";
import { recommendablePlays } from "@/lib/plays/recommend";
import { canTogglePlays } from "@/lib/plays/status";
import { PLAY_TEAMS, teamPlan } from "@/lib/plays/teams";

/**
 * The company's state and the prioritised teams. `playsOk: false` when the play rows could not be read: no plan is built from defaults.
 * A failed setup read throws (inside onboardingStatusFor). `answers` are validated by the tool schema, not here.
 */
export async function planFor(c: ToolCtx, answers: DiagnosisAnswers) {
  const [status, states] = await Promise.all([onboardingStatusFor(c), playStateRows(c)]);
  if (!states.ok) return { playsOk: false as const };
  const plans = PLAY_TEAMS.map((t) => teamPlan(t, CATALOG, states.rows));
  const order = recommendablePlays(CATALOG).recommended.map((p) => p.id);
  const result = prioritizeTeams({ status, plans, answers, order });
  return { playsOk: true as const, status, result };
}

/** Voice is counted, never returned: a failed read is `ok: false`, never «0 ejemplos». */
async function vozFor(c: ToolCtx): Promise<VozInfo> {
  const v = await loadVoice(c);
  if (!v.ok) return { ok: false };
  const ejemplos = v.examples.length;
  return { ok: true, ejemplos, faltan: Math.max(0, VOICE_MAX_EXAMPLES - ejemplos) };
}

/** The titles of the base rules the company lacks; a failed read is `ok: false`, never «all missing» nor «none». */
async function reglasFor(c: ToolCtx): Promise<ReglasInfo> {
  try {
    return { ok: true, faltan: await missingDefaultRuleTitles(c) };
  } catch {
    return { ok: false };
  }
}

const ANSWERS = z.object({
  bottleneck: z
    .enum(TEAM_IDS)
    .nullable()
    .describe(
      "Id del equipo de plays que es hoy su cuello de botella, o null si ha dicho «Ninguno de estos»",
    ),
  wanted: z
    .array(z.enum(TEAM_IDS))
    .max(TEAM_IDS.length)
    .default([])
    .describe("Ids de los otros equipos de plays cuyas tareas quiere resolver (varios o ninguno)"),
});

// Words of section 9 for the tools (CA-8, CA-11, CA-14).
const PLAYS_READ_FAILED =
  "No he podido comprobar qué plays tienes activados; inténtalo de nuevo en un momento.";
const SAVE_PLAYS_READ_FAILED =
  "No he podido comprobar qué plays tienes activados; no guardo el plan.";
const NOTHING_TO_ACTIVATE = "No hay ningún play que activar en los equipos propuestos.";
const NOTHING_ACTIVATED =
  "Ningún play se ha activado: se activa cada uno cuando apruebes su sugerencia.";
const PLAN_LINK = "/plays?vista=equipos";

/** The six options of the first question, as the description carries them for Telegram and MCP, where there is no flow (CA-20). */
const BOTTLENECK_OPTIONS = Object.values(BOTTLENECK_WORD)
  .map((w) => `«${w}»`)
  .join(" ");
const DIAGNOSE_DESCRIPTION = `Solo lee. Diagnóstico de plays: con el estado de la empresa, los plays que tiene activados, su voz y sus reglas base, ordena los seis equipos de plays con motivos fijos y da el plan de activación, por fase y dependencias. Si la empresa no está lista, dice qué falta y no propone nada. En la conversación, pregunta antes cuál es su cuello de botella y qué otras tareas quiere resolver; las opciones del cuello de botella son: ${BOTTLENECK_OPTIONS} o «Ninguno de estos» (bottleneck null). Después cuenta el resultado a partir de resumen: no añadas equipos de plays, plays, motivos ni cifras que no estén en la respuesta. De la voz solo cuenta los ejemplos: los mensajes de voz se pegan en Conocimiento › Voz, nunca en el chat. No activa nada: el plan se guarda con save_play_plan y las reglas base que falten se añaden con add_default_rules. Una regla base falta si no hay una regla de equipo (no personal) con su título, sin distinguir mayúsculas ni espacios de los extremos.`;

const keyOf = (playId: string) => `${PLAYS_DIAGNOSIS_DETECTOR}:${playId}`;

/** Title, body and action of the suggestion of one play of the plan (section 9): no step number, the order lives in the chat only. */
function suggestionText(step: ActivationStep) {
  return {
    title: `Activa «${step.title}»`,
    body: `Del plan de tu diagnóstico de plays. Avanza: ${step.teams.join(", ")}. Al aprobarla se activa este play; nada más.`,
    action: {
      tool: "set_play_enabled",
      args: { play_id: step.play_id, enabled: true },
    } as unknown as Json,
  };
}

/** «Te he dejado N sugerencias nuevas…», then one sentence per category that has plays (each play named once), then the closing. */
function saveMessage(n: number, named: [string, string[]][]): string {
  const out = [
    n === 0
      ? "No he dejado ninguna sugerencia nueva."
      : n === 1
        ? "Te he dejado una sugerencia nueva en Sugerencias."
        : `Te he dejado ${n} sugerencias nuevas en Sugerencias.`,
  ];
  for (const [lead, titles] of named)
    if (titles.length) out.push(`${lead}: ${titles.map((t) => `«${t}»`).join(", ")}.`);
  out.push(NOTHING_ACTIVATED);
  return out.join(" ");
}

export const PLAY_DIAGNOSIS_TOOLS: AgentTool[] = [
  def({
    name: "diagnose_play_teams",
    kind: "read",
    description: DIAGNOSE_DESCRIPTION,
    input: ANSWERS,
    run: async (c, a) => {
      const [plan, voz, reglas_base] = await Promise.all([planFor(c, a), vozFor(c), reglasFor(c)]);
      if (!plan.playsOk) return { plays_ok: false, resumen: PLAYS_READ_FAILED };
      const canAct = canTogglePlays(c.roles).ok;
      return {
        ...plan.result,
        voz,
        reglas_base,
        resumen: playDiagnosisText(plan.result, { voz, reglas: reglas_base, canAct }),
      };
    },
  }),
  def({
    name: "save_play_plan",
    kind: "write",
    roles: ["owner", "sales_leader"],
    description:
      "Guarda el plan del diagnóstico de plays como sugerencias en Sugerencias: una por play a activar, cada una con la acción set_play_enabled, que solo se ejecuta si la persona la aprueba; no activa ningún play. Recalcula el plan con los datos del momento: usa las mismas respuestas que diagnose_play_teams. Repetirlo no duplica sugerencias: dice cuáles ya estaban abiertas, pospuestas o descartadas.",
    input: ANSWERS,
    summarize: () => "Guardar el plan de equipos de plays como sugerencias (no activa ningún play)",
    run: async (c, a) => {
      const plan = await planFor(c, a);
      if (!plan.playsOk) throw new Error(SAVE_PLAYS_READ_FAILED);
      if (!plan.result.ready)
        throw new Error(
          `Todavía no puedo guardar un plan: falta ${plan.result.missing.join("; ")}.`,
        );
      const steps = new Map(plan.result.activation.map((s) => [keyOf(s.play_id), s]));
      if (!steps.size) throw new Error(NOTHING_TO_ACTIVATE);
      const keys = [...steps.keys()];
      const rows = ok(
        await c.db
          .from("suggestions")
          .select("id,dedupe_key,status,user_id")
          .eq("org_id", c.orgId)
          .in("dedupe_key", keys),
      );
      const part = partitionPlanSuggestions({ keys, rows: rows ?? [], userId: c.userId });

      // No row when read: created, unless another person created it in between (ignoreDuplicates leaves theirs and returns nothing).
      const created = new Set<string>();
      if (part.create.length) {
        const inserted = ok(
          await c.db
            .from("suggestions")
            .upsert(
              part.create.map((k) => ({
                org_id: c.orgId,
                user_id: c.userId,
                detector: PLAYS_DIAGNOSIS_DETECTOR,
                dedupe_key: k,
                priority: 2,
                link: PLAN_LINK,
                ...suggestionText(steps.get(k)!),
              })),
              { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
            )
            .select("dedupe_key"),
        );
        for (const r of inserted ?? [])
          if (part.create.includes(r.dedupe_key)) created.add(r.dedupe_key);
      }
      // Approved or resolved (its play is paused today): reopened to the person who asks, unless someone decided it in between.
      const reopened = new Set<string>();
      for (const r of part.reopen) {
        const updated = ok(
          await c.db
            .from("suggestions")
            .update({
              status: "pending",
              user_id: c.userId,
              snoozed_until: null,
              notified_at: null,
              updated_at: new Date().toISOString(),
              ...suggestionText(steps.get(r.key)!),
            })
            .eq("org_id", c.orgId)
            .eq("id", r.id)
            .eq("status", r.status)
            .select("id"),
        );
        if (updated?.length) reopened.add(r.key);
      }
      const changed = [
        ...part.create.filter((k) => !created.has(k)),
        ...part.reopen.map((r) => r.key).filter((k) => !reopened.has(k)),
      ];
      const titles = (ks: string[]) => ks.map((k) => steps.get(k)!.title);
      return {
        mensaje: saveMessage(created.size + reopened.size, [
          ["Ya estaban abiertas", titles(part.ya_abiertas)],
          [
            "Están abiertas a nombre de otra persona y no las verás en tu Sugerencias",
            titles(part.de_otra_persona),
          ],
          ["Están pospuestas y no se pueden aprobar hasta que despierten", titles(part.pospuestas)],
          ["No he vuelto a dejar lo que descartaste", titles(part.descartadas)],
          ["Otra persona las cambió mientras guardaba", titles(changed)],
        ]),
        creadas: created.size,
        reabiertas: reopened.size,
        ya_abiertas: part.ya_abiertas.length,
        de_otra_persona: part.de_otra_persona.length,
        pospuestas: part.pospuestas.length,
        descartadas: part.descartadas.length,
        cambiadas_por_otra_persona: changed.length,
      };
    },
  }),
  def({
    name: "add_default_rules",
    kind: "write",
    roles: ["owner", "sales_leader"],
    description:
      "Añade a Conocimiento › Reglas las reglas base de NOKKO que la empresa todavía no tiene (tres Nunca, tres Siempre y tres Escalar), comparadas por título: si la empresa renombró o borró una regla base, se vuelve a añadir la original. No duplica las que conservan su título ni cambia ninguna regla existente. Solo cuenta las reglas de equipo (no las personales) y compara el título sin distinguir mayúsculas ni espacios de los extremos. Si no puede leer las reglas, no añade ninguna.",
    input: z.object({}),
    summarize: () => "Añadir las reglas base que falten a Reglas",
    run: async (c) => {
      const r = await addDefaultRulesCore(c);
      return {
        ...r,
        mensaje:
          r.added === 0
            ? "Ya tenías todas las reglas base."
            : r.added === 1
              ? // Coordinator's copy decision (agreement in number), applied to this sentence too.
                "He añadido 1 regla base a Reglas."
              : `He añadido ${r.added} reglas base a Reglas.`,
      };
    },
  }),
];
