// F2 (SDD-20261027, H-4): CA-26..CA-30 on the pure rules. Fictional data only. CA-31 is in experiments.pg.test.ts.
import { describe, expect, it } from "vitest";
import {
  closeRuleMissing,
  missingCriteria,
  planDecision,
  resultOverdue,
  reviewDue,
  suggestedReviewOn,
  CRITERIA_FIELDS,
  type ExperimentLike,
} from "@/lib/experiments";
import { detect } from "@/lib/proactive";
import type { Snapshot } from "@/lib/proactive/types";
import { parseStrategy } from "@/lib/strategy-suggestions";

const NOW = new Date("2026-10-27T10:00:00Z");
const exp = (o: Partial<ExperimentLike> = {}): ExperimentLike => ({
  id: "e1",
  title: "Prueba de asunto",
  status: "running",
  hypothesis: "h",
  metric: "m",
  target: "",
  result: "",
  learning: "",
  success_threshold: "8 %",
  close_rule: "a los 30 días",
  review_on: null,
  ends_on: null,
  decision: null,
  ...o,
});

describe("CA-26 criteria offered and editable", () => {
  it("the five criteria are the ones the editor shows", () =>
    expect(CRITERIA_FIELDS.map(([k]) => k)).toEqual([
      "hypothesis",
      "metric",
      "success_threshold",
      "close_rule",
      "review_on",
    ]));
  it("lists what is still empty, by its label", () =>
    expect(missingCriteria(exp({ close_rule: " ", review_on: null }))).toEqual([
      "Regla de cierre",
      "Fecha de revisión",
    ]));
  it("offers the end date as review date but keeps one the person already set", () => {
    expect(suggestedReviewOn({ ends_on: "2026-11-30", review_on: null })).toBe("2026-11-30");
    expect(suggestedReviewOn({ ends_on: "2026-11-30", review_on: "2026-11-10" })).toBe(
      "2026-11-10",
    );
    expect(suggestedReviewOn({ ends_on: null, review_on: null })).toBeNull();
  });
});

describe("CA-27 running experiment without close rule", () => {
  it("suggests defining it; others stay quiet", () => {
    const [x] = closeRuleMissing([
      exp({ close_rule: "" }),
      exp({ id: "e2", status: "idea", close_rule: "" }),
      exp({ id: "e3" }),
    ]);
    expect(x.strategy!.element).toBe("experiment");
    expect(x.strategy!.evidence[0]).toMatchObject({
      table: "gtm_experiments",
      id: "e1",
      link: "/theory-u",
    });
    expect(closeRuleMissing([exp({ id: "e3" })])).toEqual([]);
  });
});

describe("CA-28 review date reached without decision", () => {
  it("asks to scale, adjust or close, today or later than the date", () => {
    expect(reviewDue([exp({ review_on: "2026-10-27" })], NOW)[0].body).toContain("escalas");
    expect(reviewDue([exp({ review_on: "2026-10-01" })], NOW)).toHaveLength(1);
  });
  it("not before the date, nor with a decision already made", () => {
    expect(reviewDue([exp({ review_on: "2026-10-28" })], NOW)).toEqual([]);
    expect(reviewDue([exp({ review_on: "2026-10-01", decision: "adjust" })], NOW)).toEqual([]);
  });
  it("a new review date is a new cause, so an adjusted experiment is asked again at the new date", () => {
    expect(reviewDue([exp({ review_on: "2026-10-01" })], NOW)[0].dedupe_key).not.toBe(
      reviewDue([exp({ review_on: "2026-10-20" })], NOW)[0].dedupe_key,
    );
  });
});

describe("CA-30 past the end date, more than 14 days without result", () => {
  it("fires after 14 days, not on day 14", () => {
    expect(resultOverdue([exp({ ends_on: "2026-10-13" })], NOW)).toEqual([]);
    expect(resultOverdue([exp({ ends_on: "2026-10-12" })], NOW)).toHaveLength(1);
  });
  it("not with a result, not closed", () => {
    expect(resultOverdue([exp({ ends_on: "2026-09-01", result: "hecho" })], NOW)).toEqual([]);
    expect(resultOverdue([exp({ ends_on: "2026-09-01", status: "learned" })], NOW)).toEqual([]);
  });
});

