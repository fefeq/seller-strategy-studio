import { describe, expect, it } from "vitest";
import { fetchAll, PAGE } from "./fetch-all";

const table = (n: number) => Array.from({ length: n }, (_, i) => i);
const pager = (all: number[]) => async (from: number, to: number) => ({ data: all.slice(from, to + 1), error: null });

describe("fetchAll", () => {
  it("reads past the 1000-row default instead of stopping there", async () => {
    const r = await fetchAll(pager(table(2500)));
    expect(r.rows.length).toBe(2500);
    expect(r.truncated).toBe(false);
  });
  it("exactly one page still finishes", async () => {
    expect((await fetchAll(pager(table(PAGE)))).rows.length).toBe(PAGE);
  });
  it("says when the safety ceiling cut the list", async () => {
    const r = await fetchAll(pager(table(5000)), 3000);
    expect(r.rows.length).toBe(3000);
    expect(r.truncated).toBe(true);
  });
  it("a read error is thrown, never an empty success", async () => {
    await expect(fetchAll(async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });
});
