import { describe, expect, it } from "vitest";
import {
  cohort,
  funnelBySegment,
  funnelStats,
  median,
  parseDateCell,
  type Trial,
} from "./self-service";

const t = (o: Partial<Trial>): Trial => ({
  segment_id: null,
  signed_up_at: "2026-07-01T00:00:00Z",
  activated_at: null,
  converted_at: null,
  mrr: null,
  ...o,
});

describe("self-service funnel", () => {
  const trials = [
    t({
      segment_id: "smb",
      activated_at: "2026-07-03T00:00:00Z",
      converted_at: "2026-07-11T00:00:00Z",
      mrr: 50,
    }),
    t({
      segment_id: "smb",
      activated_at: "2026-07-02T00:00:00Z",
      converted_at: "2026-07-21T00:00:00Z",
      mrr: "100",
    }),
    t({ segment_id: "smb", activated_at: "2026-07-05T00:00:00Z" }),
    t({ segment_id: "smb" }),
    t({ segment_id: "mid" }),
  ];

  it("activation rate is activated over signups", () => {
    expect(funnelStats(trials).activationRate).toBeCloseTo(3 / 5);
  });

  it("trial-to-paid is paid over signups, activated-to-paid over activated", () => {
    const s = funnelStats(trials);
    expect(s.trialToPaid).toBeCloseTo(2 / 5);
    expect(s.activatedToPaid).toBeCloseTo(2 / 3);
  });

  it("time to purchase is the median days from signup to payment", () => {
    expect(funnelStats(trials).medianDaysToPurchase).toBe(15); // 10 and 20 days
    expect(funnelStats(trials).medianDaysToActivate).toBe(2); // 2, 1, 4
  });

  it("new MRR sums paid trials only", () => {
    expect(funnelStats(trials).newMrr).toBe(150);
  });

  it("empty cohort yields zero rates and no medians", () => {
    const s = funnelStats([]);
    expect(s.activationRate).toBe(0);
    expect(s.medianDaysToPurchase).toBeNull();
  });

  it("groups by segment, largest cohort first", () => {
    const g = funnelBySegment(trials);
    expect(g.map((x) => x.segment_id)).toEqual(["smb", "mid"]);
    expect(g[0].trialToPaid).toBeCloseTo(0.5);
    expect(g[1].activationRate).toBe(0);
  });

  it("cohort keeps signups inside [start, end)", () => {
    const list = [
      t({ signed_up_at: "2026-06-30T23:00:00Z" }),
      t({ signed_up_at: "2026-07-01T00:00:00Z" }),
      t({ signed_up_at: "2026-10-01T00:00:00Z" }),
    ];
    expect(
      cohort(list, new Date("2026-07-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z")),
    ).toHaveLength(1);
  });

  it("median and date parsing", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(parseDateCell("15/08/2026")).toBe("2026-08-15T00:00:00.000Z");
    expect(parseDateCell("2026-08-15")).toBe("2026-08-15T00:00:00.000Z");
    expect(parseDateCell("nope")).toBeNull();
  });
});
