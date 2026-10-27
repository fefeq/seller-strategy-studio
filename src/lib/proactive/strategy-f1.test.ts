// F1 (SDD-20261027, H-3): one block per CA-12..CA-25. Fictional data only.
import { describe, expect, it } from "vitest";
import { detect, STRATEGY_DETECTORS, DETECTORS } from "./index";
import type { Snapshot, StrategyData } from "./types";
import { icpIdle, icpUncoveredWins } from "./detectors/strategy-icp";
import { dealsWithoutSegment, segmentCostsMissing, segmentLowCoverage } from "./detectors/strategy-segments";
import { stageBottleneck } from "./detectors/strategy-pipeline";
import { productRepeatedDiscount, productUnsold } from "./detectors/strategy-product";
import { makePositioningMissing, positioningMissing } from "./detectors/strategy-positioning";
import { repeatedLoss } from "./detectors/strategy-losses";
import { canViewStrategy, parseStrategy } from "@/lib/strategy-suggestions";
import { POSITIONING_FIELDS, type SetupData } from "@/lib/setup-schema";

const NOW = new Date("2026-10-27T10:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 864e5).toISOString();
const fullPos = Object.fromEntries(POSITIONING_FIELDS.map(([k]) => [k, "x"]));
const setup = (o: Partial<SetupData> = {}): SetupData => ({ currency: "EUR", segments: [], icps: [], positioning: fullPos, pillars: [], quotas: [], accounts: 0, deals: 0, quarter: "2026-Q4", ...o });
const data = (o: Partial<StrategyData> = {}): StrategyData => ({ icps: [], accounts: [], deals: [], history: [], products: [], lines: [], costs: [], budgets: [], ...o });
const snap = (d: Partial<StrategyData> = {}, o: Partial<Snapshot> = {}): Snapshot => ({
  now: NOW, orgId: "o", setup: setup(), deals: [], meetings: [], accounts: [], stakeholders: [], registrations: [], trials: [], segments: [], strategy: data(d), ...o,
});
const acc = (id: string, o: object = {}) => ({ id, name: `Cuenta ${id}`, industry: null, size: null, country: null, segment_id: null, tier: null, ...o });
const deal = (id: string, o: object = {}) => ({ id, name: `Deal ${id}`, stage: "discovery", amount: 10000, account_id: null, segment_id: null, close_date: "2026-11-15", created_at: ago(30), closed_at: null, updated_at: ago(1), lost_reason: null, lost_competitor: null, ...o });
const icp = (id: string, o: object = {}) => ({ id, name: `ICP ${id}`, industries: null, company_size: null, geography: null, countries: [] as string[], anti_icp: null, segment_id: null, created_at: ago(200), ...o });
const seg = (id: string, o: object = {}) => ({ id, name: `Seg ${id}`, acv_min: 1000, acv_max: 5000, ...o });

describe("CA-12 won deals outside every ICP", () => {
  const won = [deal("d1", { stage: "won", account_id: "a1" }), deal("d2", { stage: "won", account_id: "a2" })];
  const accounts = [acc("a1", { industry: "Logística" }), acc("a2", { industry: "logistica" })];
  it("suggests creating an ICP citing the deals and accounts", () => {
    const [x] = icpUncoveredWins(snap({ deals: won, accounts, icps: [icp("i1", { industries: "Salud" })] }));
    expect(x.strategy!.element).toBe("icp");
    expect(x.strategy!.kind).toBe("create");
    expect(x.strategy!.evidence.map((e) => `${e.table}:${e.id}`).sort()).toEqual(["accounts:a1", "accounts:a2", "deals:d1", "deals:d2"]);
  });
  it("does nothing when an ICP already covers the sector, or with a single won deal", () => {
    expect(icpUncoveredWins(snap({ deals: won, accounts, icps: [icp("i1", { industries: "Logística y transporte" })] }))).toEqual([]);
    expect(icpUncoveredWins(snap({ deals: won.slice(0, 1), accounts, icps: [] }))).toEqual([]);
  });
  it("also groups by country, covered by the ICP countries", () => {
    const a = [acc("a1", { country: "Chile" }), acc("a2", { country: "chile" })];
    expect(icpUncoveredWins(snap({ deals: won, accounts: a })).map((x) => x.dedupe_key)).toEqual(["strategy_icp:uncovered_win:country:chile"]);
    expect(icpUncoveredWins(snap({ deals: won, accounts: a, icps: [icp("i1", { countries: ["Chile"] })] }))).toEqual([]);
  });
});

describe("CA-13 ICP idle for more than 90 days", () => {
  const i1 = icp("i1", { industries: "Salud", created_at: ago(120) });
  it("suggests reviewing or archiving it when no account fits", () => {
    const [x] = icpIdle(snap({ icps: [i1], accounts: [acc("a1", { industry: "Minería" })] }));
    expect(x.strategy!.kind).toBe("close");
    expect(x.strategy!.evidence[0]).toMatchObject({ table: "icp_profiles", id: "i1" });
  });
  it("not when something fits, when it is recent or when it has nothing to compare", () => {
    expect(icpIdle(snap({ icps: [i1], accounts: [acc("a1", { industry: "Salud digital" })] }))).toEqual([]);
    expect(icpIdle(snap({ icps: [{ ...i1, created_at: ago(30) }], accounts: [] }))).toEqual([]);
    expect(icpIdle(snap({ icps: [icp("i2", { created_at: ago(300) })], accounts: [] }))).toEqual([]);
  });
});

describe("CA-14 segment targets without costs", () => {
  const withTarget = [{ ...seg("s1", { name: "Medianas" }), cac_target: 500, payback_months: null }];
  it("asks for the costs and shows no projected payback", () => {
    const [x] = segmentCostsMissing(snap({}, { segments: withTarget }));
    expect(x.strategy!.kind).toBe("missing_data");
    expect(`${x.title} ${x.body}`).not.toMatch(/\d/);
    expect(`${x.title} ${x.body}`.toLowerCase()).not.toContain("proyectado");
  });
  it("not once costs exist, nor without a target", () => {
    expect(segmentCostsMissing(snap({ costs: [{ segment_id: "s1", period: "2026-Q3" }] }, { segments: withTarget }))).toEqual([]);
    expect(segmentCostsMissing(snap({}, { segments: [{ ...seg("s1"), cac_target: null, payback_months: null }] }))).toEqual([]);
  });
});

describe("CA-15 two quarters under healthy coverage", () => {
  const budgets = [{ segment_id: "s1", period: "2026-Q4", plan_revenue: 100000 }, { segment_id: "s1", period: "2027-Q1", plan_revenue: 100000 }];
  const segments = [seg("s1")];
  it("fires when both quarters are below 3x", () => {
    const deals = [deal("d1", { segment_id: "s1", amount: 100000, close_date: "2026-11-30" }), deal("d2", { segment_id: "s1", amount: 50000, close_date: "2027-02-10" })];
    const [x] = segmentLowCoverage(snap({ budgets, deals }, { segments }));
    expect(x.strategy!.element).toBe("segment");
    expect(x.title).toContain("2026-Q4");
    expect(x.title).toContain("2027-Q1");
  });
  it("not if one quarter is healthy or a target is missing", () => {
    const ok = [deal("d1", { segment_id: "s1", amount: 100000, close_date: "2026-11-30" }), deal("d2", { segment_id: "s1", amount: 350000, close_date: "2027-02-10" })];
    expect(segmentLowCoverage(snap({ budgets, deals: ok }, { segments }))).toEqual([]);
    expect(segmentLowCoverage(snap({ budgets: budgets.slice(0, 1) }, { segments }))).toEqual([]);
  });
});

describe("CA-16 open deals without segment", () => {
  it("lists them; closed deals and deals with a segment do not count", () => {
    const [x] = dealsWithoutSegment(snap({ deals: [deal("d1", { amount: null }), deal("d2", { amount: null }), deal("d3", { segment_id: "s1" }), deal("d4", { stage: "won", amount: null })] }, { segments: [seg("s1")] }));
    expect(x.strategy!.evidence.map((e) => e.id).sort()).toEqual(["d1", "d2"]);
    expect(x.strategy!.sample_size).toBe(3);
    expect(dealsWithoutSegment(snap({ deals: [deal("d3", { segment_id: "s1" })] }, { segments: [seg("s1")] }))).toEqual([]);
  });
});

describe("CA-17 stage that concentrates deals and converts worst", () => {
  const hist = (id: string, ...to: string[]) => to.map((t, i) => ({ deal_id: id, from_stage: null, to_stage: t, changed_at: ago(100 - i) }));
  // 6 deals reached discovery, all 6 reached qualified; only 2 of the 6 reached demo → «qualified» converts worst.
  const history = Array.from({ length: 6 }, (_, i) => hist(`h${i}`, "discovery", "qualified", ...(i < 2 ? ["demo"] : []))).flat();
  const open = ["q1", "q2", "q3", "q4"].map((id) => deal(id, { stage: "qualified" })).concat([deal("x1", { stage: "demo" })]);
  it("cites conversion and sample", () => {
    const [x] = stageBottleneck(snap({ deals: open, history }));
    expect(x.strategy!.element).toBe("pipeline");
    expect(x.title).toContain("33 %");
    expect(x.strategy!.sample_size).toBeGreaterThanOrEqual(6);
    expect(x.strategy!.evidence).toHaveLength(4);
  });
  it("CA-25: without enough history it says what is missing instead of a rate", () => {
    const [x] = stageBottleneck(snap({ deals: open, history: history.slice(0, 6) }));
    expect(x.strategy!.kind).toBe("missing_data");
    expect(x.strategy!.evidence).toEqual([]);
    expect(x.title).not.toMatch(/%/);
  });
  it("not when the busiest stage is not the worst converting one", () => {
    const busyDemo = ["q1", "q2", "q3"].map((id) => deal(id, { stage: "demo" }));
    const better = Array.from({ length: 6 }, (_, i) => hist(`b${i}`, "discovery", "qualified", "demo", "proposal")).flat();
    expect(stageBottleneck(snap({ deals: busyDemo, history: [...history, ...better] }))).toEqual([]);
  });
});

describe("CA-18 repeated discount or free line", () => {
  const products = [{ id: "p1", name: "Plan Pro", active: true, created_at: ago(500) }];
  const dealsX = ["d1", "d2", "d3"].map((id) => deal(id));
  const line = (deal_id: string, o: object = {}) => ({ id: `l-${deal_id}`, deal_id, product_id: "p1", name: "Plan Pro", discount_pct: 20, unit_price: 100, created_at: ago(10), ...o });
  it("same discount in 3 deals → suggestion with price cause", () => {
    const [x] = productRepeatedDiscount(snap({ products, deals: dealsX, lines: dealsX.map((d) => line(d.id)) }));
    expect(x.strategy!.element).toBe("product_price");
    expect(x.dedupe_key).toBe("strategy_product_price:price:discount:20:p1");
    expect(x.strategy!.evidence.map((e) => e.table)).toContain("products");
  });
  it("free lines repeat too; two deals are not enough", () => {
    expect(productRepeatedDiscount(snap({ products, deals: dealsX, lines: dealsX.map((d) => line(d.id, { discount_pct: 0, unit_price: 0 })) }))[0].dedupe_key).toContain("price:free:p1");
    expect(productRepeatedDiscount(snap({ products, deals: dealsX, lines: dealsX.slice(0, 2).map((d) => line(d.id)) }))).toEqual([]);
  });
});

describe("CA-19 price suggestions hidden from roles that cannot price", () => {
  const price = { detector: "strategy_product_price", dedupe_key: "strategy_product_price:price:discount:20:p1" };
  it("owner, sales_leader and deal_desk see them; the rest do not", () => {
    for (const r of ["owner", "sales_leader", "deal_desk"]) expect(canViewStrategy(price, [r])).toBe(true);
    for (const r of ["ae", "sdr", "viewer"]) expect(canViewStrategy(price, [r])).toBe(false);
    expect(canViewStrategy(price, [])).toBe(false);
  });
  it("other strategic suggestions, including the catalog one, stay visible to everyone", () => {
    expect(canViewStrategy({ detector: "strategy_product_price", dedupe_key: "strategy_product_price:catalog:unsold:p1" }, ["ae"])).toBe(true);
    expect(canViewStrategy({ detector: "strategy_icp", dedupe_key: "strategy_icp:x" }, ["ae"])).toBe(true);
  });
  it("is the same role set as canPrice of the agent", async () => {
    const { canPrice } = await import("@/lib/agent/tool-kit");
    for (const r of ["owner", "sales_leader", "deal_desk", "ae", "sdr", "viewer", "csm"]) expect(canPrice([r])).toBe(canViewStrategy(price, [r]));
  });
});

describe("CA-20 active product with no deal in the last year", () => {
  const p = (o: object = {}) => ({ id: "p1", name: "Plan Pro", active: true, created_at: ago(500), ...o });
  it("suggests reviewing it", () => expect(productUnsold(snap({ products: [p()] }))[0].dedupe_key).toBe("strategy_product_price:catalog:unsold:p1"));
  it("not if sold this year, inactive, or younger than a year", () => {
    const d = deal("d1", { created_at: ago(100) });
    expect(productUnsold(snap({ products: [p()], deals: [d], lines: [{ id: "l", deal_id: "d1", product_id: "p1", name: "x", discount_pct: 0, unit_price: 1, created_at: ago(100) }] }))).toEqual([]);
    expect(productUnsold(snap({ products: [p({ active: false })] }))).toEqual([]);
    expect(productUnsold(snap({ products: [p({ created_at: ago(100) })] }))).toEqual([]);
  });
});

describe("CA-21 missing positioning field, without duplicating the setup notice", () => {
  const incomplete = { positioning: { ...fullPos, trend: "" } };
  it("the setup notice already asks for it → not duplicated (real detector)", () => {
    expect(positioningMissing(snap({}, { setup: setup(incomplete) }))).toEqual([]);
  });
  it("when the setup notice points elsewhere it lists the missing fields", () => {
    const [x] = makePositioningMissing(() => [])(snap({}, { setup: setup(incomplete) }));
    expect(x.body).toContain("Tendencia");
    expect(x.strategy!.kind).toBe("missing_data");
  });
  it("nothing when complete", () => expect(makePositioningMissing(() => [])(snap())).toEqual([]));
});

describe("CA-22 competitor without countermeasure card", () => {
  it("is not implemented in F1: it waits for SDD 7b (no competitor entity yet)", () => {
    expect(STRATEGY_DETECTORS.map((d) => d.name).join(" ")).not.toMatch(/competitor/i);
  });
});

describe("CA-23 repeated loss reason or competitor", () => {
  const lost = (id: string, o: object = {}) => deal(id, { stage: "lost", ...o });
  it("3 deals with the same reason, citing them", () => {
    const [x] = repeatedLoss(snap({ deals: [lost("d1", { lost_reason: "precio" }), lost("d2", { lost_reason: "precio" }), lost("d3", { lost_reason: "precio" }), lost("d4", { lost_reason: "otro" })] }));
    expect(x.strategy!.evidence.map((e) => e.id).sort()).toEqual(["d1", "d2", "d3"]);
    expect(x.strategy!.sample_size).toBe(4);
  });
  it("same competitor, ignoring case and accents", () => {
    const [x] = repeatedLoss(snap({ deals: [lost("d1", { lost_competitor: "Compañía X" }), lost("d2", { lost_competitor: "compania x" }), lost("d3", { lost_competitor: "COMPAÑIA X " })] }));
    expect(x.strategy!.element).toBe("competitor");
    expect(x.strategy!.evidence).toHaveLength(3);
  });
  it("two are not enough; deals without a reason are not counted", () => {
    expect(repeatedLoss(snap({ deals: [lost("d1", { lost_reason: "precio" }), lost("d2", { lost_reason: "precio" }), lost("d3"), lost("d4")] }))).toEqual([]);
  });
  it("CA-25: the minimum case (3 deals) is emitted with low evidence", () => {
    const [x] = repeatedLoss(snap({ deals: [1, 2, 3].map((n) => lost(`d${n}`, { lost_reason: "precio" })) }));
    expect(x.strategy!.evidence_level).toBe("low");
  });
});

describe("CA-24 no AI and CA-25 samples", () => {
  it("rules are synchronous pure functions of the snapshot (no model call)", () => {
    for (const d of STRATEGY_DETECTORS) expect(Array.isArray(d(snap()))).toBe(true);
  });
  it("the module of the rules never imports the AI gateway", async () => {
    const fs = await import("node:fs");
    for (const f of ["icp", "segments", "pipeline", "product", "positioning", "losses"]) {
      const src = fs.readFileSync(`src/lib/proactive/detectors/strategy-${f}.ts`, "utf8");
      expect(src).not.toMatch(/ai-gateway|ai\.functions|fetch\(/);
    }
  });
  it("without strategy data no strategic rule fires (older snapshots)", () => {
    expect(detect({ ...snap(), strategy: undefined }).filter((x) => x.detector.startsWith("strategy_"))).toEqual([]);
  });
  it("every emitted suggestion passes the F0 validation and is registered once", () => {
    const s = snap({ deals: [deal("d1", { amount: null })] });
    const out = detect(s).filter((x) => x.detector.startsWith("strategy_"));
    expect(out.length).toBeGreaterThan(0);
    for (const x of out) expect(parseStrategy(x.strategy)).not.toBeNull();
    expect(DETECTORS.some((d) => STRATEGY_DETECTORS.includes(d))).toBe(false);
  });
  it("a small sample reads as low evidence (CA-25)", () => {
    const [x] = dealsWithoutSegment(snap({ deals: [deal("d1", { amount: null })] }));
    expect(x.strategy!.evidence_level).toBe("low");
  });
});
