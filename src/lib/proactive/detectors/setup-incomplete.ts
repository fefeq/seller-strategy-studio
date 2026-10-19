import { setupStatus } from "@/lib/setup-schema";
import type { Detector } from "../types";

/** Next most valuable missing piece of strategy data. */
export const setupIncomplete: Detector = (s) => {
  const st = setupStatus(s.setup);
  if (!st.next) return [];
  return [{
    detector: "setup_incomplete",
    dedupe_key: `setup_incomplete:${st.next.id}`,
    priority: st.pct < 50 ? 1 : 3,
    title: `Completa: ${st.next.label}`,
    body: `Tu estrategia está al ${st.pct}%. Esto desbloquea: ${st.next.unlocks}.`,
    link: "/setup",
    action: null,
    user_id: null,
  }];
};
