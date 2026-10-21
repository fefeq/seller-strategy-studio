import { describe, expect, it } from "vitest";
import { confirmed, NOT_SAVED } from "./save";
import { errorText } from "./errors";

describe("confirmed", () => {
  it("returns the row the server wrote", async () => {
    await expect(
      confirmed(Promise.resolve({ data: [{ id: "a", body: "x" }], error: null })),
    ).resolves.toEqual({ id: "a", body: "x" });
    await expect(confirmed(Promise.resolve({ data: { id: "a" }, error: null }))).resolves.toEqual({
      id: "a",
    });
  });
  it("treats zero rows as not saved, never as success", async () => {
    await expect(confirmed(Promise.resolve({ data: [], error: null }))).rejects.toThrow(NOT_SAVED);
    await expect(confirmed(Promise.resolve({ data: null, error: null }))).rejects.toThrow(
      NOT_SAVED,
    );
  });
  it("rethrows the server error", async () => {
    const err = { code: "42501", message: "new row violates row-level security policy" };
    await expect(confirmed(Promise.resolve({ data: null, error: err }))).rejects.toBe(err);
  });
  it("its message reaches the person as is", () =>
    expect(errorText(new Error(NOT_SAVED))).toBe(NOT_SAVED));
});
