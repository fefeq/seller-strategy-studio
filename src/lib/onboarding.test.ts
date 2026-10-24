import { describe, expect, it } from "vitest";
import { blockBasis, blockOf, blockOrder, blocksDecided, mergeBlock, protectManual, readingCost, showRoadmapCard } from "@/lib/onboarding";
import { proposalItems, type SetupProposal } from "@/lib/setup-extraction";
import { setupStatus, type SetupData } from "@/lib/setup-schema";

const proposal: SetupProposal = {
  summary: "s", currency: "EUR", quarter_quota: 30000,
  positioning: { category: "CRM", one_liner: "Nuevo", value: "Ahorra tiempo" },
  segments: [{ name: "SMB", acv_min: 1000, acv_max: 4000, motion: "plg", win_rate_target: 0.2, ae_quota: 300000 }],
  icps: [{ name: "Agencias", industries: "Marketing", company_size: "10-50", geography: "ES", why_fit: "x", anti_icp: "y" }],
  pillars: [{ title: "P1", pain: null, message: "m", proof: null }],
  target_accounts: [], questions: [],
  basis: [{ block: "segments", level: "confirmed", source: "Web · precios" }],
};
const empty: SetupData = { currency: null, segments: [], icps: [], positioning: null, pillars: [], quotas: [], accounts: 0, deals: 0, quarter: "2026-Q4" };

describe("block order follows the archetype", () => {
  it("enterprise (C) approves accounts before the message", () => {
    expect(blockOrder("C").indexOf("icp")).toBeLessThan(blockOrder("C").indexOf("positioning"));
  });
  it("PLG (A) approves the message before the ICP", () => {
    expect(blockOrder("A").indexOf("positioning")).toBeLessThan(blockOrder("A").indexOf("icp"));
  });
  it("always six blocks, company first", () => {
    for (const a of ["A", "B", "C", "D", "E", null] as const) { expect(blockOrder(a)).toHaveLength(6); expect(blockOrder(a)[0]).toBe("company"); }
  });
});

describe("items and levels", () => {
  it("target accounts belong to the ICP block and quota to goals", () => {
    expect(blockOf({ group: "Cuentas objetivo" })).toBe("icp");
    expect(blockOf({ group: "Cuota" })).toBe("goals");
  });
  it("a block without a stated basis is Nokko's assumption", () => {
    expect(blockBasis(proposal, "icp")).toEqual({ level: "assumed", source: "Supuesto de Nokko" });
    expect(blockBasis(proposal, "segments")).toEqual({ level: "confirmed", source: "Web · precios" });
  });
});

describe("never overwrites what the person wrote", () => {
  it("drops positioning fields that already have a value", () => {
    const items = proposalItems(proposal, [], null);
    const { items: out, kept } = protectManual(items, { ...empty, positioning: { category: "Mi categoría", one_liner: "" } });
    const pos = out.find((i) => i.tool === "update_positioning")!;
    expect(pos.args.category).toBeUndefined();
    expect(pos.args.one_liner).toBe("Nuevo");
    expect(kept).toContain("Posicionamiento: category");
  });
  it("keeps the segment figures already set and the quarter's quota", () => {
    const items = proposalItems(proposal, [], null);
    const { items: out } = protectManual(items, { ...empty, segments: [{ name: "smb", acv_min: 2000, acv_max: 5000, win_rate_target: 0.3, ae_quota: 400000 }], quotas: [{ period: "2026-Q4", amount: 50000 }] });
    expect(out.find((i) => i.tool === "set_quota")).toBeUndefined();
    const seg = out.find((i) => i.tool === "upsert_segment");
    expect(seg?.args.acv_min).toBeUndefined();
    expect(seg?.args.ae_quota).toBeUndefined();
  });
});

describe("redo and progress", () => {
  it("a redo changes only its block", () => {
    const next = { ...proposal, pillars: [{ title: "Otro", pain: null, message: "n", proof: null }], icps: [] };
    const merged = mergeBlock(proposal, next, "messages");
    expect(merged.pillars[0].title).toBe("Otro");
    expect(merged.icps).toHaveLength(1);
  });
  it("approving the positioning block raises the setup progress", () => {
    const before = setupStatus(empty).pct;
    const pos = Object.fromEntries(["best_customers", "alternatives", "differentiation", "value", "trend", "target_customer", "need", "category", "key_benefit", "competitive_alternative", "differentiator", "one_liner", "elevator_pitch"].map((k) => [k, "x"]));
    expect(setupStatus({ ...empty, positioning: pos }).pct).toBeGreaterThan(before);
  });
  it("blocks are done when every present block was approved or skipped", () => {
    const present = new Set(["company", "icp"] as const);
    expect(blocksDecided(blockOrder("B"), { company: { status: "approved", at: "" } }, present)).toBe(false);
    expect(blocksDecided(blockOrder("B"), { company: { status: "approved", at: "" }, icp: { status: "skipped", at: "" } }, present)).toBe(true);
  });
  it("the roadmap card hides when completed or the strategy is at 100 %", () => {
    expect(showRoadmapCard({ completed_at: null }, 40)).toBe(true);
    expect(showRoadmapCard({ completed_at: "2026-10-24" }, 40)).toBe(false);
    expect(showRoadmapCard({ completed_at: null }, 100)).toBe(false);
    expect(showRoadmapCard(null, 0)).toBe(false);
  });
});

describe("reading cost", () => {
  it("express with a web costs one web read; deep adds market and competitors", () => {
    expect(readingCost("express", true)).toBe(0.02);
    expect(readingCost("express", false)).toBe(0);
    expect(readingCost("deep", true)).toBeGreaterThan(readingCost("standard", true));
  });
});
