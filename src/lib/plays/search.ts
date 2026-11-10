// The search parameter of /plays (kept out of the route file, which may only export the route). Pure.

/** `?vista=equipos` shows the teams of plays; any other value (or none) shows the catalogue. */
export function parsePlaysSearch(s: Record<string, unknown>): { vista?: "equipos" } {
  return { vista: s.vista === "equipos" ? "equipos" : undefined };
}
