import type { Detector, Snapshot, Suggestion } from "./types";
import { staleDeal } from "./detectors/stale-deal";
import { pastCloseDate } from "./detectors/past-close-date";
import { lowCoverage } from "./detectors/low-coverage";
import { meddpiccGaps } from "./detectors/meddpicc-gaps";
import { meetingNoPrep } from "./detectors/meeting-no-prep";
import { noDecisionMaker } from "./detectors/no-decision-maker";
import { trialConversion } from "./detectors/trial-conversion";
import { setupIncomplete } from "./detectors/setup-incomplete";
import { registrationExpiring } from "./detectors/registration-expiring";
import { lateLeads } from "./detectors/late-leads";
import { followupSequence } from "./detectors/followup-sequence";
import { meetingNoNotes } from "./detectors/meeting-no-notes";
import { unassignedAccounts } from "./detectors/unassigned-accounts";
import { accountSignal } from "./detectors/account-signal";
import { productQualified, usageDrop } from "./detectors/product-usage";

/** Adding a rule = adding a file in ./detectors and listing it here. */
export const DETECTORS: Detector[] = [staleDeal, pastCloseDate, lowCoverage, meddpiccGaps, meetingNoPrep, noDecisionMaker, trialConversion, setupIncomplete, registrationExpiring, lateLeads, followupSequence, meetingNoNotes, unassignedAccounts, accountSignal, productQualified, usageDrop];

export function detect(s: Snapshot): Suggestion[] {
  const out = DETECTORS.flatMap((d) => d(s));
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.dedupe_key) ? false : (seen.add(x.dedupe_key), true)));
}

/** Top N suggestions for the daily digest: priority first, then newest. */
export function digest<T extends { priority: number; created_at: string }>(items: T[], n = 3): T[] {
  return [...items].sort((a, b) => a.priority - b.priority || b.created_at.localeCompare(a.created_at)).slice(0, n);
}

export type { Snapshot, Suggestion } from "./types";
