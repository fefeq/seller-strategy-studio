import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  blockBasis,
  blockOf,
  blockOrder,
  blocksDecided,
  mergeBlock,
  companyOnboardingStatus,
  nextStepAfterDiagnosis,
  onboardingDone,
  protectManual,
  readingCost,
  showRoadmapCard,
  stepReachable,
  STEP_IDS,
  type Step,
} from "@/lib/onboarding";
import { proposalItems, type SetupProposal } from "@/lib/setup-extraction";
import { setupStatus, type SetupData } from "@/lib/setup-schema";

const proposal: SetupProposal = {
  summary: "s",
  currency: "EUR",
  quarter_quota: 30000,
  positioning: { category: "CRM", one_liner: "Nuevo", value: "Ahorra tiempo" },
  segments: [
    {
      name: "SMB",
      acv_min: 1000,
      acv_max: 4000,
      motion: "plg",
      win_rate_target: 0.2,
      ae_quota: 300000,
    },
  ],
  icps: [
    {
      name: "Agencias",
      industries: "Marketing",
      company_size: "10-50",
      geography: "ES",
      why_fit: "x",
      anti_icp: "y",
    },
  ],
  pillars: [{ title: "P1", pain: null, message: "m", proof: null }],
  target_accounts: [],
  questions: [],
  basis: [{ block: "segments", level: "confirmed", source: "Web · precios" }],
};
const empty: SetupData = {
  currency: null,
  segments: [],
  icps: [],
  positioning: null,
  pillars: [],
  quotas: [],
  accounts: 0,
  deals: 0,
  quarter: "2026-Q4",
};

describe("block order follows the archetype", () => {
  it("enterprise (C) approves accounts before the message", () => {
    expect(blockOrder("C").indexOf("icp")).toBeLessThan(blockOrder("C").indexOf("positioning"));
  });
  it("PLG (A) approves the message before the ICP", () => {
    expect(blockOrder("A").indexOf("positioning")).toBeLessThan(blockOrder("A").indexOf("icp"));
  });
  it("always six blocks, company first", () => {
    for (const a of ["A", "B", "C", "D", "E", null] as const) {
      expect(blockOrder(a)).toHaveLength(6);
      expect(blockOrder(a)[0]).toBe("company");
    }
  });
});

describe("items and levels", () => {
  it("target accounts belong to the ICP block and quota to goals", () => {
    expect(blockOf({ group: "Cuentas objetivo" })).toBe("icp");
    expect(blockOf({ group: "Cuota" })).toBe("goals");
  });
  it("a block without a stated basis is Nokko's assumption", () => {
    expect(blockBasis(proposal, "icp")).toEqual({ level: "assumed", source: "Supuesto de Nokko" });
    expect(blockBasis(proposal, "segments")).toEqual({
      level: "confirmed",
      source: "Web · precios",
    });
  });
});

describe("never overwrites what the person wrote", () => {
  it("drops positioning fields that already have a value", () => {
    const items = proposalItems(proposal, [], null);
    const { items: out, kept } = protectManual(items, {
      ...empty,
      positioning: { category: "Mi categoría", one_liner: "" },
    });
    const pos = out.find((i) => i.tool === "update_positioning")!;
    expect((pos.args.fields as Record<string, unknown>).category).toBeUndefined();
    expect((pos.args.fields as Record<string, unknown>).one_liner).toBe("Nuevo");
    expect(kept).toContain("Posicionamiento: category");
  });
  it("keeps the segment figures already set and the quarter's quota", () => {
    const items = proposalItems(proposal, [], null);
    const { items: out } = protectManual(items, {
      ...empty,
      segments: [
        { name: "smb", acv_min: 2000, acv_max: 5000, win_rate_target: 0.3, ae_quota: 400000 },
      ],
      quotas: [{ period: "2026-Q4", amount: 50000 }],
    });
    expect(out.find((i) => i.tool === "set_quota")).toBeUndefined();
    const seg = out.find((i) => i.tool === "upsert_segment");
    expect(seg?.args.acv_min).toBeUndefined();
    expect(seg?.args.ae_quota).toBeUndefined();
  });
});

