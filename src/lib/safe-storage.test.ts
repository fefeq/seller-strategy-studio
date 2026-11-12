// NK-0148: browser storage may be missing (Node 26, SSR) or throw (blocked, quota). The helpers never throw and fall back quietly.
import { afterEach, describe, expect, it, vi } from "vitest";
import { storageGet, storageRemove, storageSet } from "@/lib/safe-storage";

/** Minimal in-memory Storage, so the working-storage case never depends on the runtime (Node 26 ships none by default). */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
afterEach(() => {
  vi.unstubAllGlobals();
  if (saved) Object.defineProperty(globalThis, "localStorage", saved);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

describe("safe-storage", () => {
  it("reads back what it wrote", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    expect(storageSet("local", "k", "v")).toBe(true);
    expect(storageGet("local", "k")).toBe("v");
    storageRemove("local", "k");
    expect(storageGet("local", "k")).toBeNull();
  });

  it("returns null/false when the storage is undefined", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => undefined });
    expect(storageGet("local", "k")).toBeNull();
    expect(storageSet("local", "k", "v")).toBe(false);
    expect(() => storageRemove("local", "k")).not.toThrow();
  });

  it("returns null/false when the storage throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect(storageGet("local", "k")).toBeNull();
    expect(storageSet("local", "k", "v")).toBe(false);
    expect(() => storageRemove("local", "k")).not.toThrow();
  });

  it("returns null/false when setItem throws (quota)", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => ({
        getItem: () => null,
        setItem: () => {
          throw new DOMException("full", "QuotaExceededError");
        },
        removeItem: () => {},
      }),
    });
    expect(storageSet("local", "k", "v")).toBe(false);
  });
});
