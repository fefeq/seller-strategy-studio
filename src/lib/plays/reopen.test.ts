// SDD-20261109-plays-no-reopen, U-1 (CA-9): which closed suggestions of a play's rules come back. Pure. Ids and keys are fictional.
import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { reopenable } from "./reopen";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const PLAY = CATALOG.find((p) => p.detectors.includes("meeting_no_prep"))!;
const closed = (over: Partial<Parameters<typeof reopenable>[1][number]> = {}) => ({
  id: "s1",
  detector: "meeting_no_prep",
  updated_at: "2026-11-09T10:00:00.000Z",
  snoozed_until: null as string | null,
  ...over,
});
const row = (over: Partial<Parameters<typeof reopenable>[0][number]> = {}) => ({
  play_id: PLAY.id,
  enabled: true,
  updated_at: "2026-11-09T11:00:00.000Z",
  ...over,
});

describe("reopenable", () => {
  it("never reopens without rows", () => {
    expect(reopenable([], [closed()], NOW).get("s1")).toBeNull();
  });
  it("reopens as pending when the play was resumed after the closing", () => {
    expect(reopenable([row()], [closed()], NOW).get("s1")).toEqual({
      status: "pending",
      snoozed_until: null,
    });
  });
  it("does not reopen a row older than the closing, or equal to it", () => {
    expect(reopenable([row({ updated_at: "2026-11-09T09:00:00.000Z" })], [closed()], NOW).get("s1")).toBeNull();
    expect(reopenable([row({ updated_at: "2026-11-09T10:00:00.000Z" })], [closed()], NOW).get("s1")).toBeNull();
  });
  it("does not reopen when the play is paused", () => {
    expect(reopenable([row({ enabled: false })], [closed()], NOW).get("s1")).toBeNull();
  });
  it("keeps a snooze that is still in the future, drops one that passed", () => {
    expect(
      reopenable([row()], [closed({ snoozed_until: "2026-11-10T00:00:00.000Z" })], NOW).get("s1"),
    ).toEqual({ status: "snoozed", snoozed_until: "2026-11-10T00:00:00.000Z" });
    expect(
      reopenable([row()], [closed({ snoozed_until: "2026-11-08T00:00:00.000Z" })], NOW).get("s1"),
    ).toEqual({ status: "pending", snoozed_until: null });
  });
  it("compares instants, not strings (PostgREST format with microseconds against toISOString)", () => {
    // Same instant, different text: not later, so no reopening. As strings "+00:00" sorts before "Z"... and "." ordering differs.
    expect(
      reopenable(
        [row({ updated_at: "2026-11-09T10:00:00.123456+00:00" })],
        [closed({ updated_at: "2026-11-09T10:00:00.123Z" })],
        NOW,
      ).get("s1"),
    ).toBeNull();
    // Microseconds later than the closing: reopens, although the string would compare lower ("+" < "Z").
    expect(
      reopenable(
        [row({ updated_at: "2026-11-09T10:00:00.124456+00:00" })],
        [closed({ updated_at: "2026-11-09T10:00:00.123Z" })],
        NOW,
      ).get("s1"),
    ).toEqual({ status: "pending", snoozed_until: null });
  });
  it("ignores rows of plays outside the catalogue and detectors that belong to no play", () => {
    const r = reopenable(
      [row({ play_id: "no-such-play" }), row({ play_id: PLAY.id })],
      [closed({ id: "s2", detector: "stale_deal" }), closed({ id: "s3", detector: "setup_incomplete" })],
      NOW,
    );
    expect(r.has("s2")).toBe(false);
    expect(r.has("s3")).toBe(false);
    expect(reopenable([row({ play_id: "no-such-play" })], [closed()], NOW).get("s1")).toBeNull();
  });
  it("only a row of the detector's own play counts", () => {
    const other = CATALOG.find((p) => p.detectors.length > 0 && !p.detectors.includes("meeting_no_prep"))!;
    expect(reopenable([row({ play_id: other.id })], [closed()], NOW).get("s1")).toBeNull();
  });
});
