// Pure helpers for need-based searches (tested in search.test.ts): one seniority vocabulary for every
// people service, and the cursor that remembers which service answered so «Traer más» asks the same one.

export const LEVELS = ["founder", "c_suite", "vp", "head", "director", "manager"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = {
  founder: "Fundador",
  c_suite: "C-Level",
  vp: "VP",
  head: "Head",
  director: "Director",
  manager: "Manager",
};
export const DEFAULT_LEVELS: Level[] = ["c_suite", "vp", "head", "director"];

/** Apollo uses c_suite; Clay uses c-suite. Unknown levels are dropped. */
export function levelsFor(service: "apollo" | "clay", levels: string[]): string[] {
  const ok = levels.filter((l): l is Level => (LEVELS as readonly string[]).includes(l));
  return service === "clay" ? ok.map((l) => (l === "c_suite" ? "c-suite" : l)) : ok;
}

export type Cursor = { service: "apollo"; page: number } | { service: "clay"; searchId: string };

/** Next cursor after a page: Apollo pages by number, Clay continues its search id. Null when nothing more. */
export function nextCursor(
  service: "apollo" | "clay",
  hasMore: boolean,
  page: number,
  searchId: string | null,
): Cursor | null {
  if (!hasMore) return null;
  if (service === "apollo") return { service, page: page + 1 };
  return searchId ? { service, searchId } : null;
}

/** Estimated cost of revealing people (email) with Apollo; phone costs more per person. */
export function revealCost(people: number, phone: boolean) {
  return Math.round(people * (phone ? 0.17 : 0.02) * 100) / 100;
}
