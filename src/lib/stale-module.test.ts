import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isStaleModuleError,
  reloadOnceForStaleModule,
  shouldReloadForStaleModule,
  STALE_RELOAD_KEY,
} from "./stale-module";

const NOW = 1_000_000;
const STALE = new TypeError("Failed to fetch dynamically imported module: https://x/a.js");

type FakeStorage = Pick<Storage, "getItem" | "setItem">;

function stubWindow(sessionStorage: FakeStorage) {
  const reload = vi.fn();
  vi.stubGlobal("window", { sessionStorage, location: { reload } });
  return reload;
}

function memoryStorage(initial?: string): FakeStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STALE_RELOAD_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

describe("reloadOnceForStaleModule fails closed", () => {
  it("reloads and stores the mark when storage works", () => {
    const storage = memoryStorage();
    const reload = stubWindow(storage);
    expect(reloadOnceForStaleModule(STALE)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.data.get(STALE_RELOAD_KEY)).toBe(String(NOW));
  });

  it("does not reload when getItem and setItem both throw", () => {
    const boom = () => {
      throw new Error("blocked");
    };
    const reload = stubWindow({ getItem: boom, setItem: boom });
    expect(reloadOnceForStaleModule(STALE)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when only setItem throws", () => {
    const reload = stubWindow({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(reloadOnceForStaleModule(STALE)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when setItem silently does not persist", () => {
    const reload = stubWindow({ getItem: () => null, setItem: () => undefined });
    expect(reloadOnceForStaleModule(STALE)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("treats a mark in the future as expired", () => {
    expect(shouldReloadForStaleModule(NOW + 60_000, NOW)).toBe(true);
    const reload = stubWindow(memoryStorage(String(NOW + 60_000)));
    expect(reloadOnceForStaleModule(STALE)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
