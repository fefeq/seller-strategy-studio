// NK-0074: a won deal that arrives through the lead intake cannot carry a close moment in the future.
import { expect, it } from "vitest";
import { closedAtFor, closeDayFor } from "@/lib/leads-ingest";

const now = new Date("2026-11-15T09:00:00Z");

it("an open stage has no close moment", () => {
  expect(closedAtFor("proposal", false, "2026-11-10", now)).toBeNull();
});
it("a won deal keeps a past close date and is closed as of now when the date is still to come", () => {
  expect(closedAtFor("won", true, "2026-11-10", now)).toBe("2026-11-10T12:00:00Z");
  expect(closedAtFor("won", true, "2026-12-01", now)).toBe("2026-11-15T09:00:00.000Z");
  expect(closedAtFor("won", true, null, now)).toBe("2026-11-15T09:00:00.000Z");
});
it("a lost deal keeps the date it was given", () => {
  expect(closedAtFor("lost", true, "2026-12-01", now)).toBe("2026-12-01T12:00:00Z");
});
it("the close day follows: today for a won deal with a day still to come, untouched otherwise", () => {
  expect(closeDayFor("won", "2026-12-01", now)).toBe("2026-11-15");
  expect(closeDayFor("won", "2026-11-10", now)).toBe("2026-11-10");
  expect(closeDayFor("lost", "2026-12-01", now)).toBe("2026-12-01");
  expect(closeDayFor("proposal", "2026-12-01", now)).toBe("2026-12-01");
  expect(closeDayFor("won", null, now)).toBeNull();
});
