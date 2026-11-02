// @vitest-environment node
// SDD-20261031-ux-legibility-contrast CA-1: no text with meaning below 12 px, however the size is declared.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, f);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith(".gen.ts"))
      out.push(rel);
  }
  return out;
}
/** Closed list of exceptions: file → reason. Empty on purpose; add only with Fede's OK. */
const EXCEPTIONS: Record<string, string> = {};

const px = (v: string) => (v.endsWith("rem") ? parseFloat(v) * 16 : parseFloat(v));
const PATTERNS: [string, RegExp][] = [
  ["clase text-[Npx|Nrem]", /text-\[(\d*\.?\d+(?:px|rem))\]/g],
  ["fontSize numérico", /fontSize:\s*(\d+(?:\.\d+)?)\b(?!\s*\+)/g],
  ["font-size CSS", /font-size:\s*(\d*\.?\d+(?:px|rem))/g],
];

describe("CA-1 suelo de 12 px", () => {
  for (const f of walk("src")) {
    if (EXCEPTIONS[f]) continue;
    it(f, () => {
      const src = readFileSync(join(ROOT, f), "utf8");
      const bad: string[] = [];
      for (const [name, re] of PATTERNS) {
        for (const m of src.matchAll(re)) {
          const size = name === "fontSize numérico" ? parseFloat(m[1]) : px(m[1]);
          if (size < 12) bad.push(`${name}: ${m[0]} (${size} px)`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
  it("la lista de excepciones apunta a archivos que existen", () => {
    for (const f of Object.keys(EXCEPTIONS)) expect(() => statSync(join(ROOT, f))).not.toThrow();
  });
});
