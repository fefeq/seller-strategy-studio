import { describe, expect, it } from "vitest";
import { parseSourceStatuses } from "./onboarding-source-refs";

describe("F10: stored read status validation", () => {
  it("accepts valid states and copies only supported fields", () => {
    expect(
      parseSourceStatuses([
        {
          name: "Sintético",
          kind: "drive",
          state: "partial",
          read: 60_000,
          total: 96_000,
          extra: "ignored",
        },
      ]),
    ).toEqual([
      { name: "Sintético", kind: "drive", state: "partial", read: 60_000, total: 96_000 },
    ]);
  });
  it("rejects malformed, impossible and non-finite states", () => {
    expect(
      parseSourceStatuses([
        null,
        { name: "Sintético", kind: "web", state: "full", read: 1, total: 1 },
        { name: "Sintético", kind: "drive", state: "full", read: 1, total: 20 },
        { name: "Sintético", kind: "drive", state: "partial", read: -1, total: 20 },
        { name: "Sintético", kind: "drive", state: "partial", read: NaN, total: 20 },
      ]),
    ).toEqual([]);
    expect(parseSourceStatuses({})).toEqual([]);
  });
});
