// F2 · Experiment rules (CA-27, CA-28, CA-30). Fixed rules, no AI. They need `strategy.experiments` in the snapshot.
import { closeRuleMissing, resultOverdue, reviewDue } from "@/lib/experiments";
import type { Detector } from "../types";

export const experimentCloseRule: Detector = (s) => closeRuleMissing(s.strategy?.experiments ?? []);
export const experimentReview: Detector = (s) => reviewDue(s.strategy?.experiments ?? [], s.now);
export const experimentOverdue: Detector = (s) =>
  resultOverdue(s.strategy?.experiments ?? [], s.now);
