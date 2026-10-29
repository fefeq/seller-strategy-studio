import { parseStrategy, type StrategySuggestion } from "@/lib/strategy-suggestions";

/** Stored suggestions are re-validated on read: a row the rules cannot read is dropped, never shown. */
export const readSuggestions = (v: unknown): StrategySuggestion[] =>
  (Array.isArray(v) ? v : []).filter(
    (s): s is StrategySuggestion =>
      !!s && typeof s === "object" && !!parseStrategy((s as { strategy?: unknown }).strategy),
  );
