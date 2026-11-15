import { describe, expect, it } from "vitest";
import { prune, toCsv, toggle, toggleAll } from "./selection";

describe("D1 selection", () => {
  it("toggle adds and removes", () => {
    expect([...toggle(new Set(), "a")]).toEqual(["a"]);
    expect([...toggle(new Set(["a"]), "a")]).toEqual([]);
  });
  it("toggleAll selects visible, then clears only visible", () => {
    expect([...toggleAll(new Set(["z"]), ["a", "b"])].sort()).toEqual(["a", "b", "z"]);
    expect([...toggleAll(new Set(["a", "b", "z"]), ["a", "b"])]).toEqual(["z"]);
  });
  it("prune drops ids no longer listed", () => {
    expect([...prune(new Set(["a", "x"]), ["a", "b"])]).toEqual(["a"]);
  });
  it("csv escapes quotes, commas and newlines", () => {
    expect(toCsv(["n"], [['A "B", C\nD']])).toBe('"n"\r\n"A ""B"", C\nD"');
  });
});
