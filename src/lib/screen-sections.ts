// SDD-20261106-ux-core-screens-pattern, U-4. Section ids of Conocimiento (/hub) and Theory U (/theory-u) in the URL (?seccion=).
// Ids are the internal ones (the values of knowledge_docs.section plus «drive», and the tab values), so no translation table is needed.

export const HUB_SECTIONS = [
  "company",
  "objections",
  "playbooks",
  "methodology",
  "campaigns",
  "skills",
  "rules",
  "voice",
  "drive",
] as const;
export const HUB_DEFAULT_SECTION = "company";

export const THEORY_U_SECTIONS = [
  "journey",
  "sensing",
  "listening",
  "clinic",
  "prototypes",
] as const;
export const THEORY_U_DEFAULT_SECTION = "journey";

/** The parameters the two screens keep in the URL (Theory U only uses seccion). */
export type SectionSearch = { doc?: string; q?: string; seccion?: string };

/** The id when it belongs to the screen, else undefined (an unknown id, another screen's id or a non-string is dropped). */
export function validSection(ids: readonly string[], value: unknown): string | undefined {
  return typeof value === "string" && ids.includes(value) ? value : undefined;
}

/** The section to open: the URL's when valid, else the screen's default. */
export function sectionOf(ids: readonly string[], fallback: string, value: unknown): string {
  return validSection(ids, value) ?? fallback;
}

/** The search with the section set (the default section is not written); doc, q and the rest stay. */
export function searchWithSection(
  prev: SectionSearch,
  id: string,
  fallback: string,
): SectionSearch {
  const { seccion: _old, ...rest } = prev;
  return id === fallback ? rest : { ...rest, seccion: id };
}

/** The search after a person changes section by hand: doc leaves (it only wins when the page opens), q stays. */
export function nextSearchOnSectionChange(
  prev: SectionSearch,
  id: string,
  fallback: string,
): SectionSearch {
  const { doc: _doc, ...rest } = prev;
  return searchWithSection(rest, id, fallback);
}

/** True when the raw URL search carries a ?seccion= the screen does not know, or (query screens) a blank ?q=: it should be rewritten clean. */
export function needsUrlClean(
  raw: Record<string, unknown>,
  ids: readonly string[],
  withQuery: boolean,
): boolean {
  if (raw.seccion !== undefined && validSection(ids, raw.seccion) === undefined) return true;
  return withQuery && raw.q !== undefined && !(typeof raw.q === "string" && raw.q.trim() !== "");
}

/** The search without the unknown seccion and the blank q; every other parameter stays (a valid seccion, even the default, is kept as is). */
export function cleanUrlSearch<S extends Record<string, unknown>>(
  raw: S,
  ids: readonly string[],
  withQuery: boolean,
): S {
  const next: Record<string, unknown> = { ...raw };
  if (next.seccion !== undefined && validSection(ids, next.seccion) === undefined)
    delete next.seccion;
  if (withQuery && next.q !== undefined && !(typeof next.q === "string" && next.q.trim() !== ""))
    delete next.q;
  return next as S;
}