describe("redo and progress", () => {
  it("a redo changes only its block", () => {
    const next = {
      ...proposal,
      pillars: [{ title: "Otro", pain: null, message: "n", proof: null }],
      icps: [],
    };
    const merged = mergeBlock(proposal, next, "messages");
    expect(merged.pillars[0].title).toBe("Otro");
    expect(merged.icps).toHaveLength(1);
  });
  it("approving the positioning block raises the setup progress", () => {
    const before = setupStatus(empty).pct;
    const pos = Object.fromEntries(
      [
        "best_customers",
        "alternatives",
        "differentiation",
        "value",
        "trend",
        "target_customer",
        "need",
        "category",
        "key_benefit",
        "competitive_alternative",
        "differentiator",
        "one_liner",
        "elevator_pitch",
      ].map((k) => [k, "x"]),
    );
    expect(setupStatus({ ...empty, positioning: pos }).pct).toBeGreaterThan(before);
  });
  it("blocks are done when every present block was approved or skipped", () => {
    const present = new Set(["company", "icp"] as const);
    expect(
      blocksDecided(blockOrder("B"), { company: { status: "approved", at: "" } }, present),
    ).toBe(false);
    expect(
      blocksDecided(
        blockOrder("B"),
        { company: { status: "approved", at: "" }, icp: { status: "skipped", at: "" } },
        present,
      ),
    ).toBe(true);
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

describe("onboardingDone (NK-0009 CA-1)", () => {
  it("is true only for the roadmap step", () => {
    expect(onboardingDone({ step: "roadmap" })).toBe(true);
    for (const step of ["depth", "sources", "reading", "diagnosis", "blocks"])
      expect(onboardingDone({ step })).toBe(false);
  });
  it("is false for null, undefined and a null step", () => {
    expect(onboardingDone(null)).toBe(false);
    expect(onboardingDone(undefined)).toBe(false);
    expect(onboardingDone({ step: null })).toBe(false);
  });
  it("ignores completed_at: hiding the card is not finishing", () => {
    expect(
      onboardingDone({ step: "blocks", completed_at: "2026-11-01T00:00:00Z" } as { step: string }),
    ).toBe(false);
    expect(onboardingDone({ step: "roadmap", completed_at: null } as { step: string })).toBe(true);
  });
});

describe("stepReachable truth table (NK-0009 CA-3)", () => {
  const cases: [Step, boolean, boolean, boolean][] = [];
  for (const job of [false, true])
    for (const prop of [false, true])
      for (const diag of [false, true]) {
        for (const step of STEP_IDS) cases.push([step, job, prop, diag]);
      }
  it.each(cases)("%s with job=%s proposal=%s diagnosis=%s", (step, job, prop, diag) => {
    const expected =
      step === "depth" ||
      step === "sources" ||
      step === "diagnosis" ||
      (step === "reading" && job) ||
      (step === "blocks" && prop) ||
      (step === "roadmap" && diag);
    expect(
      stepReachable(step, { readJobId: job ? "j1" : null, hasProposal: prop, hasDiagnosis: diag }),
    ).toBe(expected);
  });
  it("the six steps keep their order", () => {
    expect([...STEP_IDS]).toEqual([
      "depth",
      "sources",
      "reading",
      "diagnosis",
      "blocks",
      "roadmap",
    ]);
  });
  it("the route does not define its own reachability rule and guide.ts does not compare the step", () => {
    expect(readFileSync("src/routes/_authenticated/onboarding.tsx", "utf8")).not.toContain(
      "const reachable =",
    );
    expect(readFileSync("src/lib/guide.ts", "utf8")).not.toContain('=== "roadmap"');
  });
});

describe("nextStepAfterDiagnosis (NK-0009 CA-5)", () => {
  it("goes to the blocks with a proposal and to the roadmap without one, which finishes the onboarding", () => {
    expect(nextStepAfterDiagnosis(true)).toBe("blocks");
    expect(nextStepAfterDiagnosis(false)).toBe("roadmap");
    expect(onboardingDone({ step: nextStepAfterDiagnosis(false) })).toBe(true);
    expect(onboardingDone({ step: nextStepAfterDiagnosis(true) })).toBe(false);
  });
});

describe("companyOnboardingStatus (NK-0009 CA-6)", () => {
  const POS = [
    "best_customers",
    "alternatives",
    "differentiation",
    "value",
    "trend",
    "target_customer",
    "need",
    "category",
    "key_benefit",
    "competitive_alternative",
    "differentiator",
    "one_liner",
    "elevator_pitch",
  ];
  const fullPositioning = Object.fromEntries(POS.map((k) => [k, `texto ${k}`]));
  const fullIcp = {
    industries: "Software",
    company_size: "50-200",
    why_fit: "Encaja",
    anti_icp: "Agencias",
  };
  const seg = { name: "SMB", acv_min: 1000, acv_max: 4000, win_rate_target: 0.2, ae_quota: 300000 };
  const diag = {
    input: { model: "b2b", acv: 12345, friction: "committee", stage: "early" },
    result: {
      archetype: "B",
      name: "B2B mid-market / híbrido",
      motion: "inside_sales",
      nextStep: "Define tu ICP",
    },
  };
  const ready: SetupData = {
    ...empty,
    positioning: fullPositioning,
    icps: [fullIcp],
    segments: [seg],
  };
  const mine = { step: "roadmap", diagnosis: diag };

  it("reads the diagnosis fields from {input, result}", () => {
    const s = companyOnboardingStatus({ mine, companyDiagnosis: diag, setup: ready });
    expect(s.diagnosis).toEqual({
      archetype: "B",
      name: "B2B mid-market / híbrido",
      motion: "inside_sales",
      stage: "early",
      nextStep: "Define tu ICP",
    });
    expect(s.mine).toEqual({ step: "roadmap", done: true });
    expect(s.strategy).toEqual({ positioning: true, icp: true, segments: true });
    expect(s.missing).toEqual([]);
    expect(s.ready).toBe(true);
  });

  it("without a session mine is not done", () => {
    expect(
      companyOnboardingStatus({ mine: null, companyDiagnosis: diag, setup: ready }).mine,
    ).toEqual({ step: null, done: false });
    expect(
      companyOnboardingStatus({
        mine: { step: "blocks", diagnosis: null },
        companyDiagnosis: null,
        setup: empty,
      }).mine,
    ).toEqual({ step: "blocks", done: false });
  });

  it("ready is true only with the diagnosis, the positioning and the ICP", () => {
    const r = (companyDiagnosis: unknown, setup: SetupData) =>
      companyOnboardingStatus({ mine: null, companyDiagnosis, setup }).ready;
    expect(r(diag, { ...ready, segments: [] })).toBe(true); // segments do not block
    expect(r(null, ready)).toBe(false);
    expect(r(diag, { ...ready, positioning: null })).toBe(false);
    expect(r(diag, { ...ready, icps: [] })).toBe(false);
    expect(r(diag, empty)).toBe(false);
  });

  it("a malformed diagnosis gives null and ready false even with positioning and ICP complete", () => {
    for (const bad of [
      "texto",
      42,
      [],
      {},
      { result: "x" },
      { input: {}, result: {} },
      { result: { archetype: 3 } },
    ]) {
      const s = companyOnboardingStatus({ mine: null, companyDiagnosis: bad, setup: ready });
      expect(s.diagnosis, JSON.stringify(bad)).toBeNull();
      expect(s.ready, JSON.stringify(bad)).toBe(false);
      expect(s.missing[0]).toBe("Diagnóstico GTM sin hacer");
    }
  });

  it("12 of the 13 positioning fields is not complete", () => {
    const { elevator_pitch: _e, ...twelve } = fullPositioning;
    const s = companyOnboardingStatus({
      mine: null,
      companyDiagnosis: diag,
      setup: { ...ready, positioning: twelve },
    });
    expect(s.strategy.positioning).toBe(false);
    expect(s.ready).toBe(false);
    expect(s.missing).toEqual(["Posicionamiento sin completar"]);
  });

  it("an ICP without anti_icp next to a complete one still counts; alone it does not", () => {
    const partial = { ...fullIcp, anti_icp: "" };
    expect(
      companyOnboardingStatus({
        mine: null,
        companyDiagnosis: diag,
        setup: { ...ready, icps: [partial, fullIcp] },
      }).ready,
    ).toBe(true);
    const alone = companyOnboardingStatus({
      mine: null,
      companyDiagnosis: diag,
      setup: { ...ready, icps: [partial] },
    });
    expect(alone.strategy.icp).toBe(false);
    expect(alone.ready).toBe(false);
  });

  it("missing lists, in order, what is not done", () => {
    expect(
      companyOnboardingStatus({ mine: null, companyDiagnosis: null, setup: empty }).missing,
    ).toEqual([
      "Diagnóstico GTM sin hacer",
      "Posicionamiento sin completar",
      "ICP sin completar",
      "Segmentos sin rango de ACV",
    ]);
  });

  it("does the diagnosis alone make it ready? No: only the diagnosis leaves positioning and ICP missing", () => {
    const s = companyOnboardingStatus({ mine, companyDiagnosis: diag, setup: empty });
    expect(s.ready).toBe(false);
    expect(s.missing).toEqual([
      "Posicionamiento sin completar",
      "ICP sin completar",
      "Segmentos sin rango de ACV",
    ]);
  });

  it("takes the strategy rule from setup-schema and does not repeat its field names", () => {
    const src = readFileSync("src/lib/onboarding.ts", "utf8");
    expect(src).not.toContain('"elevator_pitch"');
    expect(src).not.toContain('"anti_icp"');
    // Same answer as setupStatus for any data.
    const items = Object.fromEntries(setupStatus(ready).items.map((i) => [i.id, i.done]));
    const s = companyOnboardingStatus({ mine: null, companyDiagnosis: diag, setup: ready });
    expect(s.strategy).toEqual({
      positioning: items.positioning,
      icp: items.icp,
      segments: items.segments,
    });
  });
});
