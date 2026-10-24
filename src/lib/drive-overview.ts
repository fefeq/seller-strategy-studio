// «Drive por cuenta» (Conocimiento): every account folder's documents with their AI summary and date.
// Pure so the screen and its tests agree on when a summary is still valid.

export type OverviewFile = { id: string; name: string; kind: string; isFolder: boolean; url: string | null; modified: string | null; readable: boolean };
export type SummaryRow = { file_id: string; summary: string; file_modified_at: string | null };
export type FolderListing = {
  accountId: string;
  accountName: string;
  domain: string | null;
  folder: { id: string; name: string; url: string | null } | null;
  files: OverviewFile[];
  error?: string | null;
};
export type SummaryState = "fresh" | "stale" | "missing";

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** A summary is valid while the file has not changed in Drive since it was written. */
export function summaryState(fileModified: string | null, row: SummaryRow | undefined): SummaryState {
  if (!row) return "missing";
  const a = time(fileModified);
  const b = time(row.file_modified_at);
  if (Number.isNaN(a) || Number.isNaN(b)) return "fresh";
  return Math.abs(a - b) < 1000 ? "fresh" : "stale";
}

export function buildOverview(listings: FolderListing[], summaries: SummaryRow[]) {
  const byFile = new Map(summaries.map((s) => [s.file_id, s]));
  const accounts = listings.map((l) => {
    const docs = l.files
      .filter((f) => !f.isFolder)
      .map((f) => {
        const row = byFile.get(f.id);
        const state = f.readable ? summaryState(f.modified, row) : "missing";
        return { ...f, summary: row?.summary ?? null, state };
      })
      .sort((a, b) => (time(b.modified) || 0) - (time(a.modified) || 0));
    return { ...l, docs, latest: docs[0]?.modified ?? null };
  });
  accounts.sort((a, b) => (time(b.latest) || 0) - (time(a.latest) || 0) || a.accountName.localeCompare(b.accountName, "es"));
  const all = accounts.flatMap((a) => a.docs.map((d) => ({ ...d, accountId: a.accountId })));
  const pending = all.filter((d) => d.readable && d.state !== "fresh");
  return {
    accounts,
    totals: { accounts: accounts.length, docs: all.length, pending: pending.length },
    pending: pending.map((d) => ({ fileId: d.id, accountId: d.accountId })),
  };
}

/** The model's summary as plain prose: no headings, bullets or wrapping quotes, at most 600 characters. */
export function cleanSummary(raw: string): string {
  const text = raw
    .replace(/^#+\s*/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["«“](.*)["»”]$/, "$1")
    .trim();
  if (text.length <= 600) return text;
  const cut = text.slice(0, 600);
  const end = cut.lastIndexOf(". ");
  return end > 200 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

export const SUMMARY_PROMPT =
  "Resume el documento en español neutro en dos o tres frases: qué es (propuesta, plan de cuenta, notas, contrato…), para qué sirve y la conclusión o cifra clave si la hay. Sin títulos, sin listas, sin inventar nada que no esté en el texto.";
