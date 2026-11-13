import { describe, expect, it } from "vitest";
import { CAPABILITIES } from "@/lib/orchestrator/planner";
import {
  CUSTOM_PLAY_PREFIX, isCustomPlayId, newCustomPlayId, parseEventDate, checkFreshness,
  compileGates, validateTestDesign, validateMessage, SOURCE_REGISTRY, checkSources,
  contactGate, QUOTE_MAX, validateEvidence,
} from "./model";

const NOW = new Date("2026-11-13T12:00:00Z");

describe("P-4 ids never mix with play_states", () => {
  it("custom ids carry the reserved prefix", () => {
    const id = newCustomPlayId("abc");
    expect(id.startsWith(CUSTOM_PLAY_PREFIX)).toBe(true);
    expect(isCustomPlayId(id)).toBe(true);
    expect(isCustomPlayId("lost-deal-revival")).toBe(false);
  });
});

describe("6.1 dates: only unambiguous literals", () => {
  it.each([
    ["2026-11-01", "2026-11-01"],
    ["3 de abril de 2026", "2026-04-03"],
    ["April 3, 2026", "2026-04-03"],
    ["03/04/2026", null],
    ["", null],
  ])("%s → %s", (raw, iso) => {
    expect(parseEventDate(raw)).toBe(iso);
  });
});

describe("6.1 freshness on the event date", () => {
  const w = { backDays: 30, forwardDays: 60 };
  it("old announcement read today does not pass", () => {
    expect(checkFreshness({ eventDate: "2024-11-01", publishedDate: "2024-11-01" }, w, NOW).ok).toBe(false);
  });
  it("unknown event date does not pass", () => {
    expect(checkFreshness({ eventDate: null, publishedDate: "2026-11-10" }, w, NOW).ok).toBe(false);
  });
  it("future event inside forward window passes only if publication is fresh", () => {
    expect(checkFreshness({ eventDate: "2026-12-20", publishedDate: "2026-11-01" }, w, NOW).ok).toBe(true);
    expect(checkFreshness({ eventDate: "2026-12-20", publishedDate: "2024-01-01" }, w, NOW).ok).toBe(false);
    expect(checkFreshness({ eventDate: "2027-06-01", publishedDate: "2026-11-01" }, w, NOW).ok).toBe(false);
  });
  it("window must be positive", () => {
    expect(checkFreshness({ eventDate: "2026-11-10", publishedDate: null }, { backDays: 0, forwardDays: 0 }, NOW).ok).toBe(false);
  });
});

describe("6.1 declarative gates compile to GateDef; unknown never passes", () => {
  it.each([
    [{ field: "rating", op: "lte", value: 2 }, { rating: 1 }, "pass"],
    [{ field: "rating", op: "lte", value: 2 }, { rating: 4 }, "fail"],
    [{ field: "rating", op: "lte", value: 2 }, {}, "unknown"],
    [{ field: "country", op: "in", value: ["ES", "PT"] }, { country: "ES" }, "pass"],
  ] as const)("%j on %j → %s", (g, subj, v) => {
    const r = compileGates([g as never]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.gates[0]!.check(subj).v).toBe(v);
  });
  it("rejects operators or fields outside the closed lists", () => {
    expect(compileGates([{ field: "rating", op: "regex", value: "x" } as never]).ok).toBe(false);
    expect(compileGates([{ field: "salary", op: "eq", value: 1 } as never]).ok).toBe(false);
  });
});

describe("6.1 test design", () => {
  it.each([
    [{ n: 20, k: 3, base: 20 }, true],
    [{ n: 20, k: 3, base: 10 }, false],
    [{ n: 5, k: 6, base: 5 }, false],
    [{ n: 5, k: 0, base: 5 }, false],
    [{ n: 5, k: 2 }, false],
  ])("%j → %s", (d, ok) => expect(validateTestDesign(d as never).ok).toBe(ok));
});

describe("6.1 evidence and cited message", () => {
  const steps = [{ n: 1, source: "news" as const, question: "q", returns: ["event_date"] }];
  const w = { backDays: 30, forwardDays: 30 };
  it("evidence without contact data and with short quote", () => {
    expect(validateEvidence({ step: 1, url: "https://a.com", quote: "x".repeat(QUOTE_MAX + 1), observedAt: "2026-11-13", eventDate: "2026-11-10", dateFrom: "literal" }).ok).toBe(false);
    expect(validateEvidence({ step: 1, url: "https://a.com", quote: "llamar a ana@x.com", observedAt: "2026-11-13", eventDate: "2026-11-10", dateFrom: "literal" }).ok).toBe(false);
  });
  it("a claim citing a missing step or out-of-window fact is rejected", () => {
    const facts = [{ step: 1, eventDate: "2026-11-10" }];
    expect(validateMessage({ claims: [{ text: "a", step: 1 }], built: "b", ask: "c" }, steps, facts, w, NOW).ok).toBe(true);
    expect(validateMessage({ claims: [{ text: "a", step: 2 }], built: "b", ask: "c" }, steps, facts, w, NOW).ok).toBe(false);
    expect(validateMessage({ claims: [{ text: "a", step: 1 }], built: "b", ask: "c" }, steps, [{ step: 1, eventDate: "2023-01-01" }], w, NOW).ok).toBe(false);
    expect(validateMessage({ claims: [], built: "b", ask: "c" }, steps, facts, w, NOW).ok).toBe(false);
  });
});

describe("6.2 source registry derived from CAPABILITIES", () => {
  it("every registry need exists in CAPABILITIES", () => {
    for (const s of Object.values(SOURCE_REGISTRY)) if (s.need) expect(CAPABILITIES[s.need]).toBeDefined();
  });
  it("blocks when no service of the need is available, drive needs the folder, posthog the org link", () => {
    expect(checkSources(["news"], { services: [], posthog: false, driveFolder: false }).ok).toBe(false);
    expect(checkSources(["news"], { services: ["perplexity"], posthog: false, driveFolder: false }).ok).toBe(true);
    expect(checkSources(["drive"], { services: ["drive"], posthog: false, driveFolder: false }).ok).toBe(false);
    expect(checkSources(["drive"], { services: ["drive"], posthog: false, driveFolder: true }).ok).toBe(true);
    expect(checkSources(["posthog"], { services: ["posthog"], posthog: false, driveFolder: false }).ok).toBe(false);
  });
});

describe("Q-7 optional «solo contacto verificado»", () => {
  it("off: any status goes; on: only verified", () => {
    expect(contactGate(false, "unverified").ok).toBe(true);
    expect(contactGate(true, "unverified").ok).toBe(false);
    expect(contactGate(true, "verified").ok).toBe(true);
    expect(contactGate(true, null).ok).toBe(false);
  });
});
