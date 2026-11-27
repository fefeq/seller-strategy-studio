// @vitest-environment node
// SDD-20261121-agent-turn-metrics (NK-0191), CA-7 and CA-9: an insert that carries turn_id still works while migration
// 0109 is not applied. Fictional errors; nothing is written anywhere.
import { describe, expect, it, vi } from "vitest";
import { missingColumn, withTurnId } from "@/lib/agent/turn-id";

describe("missingColumn", () => {
  it("CA-9: reads the PostgREST and Postgres codes of a column that does not exist, never the message", () => {
    expect(missingColumn({ code: "PGRST204", message: "" })).toBe(true);
    expect(missingColumn({ code: "42703", message: "" })).toBe(true);
    expect(missingColumn({ code: "42501", message: "column turn_id does not exist" })).toBe(false);
    expect(missingColumn({ code: "42P01" })).toBe(false);
    expect(missingColumn({ message: "Could not find the 'turn_id' column" })).toBe(false);
    expect(missingColumn(null)).toBe(false);
    expect(missingColumn(undefined)).toBe(false);
  });
});

describe("withTurnId", () => {
  it("CA-7: with the column in place the insert runs once, with the turn id", async () => {
    const run = vi.fn(async (_withTurn: boolean) => ({ data: { id: "a" }, error: null }));
    expect(await withTurnId(run)).toEqual({ data: { id: "a" }, error: null });
    expect(run.mock.calls).toEqual([[true]]);
  });

  it.each(["PGRST204", "42703"])(
    "CA-7/CA-9: a missing column (%s) repeats the insert once without the turn id",
    async (code) => {
      const run = vi.fn(async (withTurn: boolean) =>
        withTurn ? { data: null, error: { code } } : { data: { id: "a" }, error: null },
      );
      expect(await withTurnId(run)).toEqual({ data: { id: "a" }, error: null });
      expect(run.mock.calls).toEqual([[true], [false]]);
    },
  );

  it("CA-9: any other error is returned as it is, with no second insert", async () => {
    const error = { code: "42501" };
    const run = vi.fn(async (_withTurn: boolean) => ({ data: null, error }));
    expect((await withTurnId(run)).error).toBe(error);
    expect(run.mock.calls).toEqual([[true]]);
  });

  it("CA-9: the insert is repeated only once, also when it fails again", async () => {
    const run = vi.fn(async (_withTurn: boolean) => ({ data: null, error: { code: "PGRST204" } }));
    expect((await withTurnId(run)).error).toEqual({ code: "PGRST204" });
    expect(run.mock.calls).toEqual([[true], [false]]);
  });
});
