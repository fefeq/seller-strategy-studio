// F1 · Positioning rule: CA-21 a required positioning field is empty. No AI (CA-24).
import { POSITIONING_FIELDS } from "@/lib/setup-schema";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";
import type { Detector, Snapshot } from "../types";
import { setupIncomplete } from "./setup-incomplete";

/** Required = the fields the onboarding checklist asks for (setup item «positioning»). */
export const missingPositioning = (s: Pick<Snapshot, "setup">) => POSITIONING_FIELDS.filter(([k]) => { const v = s.setup.positioning?.[k]; return typeof v === "string" ? v.trim() === "" : v == null; });

export function makePositioningMissing(setup: Detector = setupIncomplete): Detector {
  return (s) => {
    if (!s.strategy) return [];
    const missing = missingPositioning(s);
    if (!missing.length) return [];
    // Not duplicated: the setup notice for positioning already asks for it.
    if (setup(s).some((x) => x.dedupe_key === "setup_incomplete:positioning")) return [];
    return [buildStrategySuggestion({
      element: "positioning", kind: "missing_data", action_type: "data_to_complete", cause: "missing_fields", priority: 3,
      title: `Completa ${missing.length === 1 ? "un campo" : `${missing.length} campos`} del posicionamiento`,
      body: `Faltan: ${missing.map(([, l]) => l).join(", ")}.`,
      evidence: [], link: "/strategy?tab=positioning",
    })];
  };
}
export const positioningMissing = makePositioningMissing();
