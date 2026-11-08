// SDD-20261106-hub-search, U-1. One accent- and case-insensitive fold (shared with match.ts) and the literal document search of
// Conocimiento. Pure and tested (text-search.test.ts).

/** Text without accents or case, for comparing. null and undefined give "". Note: ñ folds to n (same as the duplicate check). */
export function foldText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Characters of the fragment around a match, not counting the «…» of a cut end. */
const SNIPPET_GRAPHEMES = 120;

export type SearchResult<D> = { doc: D; section: string; inTitle: boolean; snippet: string | null };

type Folded = { title: string; body: string };
// Folded text is computed once per loaded document, not per keystroke.
const cache = new WeakMap<object, Folded>();
function foldedOf(d: { title: string; body: string }): Folded {
  let f = cache.get(d);
  if (!f) {
    f = { title: foldText(d.title), body: foldText(d.body) };
    cache.set(d, f);
  }
  return f;
}

/** Folds char by char, remembering for each unit of the folded text where its source character starts and ends in the original. */
function foldWithMap(text: string): { folded: string; start: number[]; end: number[] } {
  let folded = "";
  const start: number[] = [];
  const end: number[] = [];
  let at = 0;
  for (const ch of text) {
    const f = foldText(ch);
    for (let i = 0; i < f.length; i++) {
      start.push(at);
      end.push(at + ch.length);
    }
    folded += f;
    at += ch.length;
  }
  return { folded, start, end };
}

/** Grapheme segments of the text; without Intl.Segmenter, code points (can split a ZWJ emoji, never a surrogate pair). */
function graphemesOf(text: string): string[] {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
      (s) => s.segment,
    );
  }
  return Array.from(text);
}

/** Up to 120 graphemes of the original text around [from, to), borders on whole graphemes, «…» where the text was cut. */
function snippetAround(text: string, from: number, to: number): string {
  const segs = graphemesOf(text);
  const offsets: number[] = [];
  let at = 0;
  for (const g of segs) {
    offsets.push(at);
    at += g.length;
  }
  const grapheme = (pos: number) => {
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((offsets[mid] ?? 0) <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  let a = grapheme(from);
  let b = grapheme(Math.max(from, to - 1)) + 1; // exclusive
  if (b - a >= SNIPPET_GRAPHEMES) b = a + SNIPPET_GRAPHEMES;
  const room = SNIPPET_GRAPHEMES - (b - a);
  let before = Math.min(a, Math.floor(room / 2));
  const after = Math.min(segs.length - b, room - before);
  before = Math.min(a, room - after);
  a -= before;
  b += after;
  return `${a > 0 ? "…" : ""}${segs.slice(a, b).join("")}${b < segs.length ? "…" : ""}`;
}

/**
 * Documents whose title or body contains the text, ignoring case and accents, literally (never a regular expression).
 * Title matches first; each group keeps the order of `docs` (the reading order). A blank query finds nothing.
 * `snippet` is the original text around the match when only the body matches (else null).
 */
export function searchDocs<D extends { section: string; title: string; body: string }>(
  docs: D[],
  q: string,
): SearchResult<D>[] {
  const needle = foldText(q).trim();
  if (!needle) return [];
  const titled: SearchResult<D>[] = [];
  const bodied: SearchResult<D>[] = [];
  for (const doc of docs) {
    const f = foldedOf(doc);
    if (f.title.includes(needle)) {
      titled.push({ doc, section: doc.section, inTitle: true, snippet: null });
    } else if (f.body.includes(needle)) {
      bodied.push({
        doc,
        section: doc.section,
        inTitle: false,
        snippet: fragment(doc.body, needle),
      });
    }
  }
  return [...titled, ...bodied];
}

function fragment(body: string, needle: string): string {
  const { folded, start, end } = foldWithMap(body);
  const i = folded.indexOf(needle);
  // Folding the whole text can differ from folding char by char (Greek final sigma): then show the start of the text.
  if (i < 0) return snippetAround(body, 0, 0);
  return snippetAround(body, start[i] ?? 0, end[i + needle.length - 1] ?? body.length);
}
