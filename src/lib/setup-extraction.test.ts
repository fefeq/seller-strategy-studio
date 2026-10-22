import { describe, expect, it } from "vitest";
import { proposalItems, segmentRangeWarning, SETUP_EXTRACTION_SCHEMA, type SetupProposal } from "./setup-extraction";

const base: SetupProposal = {
  summary: "",
  currency: null,
  positioning: {},
  segments: [],
  icps: [],
  pillars: [],
  target_accounts: [],
  questions: [],
};

describe("setup proposal", () => {
  it("turns the quarter quota into a set_quota item", () => {
    const items = proposalItems({ ...base, quarter_quota: 30000 }, [], "EUR");
    expect(items).toEqual([expect.objectContaining({ key: "quota", tool: "set_quota", args: { amount: 30000 } })]);
    expect(proposalItems({ ...base, quarter_quota: null }, [], "EUR")).toEqual([]);
  });
  it("passes a segment's margin to upsert_segment and updates an existing one by name", () => {
    const [item] = proposalItems(
      { ...base, segments: [{ name: "Asesorías", acv_min: 2388, acv_max: 2388, motion: "plg", win_rate_target: null, ae_quota: null, gross_margin_pct: 80 }] },
      [{ id: "s1", name: "asesorías" }],
      "EUR",
    );
    expect(item.args).toMatchObject({ segment_id: "s1", gross_margin_pct: 80, acv_min: 2388, acv_max: 2388 });
  });
  it("a single price (mín = máx) is allowed, with a note", () => {
    expect(segmentRangeWarning(2388, 2388)).toMatch(/único precio/);
    expect(segmentRangeWarning(500, 100)).toMatch(/mayor/);
    expect(segmentRangeWarning(100, 500)).toBeNull();
  });
  it("the strict schema requires every field, including the new ones", () => {
    const s = SETUP_EXTRACTION_SCHEMA as unknown as { required: string[]; properties: { segments: { items: { required: string[] } } } };
    expect(s.required).toContain("quarter_quota");
    expect(s.properties.segments.items.required).toContain("gross_margin_pct");
  });
});
