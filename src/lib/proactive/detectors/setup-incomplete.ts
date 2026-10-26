import { guideState, nudgeDue } from "@/lib/setup-guide";
import type { Detector } from "../types";
import { setupStepLink } from "../resolve";

/** Next step of the guide: first pending in the fixed order, skipping what the company postponed (SDD strategy-setup-guided-next-step). */
export const setupIncomplete: Detector = (s) => {
  const g = guideState(s.setup, s.setupSnoozes ?? [], s.now);
  if (!g.next) return [];
  // A company that left the guide for over a day gets it first; the company-wide suggestion has no role, so it is judged as a leader.
  const stalled = nudgeDue(g, "owner", s.setupActivityAt ?? null, s.now);
  return [{
    detector: "setup_incomplete",
    dedupe_key: `setup_incomplete:${g.next.id}`,
    priority: g.pct < 50 || stalled ? 1 : 3,
    title: `Completa: ${g.next.label}`,
    // No percentage here: a stored suggestion would freeze it, and the sidebar and Inicio show the live one.
    body: `${g.next.why} Esto desbloquea: ${g.next.unlocks}.`,
    link: setupStepLink(g.next.id),
    action: null,
    user_id: null,
  }];
};
