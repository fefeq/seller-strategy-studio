import { guideState, inactive, suggestionAssignee } from "@/lib/setup-guide";
import type { Detector } from "../types";
import { setupStepLink } from "../resolve";

/**
 * Next step of the guide: first pending in the fixed order, skipping what the company postponed (SDD strategy-setup-guided-next-step).
 * A suggestion without an owner is seen by every member, so a step only some roles can complete goes to one of them
 * (suggestionAssignee) and an AE never sees «Completa: cuota». Without the team in the snapshot it stays company-wide, as before.
 */
export const setupIncomplete: Detector = (s) => {
  const g = guideState(s.setup, s.setupSnoozes ?? [], s.now);
  if (!g.next) return [];
  const who = s.members ? suggestionAssignee(g.next.id, s.members) : { user_id: null };
  if (!who) return [];
  // A company that left the guide for over a day gets it first. A next step exists by construction, whoever it goes to.
  const stalled = inactive(s.setupActivityAt, s.now);
  // A step whose postponement ended gets a new key with the instant it ended (epoch seconds): suggestions are unique per (company, key),
  // so the plain key would hit the row the postponement closed, or one the person dismissed before. Seconds, not the day, so that
  // postponing and clearing it twice on the same day gives two different suggestions. The step stays the second part of the key.
  const ended = (s.setupSnoozes ?? []).find((x) => x.step_id === g.next!.id);
  return [{
    detector: "setup_incomplete",
    dedupe_key: ended ? `setup_incomplete:${g.next.id}:${Math.floor(new Date(ended.snoozed_until).getTime() / 1000)}` : `setup_incomplete:${g.next.id}`,
    priority: g.pct < 50 || stalled ? 1 : 3,
    title: `Completa: ${g.next.label}`,
    // No percentage here: a stored suggestion would freeze it, and the sidebar and Inicio show the live one.
    body: `${g.next.why} Esto desbloquea: ${g.next.unlocks}.`,
    link: setupStepLink(g.next.id),
    action: null,
    user_id: who.user_id,
  }];
};
