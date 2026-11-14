import { describe, expect, it } from "vitest";
import { readAdvanced, saveAdvanced } from "./nav-advanced";

describe("CA-3 preferencia avanzada por usuario", () => {
  it("empieza apagada, guarda por usuario y no afecta a otro", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(readAdvanced(storage, "u1")).toBe(false);
    saveAdvanced(storage, "u1", true);
    expect(readAdvanced(storage, "u1")).toBe(true);
    expect(readAdvanced(storage, "u2")).toBe(false);
    saveAdvanced(storage, "u1", false);
    expect(readAdvanced(storage, "u1")).toBe(false);
  });
  it("almacenamiento bloqueado no lanza ni activa el modo", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readAdvanced(storage, "u1")).toBe(false);
    expect(() => saveAdvanced(storage, "u1", true)).not.toThrow();
    expect(readAdvanced(storage, undefined)).toBe(false);
  });
});