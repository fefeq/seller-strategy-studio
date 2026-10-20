import { describe, expect, it } from "vitest";
import { closedAtFromDay, wonDealRows, wonSummary, type WonDealLike } from "./won-deals";
import { segmentCoverage, type SegLike } from "./segment-coverage";
import { quarterRange } from "./metrics";

const smb: SegLike = { id: "smb", name: "SMB", acv_min: 0, acv_max: 5000, win_rate_target: null, cac_target: null, gross_margin_pct: 80, payback_months: 6 };
const mid: SegLike = { id: "mid", name: "Mid-market", acv_min: 5000, acv_max: 50000, win_rate_target: null, cac_target: null, gross_margin_pct: 80, payback_months: 12 };
const segs = [smb, mid];
const q4 = quarterRange("2026-Q4");
let n = 0;
const deal = (o: Partial<WonDealLike>): WonDealLike => ({ id: `d${++n}`, name: "Deal", segment_id: null, amount: 20000, stage: "won", close_date: null, closed_at: "2026-10-20T12:00:00Z", updated_at: "2026-10-21", created_at: "2026-09-01", ...o });

describe("won deals", () => {
  it("only won deals closed in the quarter count; without closed_at the last update is used and flagged", () => {
    const rows = wonDealRows([
      deal({}),
      deal({ closed_at: "2026-09-30T12:00:00Z" }),
      deal({ stage: "proposal" }),
      deal({ closed_at: null, updated_at: "2026-11-02" }),
    ], segs, q4);
    expect(rows).toHaveLength(2);
    const estimated = rows.find((r) => r.dateSource === "estimada");
    expect(estimated?.closedOn).toBe("2026-11-02");
    expect(estimated?.issues).toContain("sin_fecha");
  });

  it("segment is the explicit one, otherwise assigned by amount; no amount and no segment is flagged", () => {
    const [a, b, c] = wonDealRows([
      deal({ segment_id: "smb", amount: 30000, closed_at: "2026-12-01T12:00:00Z" }),
      deal({ amount: 3000, closed_at: "2026-11-01T12:00:00Z" }),
      deal({ amount: null, closed_at: "2026-10-05T12:00:00Z" }),
    ], segs, q4);
    expect([a.segmentId, a.segmentSource]).toEqual(["smb", "manual"]);
    expect([b.segmentId, b.segmentSource]).toEqual(["smb", "importe"]);
    expect(c.segmentId).toBeNull();
    expect(c.issues).toEqual(expect.arrayContaining(["sin_importe", "sin_segmento"]));
  });

  it("per-segment counts are the same deals the real CAC divides by", () => {
    const deals = [deal({ segment_id: "mid" }), deal({ amount: 2000 }), deal({ amount: 15000 }), deal({ closed_at: "2027-01-02T12:00:00Z" })];
    const s = wonSummary(wonDealRows(deals, segs, q4), segs);
    const cov = segmentCoverage(segs, deals, {}, q4, [{ segment_id: null, channel: "Eventos", amount: 9000 }]);
    expect(s.bySegment.map((x) => x.deals)).toEqual(cov.map((r) => r.cac.customers));
    expect(s.bySegment.map((x) => x.deals)).toEqual([1, 2]);
    expect(s.total.amount).toBe(37000);
  });

  it("a picked day is stored at midday UTC so it stays in its quarter", () => {
    const [r] = wonDealRows([deal({ closed_at: closedAtFromDay("2026-12-31") })], segs, q4);
    expect(r.closedOn).toBe("2026-12-31");
  });
});
