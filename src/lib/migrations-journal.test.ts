import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { journalProblems, type JournalEntry } from "./migrations-journal";

const e = (idx: number, tag: string, when: number): JournalEntry => ({ idx, tag, when });

describe("journalProblems", () => {
  it("accepts an append-only journal where the file number is only a name", () => {
    const entries = [
      e(0, "0058_a", 10),
      e(1, "0060_b", 20),
      e(2, "0063_c", 30),
      e(3, "0059_late", 40),
    ];
    expect(journalProblems(entries, ["0058_a", "0060_b", "0063_c", "0059_late"])).toEqual([]);
  });

  it("flags a number used by two files", () => {
    const entries = [e(0, "0064_x", 10), e(1, "0064_y", 20)];
    expect(journalProblems(entries, ["0064_x", "0064_y"])).toEqual([
      "number 0064 is used by 0064_x, 0064_y",
    ]);
  });

  it("flags a file without entry and an entry without file", () => {
    const entries = [e(0, "0058_a", 10), e(1, "0059_gone", 20)];
    expect(journalProblems(entries, ["0058_a", "0060_new"])).toEqual([
      "0060_new.sql has no journal entry",
      "journal entry 0059_gone has no .sql file",
    ]);
  });

  it("flags an idx that is not the position", () => {
    const entries = [e(0, "0058_a", 10), e(2, "0060_b", 20)];
    expect(journalProblems(entries, ["0058_a", "0060_b"])).toEqual([
      "0060_b: idx is 2, expected 1 (its position)",
    ]);
  });

  it("flags a when that does not exceed the previous one (an entry inserted in the middle)", () => {
    const entries = [e(0, "0058_a", 10), e(1, "0059_mid", 40), e(2, "0060_b", 20)];
    expect(journalProblems(entries, ["0058_a", "0059_mid", "0060_b"])).toEqual([
      "0060_b: when 20 does not exceed 0059_mid (40)",
    ]);
  });

  it("flags an equal when", () => {
    const entries = [e(0, "0058_a", 10), e(1, "0060_b", 10)];
    expect(journalProblems(entries, ["0058_a", "0060_b"])).toHaveLength(1);
  });
});

describe("the real journal", () => {
  // vitest runs from the repo root
  const dir = `${process.cwd()}/drizzle/migrations/`;
  const entries = (
    JSON.parse(readFileSync(`${dir}meta/_journal.json`, "utf8")) as { entries: JournalEntry[] }
  ).entries;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, -4));

  it("follows the rules (one number per file, one entry per file, idx = position, when strictly growing)", () => {
    expect(journalProblems(entries, files)).toEqual([]);
  });
});
