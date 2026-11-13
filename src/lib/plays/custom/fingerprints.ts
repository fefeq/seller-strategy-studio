// NK-0171 SDD 2 (§7): fingerprints by word fragments so no Nokko play reuses the annex wording.
// Pure. The annex is read at run time by tests/validation; no annex text is embedded here.

const norm = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Word 3-grams of the normalised text; texts under 3 words count as one fragment. */
export function shingles(text: string): Set<string> {
  const w = norm(text).split(" ").filter(Boolean);
  if (!w.length) return new Set();
  if (w.length < 3) return new Set([w.join(" ")]);
  const out = new Set<string>();
  for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(" "));
  return out;
}

/** Share of the candidate's fragments found in the fingerprint (0–1). */
export function overlap(candidate: Set<string>, fp: Set<string>): number {
  if (!candidate.size) return 0;
  let hit = 0;
  for (const s of candidate) if (fp.has(s)) hit++;
  return hit / candidate.size;
}

export const FINGERPRINT_MIN_OVERLAP = 0.34;

export function copiesAnnex(text: string, fps: Set<string>[]): boolean {
  const c = shingles(text);
  return fps.some((fp) => overlap(c, fp) >= FINGERPRINT_MIN_OVERLAP);
}

/** Slugs and hooks from the annex table (Part 1): columns 2 and 3 of each data row. */
export function annexFingerprints(annex: string): Set<string>[] {
  const out: Set<string>[] = [];
  for (const line of annex.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cols = line.split("|").map((c) => c.trim());
    const slug = cols[2] ?? "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(slug)) continue;
    out.push(shingles(slug.replace(/-/g, " ")));
    const hook = cols[3] ?? "";
    if (hook && !hook.startsWith("(")) out.push(shingles(hook));
  }
  return out;
}

/** FNV-1a 32-bit: the repo keeps only hashes of the annex fragments, never its text (§7, q-5). */
export function hashFragment(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}
export const hashFingerprints = (fps: Set<string>[]): string[][] => fps.map((fp) => [...fp].map(hashFragment).sort());

/** Production check against the stored hash list (used by the assistant tool, SDD 3). */
export function copiesHashed(text: string, list: string[][]): boolean {
  const c = [...shingles(text)].map(hashFragment);
  if (!c.length) return false;
  return list.some((fp) => {
    const s = new Set(fp);
    return c.filter((h) => s.has(h)).length / c.length >= FINGERPRINT_MIN_OVERLAP;
  });
}
