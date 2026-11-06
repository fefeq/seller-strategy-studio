import { describe, expect, it } from "vitest";

// NK-0048 CA-3: core/node.ts reads from disk (node:fs), so it may only be imported by the GTM Lab
// tests and the eval script. No app code under src/ may pull it into the Worker or browser bundle.
const SOURCES = import.meta.glob(["/src/**/*.{ts,tsx}", "!/src/**/*.d.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const NODE_ENTRY =
  /from\s*["'](?:\.{1,2}\/|@\/lib\/gtm-lab\/)[^"']*core\/node["']|from\s*["']\.\/node["']/;

function importsNodeEntry(path: string, text: string): boolean {
  if (path.startsWith("/src/lib/gtm-lab/core/")) return /from\s*["']\.\/node["']/.test(text);
  return NODE_ENTRY.test(text) && /core\/node["']/.test(text);
}

describe("core/node.ts stays out of the app (NK-0048 CA-3)", () => {
  it("guards the node entry point that exists in core/", () => {
    expect(SOURCES["/src/lib/gtm-lab/core/node.ts"]).toBeDefined();
  });

  it("scans the app sources", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
  });

  it("is only imported by src/lib/gtm-lab tests", () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path, text]) => importsNodeEntry(path, String(text)))
      .map(([path]) => path)
      .filter((path) => !(path.startsWith("/src/lib/gtm-lab/") && /\.test\.ts$/.test(path)));
    expect(offenders).toEqual([]);
  });

  it("detects an import of core/node from app code (positive control)", () => {
    expect(importsNodeEntry("/src/lib/x.ts", 'import { a } from "@/lib/gtm-lab/core/node";')).toBe(
      true,
    );
    expect(importsNodeEntry("/src/lib/gtm-lab/x.ts", 'import { a } from "./core/node";')).toBe(
      true,
    );
    expect(importsNodeEntry("/src/lib/gtm-lab/core/ai.ts", 'import { a } from "./node";')).toBe(
      true,
    );
    expect(importsNodeEntry("/src/lib/x.ts", 'import { a } from "@/lib/gtm-lab/core";')).toBe(
      false,
    );
  });
});
