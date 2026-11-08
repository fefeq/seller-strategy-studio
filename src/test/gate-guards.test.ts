import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Reads scripts/factory/gate.mjs as source (like the other source-reading tests); the gate itself is not run here.
const gate = readFileSync(resolve(__dirname, "../../scripts/factory/gate.mjs"), "utf8");
const CAST = ["as", "any"].join(" ");

// The text of one guard: from its name up to the next guard (prettier may split a rule over several lines).
function guard(name: string): string {
  const start = gate.indexOf(name);
  expect(start).toBeGreaterThan(-1);
  const next = gate.indexOf('    ["', start + name.length);
  return gate.slice(start, next === -1 ? start + 400 : next);
}

describe("gate cast guard", () => {
  it("still checks added lines of hand-written files under src/", () => {
    const g = guard(`no \`${CAST}\``);
    expect(g).toContain("src(x.f)");
    expect(g).toContain(CAST);
  });

  it("skips generated gen.ts and gen.tsx files, such as the router tree", () => {
    expect(guard(`no \`${CAST}\``)).toContain("!generated(x.f)");
    expect(gate).toMatch(/const generated = \(f\) => \/\\\.gen\\\.tsx\?\$\/\.test\(f\);/);
  });

  it("keeps the other guards on every src file", () => {
    for (const name of ["no window.confirm/prompt", "no raw error.message toasts"]) {
      const g = guard(name);
      expect(g).toContain("src(x.f)");
      expect(g).not.toContain("generated");
    }
  });
});
