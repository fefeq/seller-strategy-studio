import { describe, expect, it } from "vitest";
import { verificationEmails, loadEmailVerifications } from "./email-verification-read";
import type { Db } from "./org-data";

describe("NK-0173 CA-2 verification reads", () => {
  it("normalizes and deduplicates visible addresses without empty values", () => {
    expect(verificationEmails([" A@EXAMPLE.INVALID ", "a@example.invalid", null, " "])).toEqual(["a@example.invalid"]);
  });
  it("scopes each read to the company and returns the shared stored verification", async () => {
    const filters: unknown[] = [];
    const row = { email: "a@example.invalid", status: "verified", checked_at: "2026-11-13T00:00:00Z" };
    const db = { from: () => ({ select: () => ({ eq: (key: string, value: string) => {
      filters.push([key, value]);
      return { in: async (key: string, values: string[]) => { filters.push([key, values]); return { data: [row], error: null }; } };
    } }) }) } as unknown as Db;
    expect(await loadEmailVerifications(db, "org-synthetic", [" A@EXAMPLE.INVALID "])).toEqual([row]);
    expect(filters).toEqual([["org_id", "org-synthetic"], ["email", ["a@example.invalid"]]]);
  });
  it("does not read with no company or no address", async () => {
    const db = { from: () => { throw new Error("Unexpected read"); } } as unknown as Db;
    expect(await loadEmailVerifications(db, null, ["a@example.invalid"])).toEqual([]);
    expect(await loadEmailVerifications(db, "org-synthetic", [])).toEqual([]);
  });
  it("keeps read errors distinct from a verified result", async () => {
    const db = { from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: null, error: { code: "42501" } }) }) }) }) } as unknown as Db;
    await expect(loadEmailVerifications(db, "org-synthetic", ["a@example.invalid"])).rejects.toEqual({ code: "42501" });
  });
});