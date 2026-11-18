// SDD-20261118-ux-legibilidad-pantallas-diarias · U-2: one origin per lead source, whatever its case or spacing.
// Only case and whitespace are folded (an accent makes a different origin); nothing is written back, the lead keeps
// the text it was saved with. Pure and tested (lead-source.test.ts).
import type { LeadRow } from "@/lib/lead-funnel";

export const NO_SOURCE = "Sin origen";

/** Key to compare origins by, plus the text to show when nothing better is known. */
export function normalizeLeadSource(raw: string | null | undefined): {
  key: string;
  label: string;
} {
  const label = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!label) return { key: NO_SOURCE.toLowerCase(), label: NO_SOURCE };
  return { key: label.toLowerCase(), label };
}

const hasCapital = (s: string) => s !== s.toLowerCase();

/**
 * The label every lead of the same origin groups under: its most frequent spelling; on a tie the one with a
 * capital letter, then alphabetical order. Pass it to funnelBy as the key.
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
      (a, b) =>
        b[1] - a[1] ||
        Number(hasCapital(b[0])) - Number(hasCapital(a[0])) ||
        (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    )[0]!;
    chosen.set(key, best[0]);
  }
  return (l) => {
    const { key, label } = normalizeLeadSource(l.source);
    return chosen.get(key) ?? label;
  };
}
