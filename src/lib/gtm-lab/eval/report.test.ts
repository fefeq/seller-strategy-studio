import { describe, expect, it } from "vitest";
import { compareWithReference, summarize, type CaseResult } from "./report";

const verdict = (notas: [number, number, number], invention = false) => ({
  concreta: { motivo: "m", nota: notas[0] },
  coherente: { motivo: "m", nota: notas[1] },
  accionable: { motivo: "m", nota: notas[2] },
  invencion: { motivo: "m", hay: invention },
});

const good = (i: number, over: Partial<CaseResult> = {}): CaseResult => ({
  id: `p/${i}`,
  providerError: null,
  stopReason: "end_turn",
  checks: null,
  pass: true,
  verdict: verdict([4, 5, 4]),
  ...over,
});

const run = (n: number, over: (i: number) => Partial<CaseResult> = () => ({})) =>
  Array.from({ length: n }, (_, i) => good(i, over(i)));

describe("summarize: threshold of criterio.md §5 (NK-0048 CA-19)", () => {
  it("24 good cases meet it", () => {
    const s = summarize(run(24));
    expect(s.meetsThreshold).toBe(true);
    expect(s.means).toEqual({ concreta: 4, coherente: 5, accionable: 4 });
  });

  it("a refusal or a cut answer breaks it, and counts as not passing", () => {
    const s = summarize(
      run(24, (i) => (i === 0 ? { stopReason: "refusal", pass: false, verdict: null } : {})),
    );
    expect(s.refusalsOrCut).toEqual(["p/0"]);
    expect(s.meetsThreshold).toBe(false);
  });

  it("one invention breaks it", () => {
    const s = summarize(run(24, (i) => (i === 3 ? { verdict: verdict([4, 4, 4], true) } : {})));
    expect(s.inventions).toEqual(["p/3"]);
    expect(s.meetsThreshold).toBe(false);
  });

  it("needs at least 22 cases passing the checks", () => {
    expect(summarize(run(24, (i) => (i < 2 ? { pass: false } : {}))).meetsThreshold).toBe(true);
    expect(summarize(run(24, (i) => (i < 3 ? { pass: false } : {}))).meetsThreshold).toBe(false);
  });

  it("needs a mean of 4 or more in EACH criterion, and no score of 2 or less", () => {
    // 12 × 3 + 12 × 5 = mean 4 in accionable (meets); 13 × 3 + 11 × 5 = 3.92 (does not).
    const split = (n: number) => (i: number) => ({
      verdict: verdict(i < n ? [4, 4, 3] : [4, 4, 5]),
    });
    expect(summarize(run(24, split(12))).meetsThreshold).toBe(true);
    expect(summarize(run(24, split(13))).meetsThreshold).toBe(false);
    const low = summarize(run(24, (i) => (i === 0 ? { verdict: verdict([5, 2, 5]) } : {})));
    expect(low.lowScores).toEqual(["p/0"]);
    expect(low.meetsThreshold).toBe(false);
  });

  it("a finished case without verdict blocks the claim", () => {
    const s = summarize(run(24, (i) => (i === 5 ? { verdict: null } : {})));
    expect(s.unjudged).toEqual(["p/5"]);
    expect(s.meetsThreshold).toBe(false);
  });

  it("a provider error leaves the run incomplete: no threshold either way", () => {
    const s = summarize(
      run(24, (i) =>
        i === 7 ? { providerError: "HTTP 400", stopReason: null, verdict: null } : {},
      ),
    );
    expect(s.complete).toBe(false);
    expect(s.providerErrors).toEqual(["p/7"]);
    expect(s.meetsThreshold).toBeNull();
  });

  it("a run of fewer than 24 cases (pilot, or stopped at the cap) has no threshold", () => {
    expect(summarize(run(5)).meetsThreshold).toBeNull();
  });
});

describe("compareWithReference (informative, CA-19)", () => {
  const ref = summarize(run(24));

  it("flags 2 or more fewer passing cases", () => {
    const full = summarize(run(24, (i) => (i < 2 ? { pass: false } : {})));
    expect(compareWithReference(full, ref)).toMatchObject({
      fewerPassing: true,
      needsDecision: true,
    });
    const one = summarize(run(24, (i) => (i < 1 ? { pass: false } : {})));
    expect(compareWithReference(one, ref).needsDecision).toBe(false);
  });

  it("flags an actionable mean 0.25 or more below", () => {
    const full = summarize(run(24, (i) => (i < 6 ? { verdict: verdict([4, 5, 3]) } : {})));
    expect(full.means.accionable).toBeCloseTo(3.75);
    expect(compareWithReference(full, ref)).toMatchObject({
      lowerActionable: true,
      needsDecision: true,
    });
    const less = summarize(run(24, (i) => (i < 5 ? { verdict: verdict([4, 5, 3]) } : {})));
    expect(compareWithReference(less, ref).needsDecision).toBe(false);
  });
});