describe("CA-29 closing saves result and learning and may propose a change", () => {
  const by = "u1";
  it("close: needs result and learning", () => {
    expect(
      planDecision(exp(), { decision: "close", result: "", learning: "x" }, NOW, by),
    ).toMatchObject({ ok: false });
    const p = planDecision(
      exp(),
      { decision: "close", result: "6 % de respuesta", learning: "El asunto largo funciona peor" },
      NOW,
      by,
    );
    expect(p.ok && p.patch).toMatchObject({
      status: "learned",
      decision: "close",
      result: "6 % de respuesta",
      learning: "El asunto largo funciona peor",
      decided_by: by,
    });
    expect(p.ok && p.proposal).toBeNull();
  });
  it("names an element → a pending strategic suggestion with the experiment as evidence", () => {
    const p = planDecision(
      exp(),
      {
        decision: "scale",
        result: "r",
        learning: "l",
        change_element: "positioning",
        change_note: "Usar el asunto corto",
      },
      NOW,
      by,
    );
    if (!p.ok || !p.proposal) throw new Error("expected a proposal");
    expect(p.patch.status).toBe("adopted");
    expect(p.proposal.strategy!.element).toBe("positioning");
    expect(p.proposal.strategy!.evidence[0]).toMatchObject({ table: "gtm_experiments", id: "e1" });
    expect(parseStrategy(p.proposal.strategy)).not.toBeNull();
    expect(p.proposal.dedupe_key).toBe("strategy_positioning:experiment:e1");
  });
  it("adjust: keeps it running, needs a future review date and clears the decision", () => {
    expect(
      planDecision(exp(), { decision: "adjust", result: "", learning: "" }, NOW, by),
    ).toMatchObject({ ok: false });
    expect(
      planDecision(
        exp(),
        { decision: "adjust", result: "", learning: "", next_review_on: "2026-10-27" },
        NOW,
        by,
      ),
    ).toMatchObject({ ok: false });
    const p = planDecision(
      exp(),
      { decision: "adjust", result: "", learning: "", next_review_on: "2026-11-10" },
      NOW,
      by,
    );
    expect(p.ok && p.patch).toMatchObject({ review_on: "2026-11-10", decision: null });
    expect(p.ok && p.patch.status).toBeUndefined();
  });
  it("texts longer than 500 characters are refused", () => {
    expect(
      planDecision(exp(), { decision: "close", result: "x".repeat(501), learning: "l" }, NOW, by),
    ).toMatchObject({ ok: false });
  });
});

describe("registered in the engine (no AI)", () => {
  const snap = (experiments: ExperimentLike[]): Snapshot => ({
    now: NOW,
    orgId: "o",
    setup: {
      currency: "EUR",
      segments: [],
      icps: [],
      positioning: null,
      pillars: [],
      quotas: [],
      accounts: 0,
      deals: 0,
      quarter: "2026-Q4",
    },
    deals: [],
    meetings: [],
    accounts: [],
    stakeholders: [],
    registrations: [],
    trials: [],
    segments: [],
    strategy: {
      icps: [],
      accounts: [],
      deals: [],
      history: [],
      products: [],
      lines: [],
      costs: [],
      budgets: [],
      experiments,
    },
  });
  it("detect() emits the three experiment rules", () => {
    const keys = detect(
      snap([exp({ close_rule: "", review_on: "2026-10-01", ends_on: "2026-09-01" })]),
    ).map((x) => x.dedupe_key.split(":")[1]);
    expect(keys).toEqual(expect.arrayContaining(["close_rule", "review", "overdue"]));
  });
  it("older snapshots without experiments emit none", () =>
    expect(
      detect({ ...snap([]), strategy: undefined }).filter((x) =>
        x.detector.startsWith("strategy_"),
      ),
    ).toEqual([]));
});
