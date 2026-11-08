// SDD-20261106-hub-search, U-2. Pure rules of the Conocimiento search box (tested in hub-search.test.ts).
import type { SearchResult } from "@/lib/text-search";

/** q from the URL or the box: blank or not text is no search. Text is never trimmed, so «decision ventas» can be typed. */
export function cleanQuery(q: unknown): string | undefined {
  return typeof q === "string" && q.trim() !== "" ? q : undefined;
}

/** The URL search after typing: q replaced or removed, every other parameter (doc, seccion) kept. */
export function nextSearch<S extends object>(prev: S, q: string): S {
  const { q: _old, ...rest } = prev as S & { q?: string };
  const clean = cleanQuery(q);
  return (clean === undefined ? rest : { ...rest, q: clean }) as unknown as S;
}

/** Number beside each section: documents in it, or matches in it while a search is active (results !== null). */
export function sectionCounts(
  ids: readonly string[],
  docs: { section: string }[],
  results: SearchResult<unknown>[] | null,
): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const sections = results ? results.map((r) => r.section) : docs.map((d) => d.section);
  for (const s of sections) if (s in counts) counts[s] = (counts[s] ?? 0) + 1;
  return counts;
}

export const truncatedNotice = (n: number) =>
  `Se muestran los primeros ${n} documentos; la búsqueda no incluye el resto.`;

export const emptySearchText = (q: string) =>
  `Nada coincide con «${q.trim()}». Prueba con otra palabra o crea un documento con «+ Nuevo».`;
