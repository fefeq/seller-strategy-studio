// From gtm-lab@44f385b packages/core/src/boundaries.test.ts
// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CA-6: core must stay framework-agnostic so it can move to an API, an agent, NOKKO or Postin.
const srcDir = fileURLToPath(new URL(".", import.meta.url));
const packageDir = resolve(srcDir);
const PACKAGES = [/^node:/, /^yaml$/, /^zod$/, /^vitest(\/|$)/];
const NODE_ONLY = new Set(["node.ts"]);

// This file is excluded: its positive control contains forbidden imports as sample text.
const files = (readdirSync(srcDir, { recursive: true }) as string[]).filter(
  (f) => /\.(ts|tsx|js|mjs)$/.test(f) && f !== "boundaries.test.ts",
);

// Static imports and re-exports (with or without `from`), dynamic import() and require().
function importsOf(text: string): string[] {
  const patterns = [
    /^\s*(?:import|export)\b[^"';]*?from\s*["']([^"']+)["']/gm,
    /^\s*import\s*["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return patterns.flatMap((re) => [...text.matchAll(re)].map((m) => m[1] ?? ""));
}

function forbidden(specs: string[], fromDir = srcDir): string[] {
  return specs.filter((spec) =>
    spec.startsWith(".")
      ? !resolve(fromDir, spec).startsWith(packageDir)
      : !PACKAGES.some((re) => re.test(spec)),
  );
}

describe("core boundaries (CA-6)", () => {
  it("has source files to check", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(files)("%s only imports allowed modules", (file) => {
    const path = join(srcDir, file);
    expect(forbidden(importsOf(readFileSync(path, "utf8")), resolve(path, ".."))).toEqual([]);
  });

  it.each(files.filter((f) => !/\.test\.tsx?$/.test(f) && !NODE_ONLY.has(f)))(
    "%s does not import node built-ins (runs in the browser)",
    (file) => {
      const specs = importsOf(readFileSync(join(srcDir, file), "utf8"));
      expect(specs.filter((spec) => spec.startsWith("node:"))).toEqual([]);
    },
  );

  it("flags UI, database and cross-package imports in every form (positive control)", () => {
    const sample = [
      'import { useState } from "react";',
      'import "react-dom";',
      'export { x } from "@supabase/supabase-js";',
      'const m = await import("next/router");',
      'const fs = require("lodash");',
      'import { App } from "../../../apps/web/src/app";',
      'import { parse } from "yaml";',
      'import { x } from "./progress";',
    ].join("\n");
    expect(forbidden(importsOf(sample)).sort()).toEqual(
      ["../../../apps/web/src/app", "@supabase/supabase-js", "lodash", "next/router", "react", "react-dom"].sort(),
    );
  });
});
