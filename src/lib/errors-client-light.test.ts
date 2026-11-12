// @vitest-environment node
// NK-0164 rework: errors.ts is imported by almost every screen, so its static import graph must stay free of zod
// (the job schema lives in onboarding-sources.ts; the limit text lives in the zod-free onboarding-files-limit.ts).
// Static check in the style of background-functions-client-safe.test.ts: follows "@/..." and relative imports/re-exports.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveSpec(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? resolve(ROOT, "src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const e of EXTS) {
    const p = base + e;
    if (/\.tsx?$/.test(p) && existsSync(p)) return p;
  }
  return null;
}

/** Static (non-type-only) import/export specifiers of a file; dynamic import() is not followed on purpose. */
function staticSpecs(file: string): string[] {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/^\s*(?:import|export)\b(?!\s+type\b)[^;]*?\bfrom\s+"([^"]+)"|^\s*import\s+"([^"]+)"/gm)].map((m) => (m[1] ?? m[2])!);
}

function reach(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (files.has(f)) continue;
    files.add(f);
    for (const s of staticSpecs(f)) {
      const r = resolveSpec(s, f);
      if (r) stack.push(r);
      else packages.add(s);
    }
  }
  return { files, packages };
}

describe("errors.ts keeps zod out of every screen's bundle", () => {
  const { files, packages } = reach(resolve(ROOT, "src/lib/errors.ts"));

  it("does not reach zod through its static imports", () => {
    expect([...packages].filter((p) => p === "zod" || p.startsWith("zod/"))).toEqual([]);
  });

  it("does not reach onboarding-sources.ts (the job schema)", () => {
    expect([...files].map((f) => f.replace(`${ROOT}/`, "")).filter((f) => f.endsWith("onboarding-sources.ts"))).toEqual([]);
  });
});
