// SDD-20261109-deals-no-source U-2 (NK-0107): the one place that names a deal source. «Sin origen» is a null source; NO_SOURCE is only the
// grouping key Métricas uses (metrics-quarter.ts) and is translated to text here. This file never writes that key's literal.
import { NO_SOURCE } from "./metrics-quarter";

export { NO_SOURCE };

/** What the GTM advisor reads for a deal without source (lowercase, like the other values the model reads). */
export const AI_NO_SOURCE = "sin origen";

const NO_SOURCE_LABEL = "Sin origen";

export const DEAL_SOURCE_LABELS: Record<string, string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  partner: "Partner",
  plg: "Producto (PLG)",
  event: "Evento",
  referral: "Referido",
};

/** The six keys of DEAL_SOURCE_LABELS, in the same order, as a tuple for z.enum (deal-source.test.ts keeps them equal). */
export const DEAL_SOURCE_KEYS = [
  "outbound",
  "inbound",
  "partner",
  "plg",
  "event",
  "referral",
] as const;

/** Label of a source key: null or the grouping key → «Sin origen»; a free text (leads intake) is returned as it is. */
export function dealSourceLabel(key: string | null | undefined): string {
  if (key == null || key === NO_SOURCE) return NO_SOURCE_LABEL;
  return DEAL_SOURCE_LABELS[key] ?? key;
}

/** Options of the «Fuente» select: «Sin origen» (empty key) first, the six known, and the current free text as its own option. Never picks outbound. */
export function dealSourceOptions(current: string | null | undefined): Record<string, string> {
  const o: Record<string, string> = { "": NO_SOURCE_LABEL, ...DEAL_SOURCE_LABELS };
  if (current && current !== NO_SOURCE && !(current in o)) o[current] = current;
  return o;
}
