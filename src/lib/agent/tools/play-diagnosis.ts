// Diagnóstico de plays (SDD-20261112-diagnosis-in-chat): diagnose_play_teams (read, any member); save_play_plan comes next and
// add_default_rules is held:: an existing guard (default-rules.test.ts, CA-12) lists the only files that may add base rules.
// Part of the single registry in ../tools.ts, right after ONBOARDING_TOOLS.
// planFor is shared by diagnose_play_teams and save_play_plan, so what is saved is what would have been shown with the same data. It reads
// the company's state, the play rows and the plan; it has no voice, no rules and no writes. Nothing here activates a play: save_play_plan
// only leaves suggestions whose action (set_play_enabled) runs when a person approves each one. Voice is only counted, never returned.
import { z } from "zod";
import { def } from "../tool-kit";
import type { AgentTool, ToolCtx } from "../tool-kit";
import { onboardingStatusFor } from "./onboarding";
import { playStateRows } from "./plays";
import { missingDefaultRuleTitles } from "@/lib/default-rules";
import { loadVoice, VOICE_MAX_EXAMPLES } from "@/lib/knowledge-voice";
import { CATALOG } from "@/lib/plays/catalog";
import {
  BOTTLENECK_WORD,
  TEAM_IDS,
  playDiagnosisText,
  prioritizeTeams,
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

// Words of section 9 for the tools (CA-8).
const PLAYS_READ_FAILED =
  "No he podido comprobar qué plays tienes activados; inténtalo de nuevo en un momento.";

/** The six options of the first question, as the description carries them for Telegram and MCP, where there is no flow (CA-20). */
const BOTTLENECK_OPTIONS = Object.values(BOTTLENECK_WORD)
  .map((w) => `«${w}»`)
  .join(" ");
const DIAGNOSE_DESCRIPTION = `Solo lee. Diagnóstico de plays: con el estado de la empresa, los plays que tiene activados, su voz y sus reglas base, ordena los seis equipos de plays con motivos fijos y da el plan de activación, por fase y dependencias. Si la empresa no está lista, dice qué falta y no propone nada. En la conversación, pregunta antes cuál es su cuello de botella y qué otras tareas quiere resolver; las opciones del cuello de botella son: ${BOTTLENECK_OPTIONS} o «Ninguno de estos» (bottleneck null). Después cuenta el resultado a partir de resumen: no añadas equipos de plays, plays, motivos ni cifras que no estén en la respuesta. De la voz solo cuenta los ejemplos: los mensajes de voz se pegan en Conocimiento › Voz, nunca en el chat. No activa nada: el plan se guarda con save_play_plan y las reglas base que falten se añaden con add_default_rules.`;

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
];
