// @vitest-environment node
// SDD-20261031-ux-legibility-contrast CA-5/6/7: one selection control, two densities, always labelled.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NativeSelect } from "@/components/native-select";

const ROOT = process.cwd();
function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, f);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx$/.test(f) && !/\.test\.tsx$/.test(f)) out.push(rel);
  }
  return out;
}
/** Index of the `>` that closes the JSX tag opened at `i` (skips braces, quotes and `=>`). */
function tagEnd(s: string, i: number) {
  let depth = 0;
  let q: string | null = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === q && s[j - 1] !== "\\") q = null; }
    else if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0 && s[j - 1] !== "=") return j;
  }
  return s.length;
}
const files = walk("src");

describe("CA-5 un único control de selección", () => {
  it("ningún selector nativo fuera del control compartido", () => {
    const offenders = files.filter((f) => f !== "src/components/native-select.tsx" && /<select(?=[\s>])/.test(readFileSync(join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });
  it("los usos del control solo pasan clases de disposición, nunca de aspecto", () => {
    const VISUAL = /^(h-\d+|md:h-\d+|h-auto|md:h-auto|rounded(-\w+)?|border(-\w+)?|bg-[\w-]+|px-\d+|md:px-\d+|text-(xs|sm|base)|md:text-(xs|sm|base))$/;
    const bad: string[] = [];
    for (const f of files) {
      const s = readFileSync(join(ROOT, f), "utf8");
      for (const m of s.matchAll(/<NativeSelect(?=[\s>])/g)) {
        const tag = s.slice(m.index!, tagEnd(s, m.index!) + 1);
        const cls = tag.match(/className="([^"]*)"/)?.[1] ?? "";
        for (const t of cls.split(/\s+/).filter(Boolean)) if (VISUAL.test(t)) bad.push(`${f}: ${t}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("CA-6 dos densidades", () => {
  const html = (density?: "normal" | "compact") => renderToStaticMarkup(createElement(NativeSelect, { "aria-label": "x", density }, createElement("option", { value: "a" }, "A")));
  it("normal conserva la altura de Pick: 40 px en móvil y 36 px en escritorio", () => {
    const h = html();
    expect(h).toContain("h-10");
    expect(h).toContain("md:h-9");
  });
  it("compacta: 40 px en móvil y 32 px en escritorio, letra más pequeña", () => {
    const h = html("compact");
    expect(h).toContain("h-10");
    expect(h).toContain("md:h-8");
    expect(h).toContain("md:text-xs");
  });
});

describe("CA-7 etiqueta accesible", () => {
  it("todo uso del control lleva aria-label o aria-labelledby", () => {
    const bad: string[] = [];
    for (const f of files) {
      const s = readFileSync(join(ROOT, f), "utf8");
      for (const m of s.matchAll(/<NativeSelect(?=[\s>])/g)) {
        const tag = s.slice(m.index!, tagEnd(s, m.index!) + 1);
        if (!/aria-label(?:ledby)?=/.test(tag)) bad.push(`${f}:${s.slice(0, m.index!).split("\n").length}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
