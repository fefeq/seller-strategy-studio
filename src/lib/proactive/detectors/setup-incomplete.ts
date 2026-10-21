import { setupStatus } from "@/lib/setup-schema";
import type { Detector } from "../types";
import { setupStepLink } from "../resolve";

/** Next most valuable missing piece of strategy data. */
export const setupIncomplete: Detector = (s) => {
  const st = setupStatus(s.setup);
  if (!st.next) return [];
  return [{
    detector: "setup_incomplete",
    dedupe_key: `setup_incomplete:${st.next.id}`,
    priority: st.pct < 50 ? 1 : 3,
    title: `Completa: ${st.next.label}`,
    // No percentage here: a stored suggestion would freeze it, and the sidebar and Inicio show the live one.
    body: `Es lo que más pesa de lo que falta en tu estrategia. Esto desbloquea: ${st.next.unlocks}.`,
    link: setupStepLink(st.next.id),
    action: null,
    user_id: null,
  }];
};
