import { describe, expect, it } from "vitest";
import { hourKey, isHeartbeatFresh } from "./events";
import { leadEvents } from "./lead-events";

const NOW = new Date("2026-10-24T10:30:00Z");

describe("heartbeat", () => {
  it("uses the background only if Inngest answered in the last 3 hours", () => {
    expect(isHeartbeatFresh("2026-10-24T08:00:00Z", NOW)).toBe(true);
    expect(isHeartbeatFresh("2026-10-24T07:00:00Z", NOW)).toBe(false);
    expect(isHeartbeatFresh(null, NOW)).toBe(false);
  });
  it("keeps one maintenance run per company and hour", () => {
    expect(hourKey(NOW)).toBe("2026-10-24T10");
  });
});

describe("leadEvents", () => {
  const base = {
    id: "l1",
    stage: "new",
    contacted_at: null,
    enriched_at: null,
    created_at: "2026-10-24T10:00:00Z",
  };
  it("asks to enrich a new lead not enriched yet", () => {
    expect(leadEvents("o", base, NOW).map((e) => e.name)).toEqual([
      "nokko/lead.created",
      "nokko/lead.changed",
    ]);
  });
  it("does not enrich again or after two days", () => {
    expect(
      leadEvents("o", { ...base, enriched_at: "2026-10-24T10:05:00Z" }, NOW).map((e) => e.name),
    ).toEqual(["nokko/lead.changed"]);
    expect(
      leadEvents("o", { ...base, created_at: "2026-10-21T10:00:00Z" }, NOW).map((e) => e.name),
    ).toEqual(["nokko/lead.changed"]);
  });
  it("starts the follow-up sequence in Contactado with its contact date", () => {
    const ev = leadEvents(
      "o",
      { ...base, enriched_at: "x", stage: "contacted", contacted_at: "2026-10-24T09:00:00Z" },
      NOW,
    );
    expect(ev[1]).toEqual({
      name: "nokko/lead.contacted",
      data: { org_id: "o", lead_id: "l1", contacted_at: "2026-10-24T09:00:00Z" },
    });
  });
});
