import { describe, expect, it } from "vitest";

// NK-0048 CA-2: the 14 ported test files keep every test of packages/core/src@44f385b.
// Counted statically; this file and exports.test.ts are new in NOKKO, so they are left out.
const PORTED = [
  "ai.test.ts",
  "boundaries.test.ts",
  "canales.test.ts",
  "deliverables.test.ts",
  "document.test.ts",
  "experiments.test.ts",
  "forms.test.ts",
  "framework.test.ts",
  "ice.test.ts",
  "plan.test.ts",
  "precio.test.ts",
  "progress.test.ts",
  "tasks.test.ts",
  "tools.test.ts",
];

const TEST_FILES = import.meta.glob("./*.test.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

function ported(): [string, string][] {
  return Object.entries(TEST_FILES)
    .map(([path, text]): [string, string] => [path.slice(2), String(text)])
    .filter(([name]) => name !== "test-count.test.ts" && name !== "exports.test.ts");
}

describe("ported core tests (NK-0048 CA-2)", () => {
  it("are exactly the 14 files of packages/core/src@44f385b", () => {
    expect(
      ported()
        .map(([name]) => name)
        .sort(),
    ).toEqual(PORTED);
  });

  it("keep 174 literal it/test calls and 12 it.each", () => {
    let literal = 0;
    let each = 0;
    for (const [, text] of ported()) {
      literal += [...text.matchAll(/^\s*(?:it|test)\(/gm)].length;
      each += [...text.matchAll(/\bit\.each\b/g)].length;
    }
    expect(literal).toBe(174);
    expect(each).toBe(12);
  });
});
