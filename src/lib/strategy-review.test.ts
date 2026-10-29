import { describe, expect, it } from "vitest";
import {
  buildReviewInput,
  dedupeAgainstFixed,
  inputFingerprint,
  parseReview,
  reviewPrompt,
  REVIEW_SCHEMA,
  MAX_REVIEW,
  type ReviewSource,
} from "@/lib/strategy-review";

const src = (
  table: string,
  id: string,
  label: string,
  facts: ReviewSource["facts"] = {},
  more: Partial<ReviewSource> = {},
): ReviewSource => ({ table, id, label, facts, ...more });
const SOURCES: ReviewSource[] = [
  src("icp_profiles", "i1", "ICP SaaS mid-market", { industries: "SaaS", company_size: "50-200" }),
  src(
    "accounts",
    "a1",
    "Acme Iberia",
    { industry: "SaaS", country: "ES" },
    { names: ["Acme Iberia"] },
  ),
  src(
    "deals",
    "d1",
    "Acme Iberia - renovación",
    { stage: "lost", lost_reason: "price", amount: 12000 },
    { names: ["Acme Iberia"] },
  ),
  src(
    "meetings",
    "m1",
    "Llamada de descubrimiento",
    { notes: "Habló Marta Ruiz de Acme Iberia: el precio es alto" },
    { names: ["Marta Ruiz", "Acme Iberia"] },
  ),
];

const item = (over: Record<string, unknown> = {}) => ({
  element: "icp",
  kind: "change",
  action_type: "strategy_change",
  priority: 2,
  title: "Revisa el ICP de SaaS",
  body: "Dos pérdidas por precio en SaaS.",
  evidence_refs: ["R1", "R3"],
  invalidates_if: "Si las pérdidas por precio bajan del 20 %.",
  missing: [],
  ...over,
});
const raw = (items: unknown[]) => JSON.stringify({ suggestions: items });

describe("buildReviewInput (CA-40, CA-48)", () => {
  it("gives each source a stable reference and never sends names to the model", () => {
    const { payload, refs } = buildReviewInput(SOURCES);
    const text = JSON.stringify(payload);
    expect(refs.get("R1")).toMatchObject({ table: "icp_profiles", id: "i1" });
    expect(text).not.toContain("Acme Iberia");
    expect(text).not.toContain("Marta Ruiz");
    expect(text).toContain("[nombre]");
  });
  it("lists which kinds of data are missing instead of leaving them out silently (CA-42)", () => {
    const { payload } = buildReviewInput(SOURCES);
    expect(payload.sin_dato).toEqual(
      expect.arrayContaining(["positioning", "messaging_pillars", "gtm_experiments"]),
    );
    expect(payload.sin_dato).not.toContain("deals");
  });
});

describe("inputFingerprint (CA-44)", () => {
  it("is the same for the same data and mode, and changes with data, mode or depth", () => {
    const a = inputFingerprint(buildReviewInput(SOURCES).payload, "normal", "low");
    expect(inputFingerprint(buildReviewInput([...SOURCES]).payload, "normal", "low")).toBe(a);
    expect(inputFingerprint(buildReviewInput(SOURCES).payload, "critical", "low")).not.toBe(a);
    expect(inputFingerprint(buildReviewInput(SOURCES).payload, "normal", "medium")).not.toBe(a);
    const changed = [...SOURCES.slice(0, 2), src("deals", "d1", "x", { stage: "won" })];
    expect(inputFingerprint(buildReviewInput(changed).payload, "normal", "low")).not.toBe(a);
  });
});

describe("reviewPrompt (CA-42, CA-43)", () => {
  it("forbids estimating and external benchmarks and asks for «sin dato»", () => {
    const p = reviewPrompt("normal");
    expect(p).toMatch(/sin dato/i);
    expect(p).toMatch(/benchmark/i);
    expect(p).toMatch(/máximo 7|como máximo 7/i);
  });
  it("«Revisión crítica» prioritises weak assumptions and declared-vs-observed contradictions", () => {
    expect(reviewPrompt("critical")).toMatch(/supuestos débiles/i);
    expect(reviewPrompt("critical")).toMatch(/contradicciones/i);
    expect(reviewPrompt("normal")).not.toMatch(/supuestos débiles/i);
  });
  it("the schema caps the list at 7", () => {
    expect(
      (REVIEW_SCHEMA as { properties: { suggestions: { maxItems: number } } }).properties
        .suggestions.maxItems,
    ).toBe(7);
  });
});

