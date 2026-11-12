// NK-0148: browser storage may be missing (Node 26, SSR) or throw (blocked, quota). The helpers never throw and fall back quietly.
import { afterEach, describe, expect, it } from "vitest";
import { storageGet, storageRemove, storageSet } from "@/lib/safe-storage";

const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
afterEach(() => {
  if (saved) Object.defineProperty(globalThis, "localStorage", saved);
  localStorage.clear();
});

describe("safe-storage", () => {
  it("reads back what it wrote", () => {
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
