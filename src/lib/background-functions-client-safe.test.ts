// @vitest-environment node
// NK-0095 build fix (SDD-20261109-rules-write-permissions U-4): the screens import background.functions.ts, so it is in the
// client bundle. Server-only code (getRequest from @tanstack/react-start/server, *.server modules) may only be reached
// through dynamic imports inside createServerFn handlers. A top-level import or re-export of it broke the release build
// (import-protection), and a re-export of a .server module is not caught by the build, so this guard checks the source.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/lib/background.functions.ts", "utf8");
const staticSpecifiers = [...src.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gm)].map(
  (m) => m[1]!,
);

describe("background.functions.ts stays safe for the client bundle", () => {
  it("has no top-level import or re-export of server-only modules", () => {
    for (const s of staticSpecifiers) {
      expect(s, s).not.toBe("@tanstack/react-start/server");
      expect(s, s).not.toMatch(/\.server$/);
    }
  });

  it("reaches authorize/enqueue only through background-jobs.server inside the handlers", () => {
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+(authorize|enqueue)\b/);
    expect(src).toMatch(/await import\("@\/lib\/background-jobs\.server"\)/);
  });
});
