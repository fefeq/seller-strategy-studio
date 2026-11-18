// SDD-20261118-ux-legibilidad-pantallas-diarias · U-2: one origin per lead source, whatever its case or spacing.
// Only case and whitespace are folded (an accent makes a different origin); nothing is written back, the lead keeps
// the text it was saved with. Pure and tested (lead-source.test.ts).
import { funnelBy, type DealOutcome, type FunnelGroup, type LeadRow } from "@/lib/lead-funnel";

export const NO_SOURCE = "Sin origen";
const NO_SOURCE_KEY = NO_SOURCE.toLowerCase();

/** Key to compare origins by, plus the text to show when nothing better is known. */
export function normalizeLeadSource(raw: string | null | undefined): {
  key: string;
  label: string;
} {
  // NFC so a composed and a decomposed accent are the same origin; zero-width characters are dropped and \s folds the
  // non-breaking space.
  const label = (raw ?? "")
    .normalize("NFC")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!label) return { key: NO_SOURCE_KEY, label: NO_SOURCE };
  return { key: label.toLowerCase(), label };
}

/**
 * The label every lead of the same origin groups under: its most frequent spelling; on a tie the first in code-unit
 * order (a capital letter sorts before its lower case, so «Manual» beats «manual»). «Sin origen» always keeps its own
 * label, even when leads were saved with the literal text in lower case. Pass it to funnelBy as the key.
 */
export function sourceLabeler(
  leads: Pick<LeadRow, "source">[],
): (l: Pick<LeadRow, "source">) => string {
  const spellings = new Map<string, Map<string, number>>();
  for (const l of leads) {
    const { key, label } = normalizeLeadSource(l.source);
    const forms = spellings.get(key) ?? new Map<string, number>();
    forms.set(label, (forms.get(label) ?? 0) + 1);
    spellings.set(key, forms);
  }
  const chosen = new Map<string, string>();
  for (const [key, forms] of spellings) {
    const best = [...forms.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    )[0]!;
    chosen.set(key, key === NO_SOURCE_KEY ? NO_SOURCE : best[0]);
  }
  return (l) => {
    const { key, label } = normalizeLeadSource(l.source);
    return chosen.get(key) ?? label;
  };
}

/** The lead funnel split by origin: one group per origin whatever its case, spacing or accent encoding. */
export function funnelBySource(leads: LeadRow[], deals: DealOutcome[]): FunnelGroup[] {
  return funnelBy(leads, deals, sourceLabeler(leads));
}
