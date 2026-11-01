import { describe, expect, it } from "vitest";
import { isStaleModuleError, shouldReloadForStaleModule } from "./stale-module";

describe("stale module recovery", () => {
  it("recognises a failed lazy route chunk", () => {
    expect(
      isStaleModuleError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://x/src/routes/_authenticated/route.tsx?tsr-split=component",
        ),
      ),
    ).toBe(true);
  });

  it("ignores ordinary errors", () => {
    expect(isStaleModuleError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("reloads at most once every 30 seconds", () => {
    expect(shouldReloadForStaleModule(null, 100_000)).toBe(true);
    expect(shouldReloadForStaleModule(100_000, 110_000)).toBe(false);
    expect(shouldReloadForStaleModule(100_000, 131_000)).toBe(true);
  });
});
