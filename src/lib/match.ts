// «Buscar o crear» (pure; tested): find what already exists before creating an account, person, partner or product.
import { cleanDomain } from "@/lib/leads";
import { foldText } from "@/lib/text-search";

const LEGAL = /\b(s\.?\s?l\.?u?|s\.?\s?a\.?u?|s\.?\s?l\.?l|s\.?\s?coop|inc|llc|ltd|limited|gmbh|ag|bv|nv|plc|corp|corporation|co|company|sas|sarl|srl|spa|oy|ab|as|pty|group|grupo|holding)\b\.?/g;

/** Comparable form of a name: lower case, no accents, no legal suffix, no punctuation or spaces. */
export function normName(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(LEGAL, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/** Edit distance (small strings only). */
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m + n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n]!;
}

export type Candidate = { id: string; name: string; domain?: string | null; email?: string | null; sub?: string | null };
export type Match<C extends Candidate> = { item: C; score: number; kind: "same" | "similar" };

/** 0–100 likeness between what was typed and an existing record. Domain or email equality is 100. */
export function likeness(query: { name?: string | null; domain?: string | null; email?: string | null }, c: Candidate): number {
  const qd = cleanDomain(query.domain ?? null);
  if (qd && cleanDomain(c.domain ?? null) === qd) return 100;
  const qe = (query.email ?? "").trim().toLowerCase();
  if (qe && (c.email ?? "").trim().toLowerCase() === qe) return 100;
  const a = normName(query.name), b = normName(c.name);
  if (!a || !b) return 0;
  if (a === b) return 100;
  // The typed name equals the domain's first label («acme» vs acme.com).
  const label = cleanDomain(c.domain ?? null)?.split(".")[0];
  if (label && label.length >= 3 && a === label) return 95;
  if (a.length >= 3 && (b.startsWith(a) || a.startsWith(b))) return 85;
  if (a.length >= 4 && b.includes(a)) return 75;
  const d = lev(a, b);
  const max = Math.max(a.length, b.length);
  return max >= 5 ? Math.max(0, Math.round(100 - (d / max) * 100)) : d === 0 ? 100 : 0;
}

/** Existing records that look like the query, best first. ≥ 95 = the same; ≥ 70 = similar (warn); rest ignored. */
export function findMatches<C extends Candidate>(query: { name?: string | null; domain?: string | null; email?: string | null }, list: C[], limit = 8): Match<C>[] {
  return list
    .map((item) => ({ item, score: likeness(query, item) }))
    .filter((m) => m.score >= 70)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((m) => ({ ...m, kind: m.score >= 95 ? ("same" as const) : ("similar" as const) }));
}

/** The record to warn about before creating, if any. */
export const duplicateOf = <C extends Candidate>(query: { name?: string | null; domain?: string | null; email?: string | null }, list: C[]) => findMatches(query, list, 1)[0] ?? null;

/** Combobox filter: records whose name, domain or subtitle contains the text (accent/case-insensitive), similar ones after. */
export function searchList<C extends Candidate>(text: string, list: C[], limit = 20): C[] {
  const t = foldText(text).trim();
  if (!t) return list.slice(0, limit);
  const contains = list.filter((c) => foldText(c.name).includes(t) || foldText(c.domain).includes(t) || foldText(c.sub).includes(t));
  const seen = new Set(contains.map((c) => c.id));
  const similar = findMatches({ name: text, domain: text }, list, limit).map((m) => m.item).filter((c) => !seen.has(c.id));
  return [...contains, ...similar].slice(0, limit);
}

/** Search results (Apollo, Clay, ICP, Parallel) flagged «Ya está en Nokko» when an account is the same by domain or name. */
export function markKnown<R extends { name: string; domain?: string | null; existingId?: string | null }>(rows: R[], known: Candidate[]): R[] {
  if (!known.length) return rows;
  return rows.map((r) => {
    if (r.existingId) return r;
    const d = duplicateOf({ name: r.name, domain: r.domain }, known);
    return d?.kind === "same" ? { ...r, existingId: d.item.id } : r;
  });
}
