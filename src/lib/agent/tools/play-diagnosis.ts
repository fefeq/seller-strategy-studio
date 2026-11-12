// Diagnóstico de plays (SDD-20261112-diagnosis-in-chat). Session 1: only the read core planFor; the tools are registered in the next session.
// planFor is shared by diagnose_play_teams and save_play_plan, so what is saved is what would have been shown with the same data. It reads
// the company's state, the play rows and the plan; it has no voice, no rules and no writes.
import type { ToolCtx } from "../tool-kit";
import { onboardingStatusFor } from "./onboarding";
import { playStateRows } from "./plays";
import { CATALOG } from "@/lib/plays/catalog";
import { prioritizeTeams, type DiagnosisAnswers } from "@/lib/plays/diagnosis";
import { recommendablePlays } from "@/lib/plays/recommend";
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
