import { PHASES, type Play } from "./catalog";
import { effectiveState } from "./status";

// Which plays can be recommended, and in what order (SDD-20261110-plays-phase-autonomy-deps, CA-6 to CA-8). Pure: it reads only the
// catalogue it is given, never the per-company state rows, so recommending is not enabling and works for a company with no rows.

export type Excluded = { play: Play; reason: string };
export type Recommendation = { recommended: Play[]; excluded: Excluded[] };

const CATALOG_ERROR = "El catálogo tiene un error en este play";

export function recommendablePlays(catalog: Play[]): Recommendation {
  const byId = new Map(catalog.map((p) => [p.id, p]));

  // A play is invalid when it names an id that does not exist, depends on itself or sits on a cycle. The build fails on it (catalog.test.ts);
  // here it is only left out, so the screen keeps working.
  const reaches = (from: string, target: string, seen = new Set<string>()): boolean => {
    for (const d of byId.get(from)?.dependsOn ?? []) {
      if (d === target) return true;
      if (byId.has(d) && !seen.has(d)) {
        seen.add(d);
        if (reaches(d, target, seen)) return true;
      }
    }
    return false;
  };
  const invalid = (p: Play) => p.dependsOn.some((d) => !byId.has(d)) || reaches(p.id, p.id);

  // Why a play cannot be recommended, or null. Invalid plays answer first, so the recursion only walks valid (acyclic) plays.
  const memo = new Map<string, string | null>();
  const why = (p: Play): string | null => {
    if (memo.has(p.id)) return memo.get(p.id) ?? null;
    let reason: string | null = null;
    if (invalid(p)) reason = CATALOG_ERROR;
    else {
      const state = effectiveState(p, null);
      if (!state.canEnable) reason = state.reason;
      else {
        const blocker = p.dependsOn.map((d) => byId.get(d)!).find((d) => why(d) !== null);
        if (blocker) reason = `depende de ${blocker.title}, que no está disponible`;
      }
    }
    memo.set(p.id, reason);
    return reason;
  };

  const excluded: Excluded[] = [];
  const ok: Play[] = [];
  for (const p of catalog) {
    const reason = why(p);
    if (reason === null) ok.push(p);
    else excluded.push({ play: p, reason });
  }

  // Phase first; inside a phase the catalogue order, except that a play waits for the plays of its own phase it depends on.
  const recommended: Play[] = [];
  const placed = new Set<string>();
  const place = (p: Play, phase: Play["phase"]) => {
    if (placed.has(p.id)) return;
    placed.add(p.id);
    for (const d of p.dependsOn) {
      const dep = byId.get(d)!;
      if (dep.phase === phase) place(dep, phase);
    }
    recommended.push(p);
  };
  for (const phase of PHASES) for (const p of ok) if (p.phase === phase) place(p, phase);

  return { recommended, excluded };
}
