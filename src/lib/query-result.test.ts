// Ola 0.5: a failed read must surface as an error, never as an empty list (Memoria looked empty on failure).
import { describe, expect, it } from "vitest";
import { rowsOrThrow } from "./query-result";

describe("rowsOrThrow", () => {
  it("returns the rows", () => {
    expect(rowsOrThrow({ data: [1, 2], error: null })).toEqual([1, 2]);
  });
  it("treats no data and no error as empty", () => {
    expect(rowsOrThrow({ data: null, error: null })).toEqual([]);
  });
  it("throws the error instead of returning empty", () => {
    const error = { message: "permission denied", code: "42501" };
    expect(() => rowsOrThrow({ data: null, error })).toThrow();
    try { rowsOrThrow({ data: null, error }); } catch (e) { expect(e).toBe(error); }
  });
});