describe("parseReview (CA-40, CA-41, CA-42, CA-48)", () => {
  const { refs } = buildReviewInput(SOURCES);
  const names = ["Acme Iberia", "Marta Ruiz"];
  it("builds strategic suggestions whose evidence comes only from known references, with level, action and what invalidates it", () => {
    const [s] = parseReview(raw([item()]), refs, names).suggestions;
    expect(s.detector).toBe("strategy_icp");
    expect(s.strategy.evidence.map((e) => e.id)).toEqual(["i1", "d1"]);
    expect(s.strategy.evidence_level).toBe("low");
    expect(s.strategy.action_type).toBe("strategy_change");
    expect(s.body).toContain("Lo invalidaría: Si las pérdidas por precio bajan del 20 %.");
    expect(s.dedupe_key.startsWith("strategy_icp:review:")).toBe(true);
  });
  it("drops invented references and drops a suggestion left without evidence", () => {
    const r = parseReview(
      raw([
        item({ evidence_refs: ["R1", "R99"] }),
        item({ title: "Otra", evidence_refs: ["R99"] }),
      ]),
      refs,
      names,
    );
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0].strategy.evidence.map((e) => e.id)).toEqual(["i1"]);
    expect(r.discarded).toBe(1);
  });
  it("keeps at most 7 suggestions, by priority", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      item({ title: `T${i}`, priority: i < 8 ? 3 : 1 }),
    );
    const r = parseReview(raw(many), refs, names);
    expect(r.suggestions).toHaveLength(MAX_REVIEW);
    expect(r.suggestions[0].priority).toBe(1);
  });
  it("turns the missing figures into an explicit «sin dato» line, never an estimate (CA-42)", () => {
    const [s] = parseReview(
      raw([item({ missing: ["CAC del segmento"] })]),
      refs,
      names,
    ).suggestions;
    expect(s.body).toContain("Sin dato: CAC del segmento.");
  });
  it("removes client and interviewee names the model may have written (CA-48)", () => {
    const [s] = parseReview(
      raw([item({ title: "Acme Iberia pide rebaja", body: "Marta Ruiz lo dijo" })]),
      refs,
      names,
    ).suggestions;
    expect(`${s.title} ${s.body}`).not.toMatch(/Acme|Marta/);
  });
  it("rejects invalid JSON and an unknown element with a readable error", () => {
    expect(() => parseReview("no es json", refs, names)).toThrow(/respuesta válida/);
    expect(parseReview(raw([item({ element: "weather" })]), refs, names).suggestions).toHaveLength(
      0,
    );
  });
});

describe("dedupeAgainstFixed (CA-47)", () => {
  const { refs } = buildReviewInput(SOURCES);
  const ai = parseReview(
    raw([item(), item({ element: "segment", title: "Segmento" })]),
    refs,
    [],
  ).suggestions;
  it("shows only the fixed suggestion when both are about the same element", () => {
    const out = dedupeAgainstFixed(ai, [
      { dedupe_key: "strategy_icp:uncovered_win:industry:saas", strategy: { element: "icp" } },
    ]);
    expect(out.map((s) => s.strategy.element)).toEqual(["segment"]);
  });
  it("keeps the AI one when the fixed suggestion is about a different element", () => {
    expect(
      dedupeAgainstFixed(ai, [
        { dedupe_key: "strategy_pipeline:stalled", strategy: { element: "pipeline" } },
      ]),
    ).toHaveLength(2);
  });
  it("ignores earlier AI reviews as «fixed» suggestions", () => {
    expect(
      dedupeAgainstFixed(ai, [
        { dedupe_key: "strategy_icp:review:abc", strategy: { element: "icp" } },
      ]),
    ).toHaveLength(2);
  });
});
