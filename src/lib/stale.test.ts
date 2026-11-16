import { describe, expect, it } from "vitest";
import { readStaleDays, staleDeals, staleThreshold, thresholdText } from "./stale";
import type { SegLike } from "./segment-coverage";

const now = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const seg = (id: string, acv_min: number, acv_max: number): SegLike => ({
  id,
  name: id,
  acv_min,
  acv_max,
  win_rate_target: null,
  cac_target: null,
  gross_margin_pct: null,
  payback_months: null,
});
const SEGS = [seg("smb", 0, 10_000), seg("mid", 10_000, 100_000)];
const deal = (
  id: string,
  o: Partial<{
    stage: string;
    amount: number;
    segment_id: string | null;
    created: number;
    closed: number | null;
    updated: number;
  }>,
) => ({
  id,
  stage: o.stage ?? "demo",
  amount: o.amount ?? 5000,
  segment_id: o.segment_id ?? null,
  close_date: null,
  created_at: daysAgo(o.created ?? 30),
  closed_at: o.closed == null ? null : daysAgo(o.closed),
  updated_at: daysAgo(o.updated ?? 0),
});

describe("threshold", () => {
  it("is 14 days when nothing is known", () => {
    expect(staleThreshold(null, null)).toEqual({ days: 14, source: "defecto", cycleDays: null });
  });
  it("is a quarter of the real cycle, never under 14 nor over 60", () => {
    expect(staleThreshold(30, null).days).toBe(14);
    expect(staleThreshold(90, null)).toEqual({ days: 23, source: "ciclo", cycleDays: 90 });
    expect(staleThreshold(400, null).days).toBe(60);
  });
  it("the company's own number wins over the cycle", () => {
    expect(staleThreshold(90, 10)).toEqual({ days: 10, source: "empresa", cycleDays: 90 });
    expect(staleThreshold(90, 0).source).toBe("ciclo");
  });
  it("reads the override from the settings json", () => {
    expect(readStaleDays({ new: 1, stale_deal_days: 21 })).toBe(21);
    expect(readStaleDays({ stale_deal_days: "x" })).toBeNull();
    expect(readStaleDays(null)).toBeNull();
  });
  it("explains itself", () => {
    expect(thresholdText(staleThreshold(90, null))).toBe(
      "23 días, un cuarto del ciclo real de 90 días",
    );
    expect(thresholdText(staleThreshold(null, 21))).toBe("21 días, fijado por la empresa");
    expect(thresholdText(staleThreshold(null, null))).toBe(
      "14 días por defecto: aún no hay ciclo real",
    );
  });
});

describe("cold deals", () => {
  // mid-market won deals took 120 days → threshold 30; smb has no wins → company cycle (median of all wins).
  const won = [
    deal("w1", { stage: "won", amount: 50_000, created: 200, closed: 80 }),
    deal("w2", { stage: "won", amount: 60_000, created: 150, closed: 30 }),
  ];
  it("uses the segment's real cycle", () => {
    const rows = staleDeals(
      [
        ...won,
        deal("a", { amount: 50_000, updated: 20 }),
        deal("b", { amount: 50_000, updated: 31 }),
      ],
      SEGS,
      null,
      now,
    );
    const a = rows.find((r) => r.deal.id === "a")!;
    const b = rows.find((r) => r.deal.id === "b")!;
    expect(a.threshold).toEqual({ days: 30, source: "ciclo", cycleDays: 120 });
    expect(a.stale).toBe(false);
    expect(b.stale).toBe(true);
    expect(b.idleDays).toBe(31);
  });
  it("a segment without won deals falls back to the company's cycle", () => {
    const rows = staleDeals([...won, deal("s", { amount: 2000, updated: 29 })], SEGS, null, now);
    expect(rows.find((r) => r.deal.id === "s")!.threshold.cycleDays).toBe(120);
  });
  it("without any won deal the default applies", () => {
    const rows = staleDeals([deal("x", { updated: 15 })], SEGS, null, now);
    expect(rows[0].threshold.source).toBe("defecto");
    expect(rows[0].stale).toBe(true);
  });
  it("the company override applies to every deal and closed deals are never listed", () => {
    const rows = staleDeals([...won, deal("x", { updated: 8 })], SEGS, 7, now);
    expect(rows.map((r) => r.deal.id)).toEqual(["x"]);
    expect(rows[0].stale).toBe(true);
  });
});
