// Spend ledger rules (SDD pausa-legal-linkedin-y-gasto, pieza B): estimates come only from real measured
// history of the same tool and currency; without a comparable sample the answer is «sin dato», never zero or
// an invented amount. Currencies are never added together and an unknown cost is not a zero.
import { describe, expect, it } from "vitest";
import { budgetState } from "@/lib/orchestrator/planner";
import { estimateCost, median, spendTotals, type SpendRow } from "./spend";

const row = (
  cost: number | null,
  currency = "EUR",
  kind: SpendRow["cost_kind"] = "measured",
  tool = "apollo_find_people",
  at = "2026-11-01T00:00:00Z",
): SpendRow => ({
  cost,
  currency,
  cost_kind: kind,
  tool,
  created_at: at,
});

describe("median", () => {
  it("two measured samples 2 and 4 give 3", () => {
    expect(median([2, 4])).toBe(3);
  });
  it("odd count takes the middle value", () => {
    expect(median([1, 9, 3])).toBe(3);
  });
  it("no samples is null, never zero", () => {
    expect(median([])).toBeNull();
  });
});

describe("estimateCost", () => {
  it("uses only measured rows of the same tool and currency", () => {
    const rows = [
      row(2),
      row(4),
      row(99, "EUR", "estimate"), // estimates are not evidence of price
      row(50, "USD"), // another currency
      row(7, "EUR", "measured", "clay_find_people"), // another tool
      row(null), // unknown cost
    ];
    const e = estimateCost(rows, "apollo_find_people", "EUR");
    expect(e.value).toBe(3);
    expect(e.samples).toBe(2);
  });

  it("without a comparable sample returns null («sin dato»), never zero", () => {
    expect(
      estimateCost([row(null), row(5, "EUR", "estimate")], "apollo_find_people", "EUR").value,
    ).toBeNull();
    expect(estimateCost([], "apollo_find_people", "EUR").samples).toBe(0);
  });

  it("reports the period the samples cover", () => {
    const e = estimateCost(
      [
        row(2, "EUR", "measured", "t", "2026-10-01T00:00:00Z"),
        row(4, "EUR", "measured", "t", "2026-11-05T00:00:00Z"),
      ],
      "t",
      "EUR",
    );
    expect(e.period).toEqual({ from: "2026-10-01T00:00:00Z", to: "2026-11-05T00:00:00Z" });
  });
});

describe("spendTotals", () => {
  it("never adds USD and EUR together", () => {
    const t = spendTotals([row(1, "USD"), row(2, "EUR")]);
    expect(t.totals).toEqual({ USD: 1, EUR: 2 });
  });

  it("an unknown cost is counted apart, not as zero", () => {
    const t = spendTotals([row(2, "EUR"), row(null, "USD", "unknown")]);
    expect(t.totals).toEqual({ EUR: 2 });
    expect(t.unknown).toBe(1);
    expect(t.complete).toBe(false);
  });

  it("a month without unknown costs is complete", () => {
    expect(spendTotals([row(1, "USD"), row(2, "EUR")]).complete).toBe(true);
  });
});

describe("budget thresholds (CA-5)", () => {
  it("79 of 100: no warning", () => {
    const s = budgetState(79, 100);
    expect(s.warn).toBe(false);
    expect(s.paused).toBe(false);
  });
  it("80 of 100: warning, nothing paused", () => {
    const s = budgetState(80, 100);
    expect(s.warn).toBe(true);
    expect(s.paused).toBe(false);
  });
  it("100 of 100: warning and automatic work paused", () => {
    const s = budgetState(100, 100);
    expect(s.warn).toBe(true);
    expect(s.paused).toBe(true);
  });
  it("no limit set: no warning and no invented percentage", () => {
    const s = budgetState(500, null);
    expect(s.warn).toBe(false);
    expect(s.paused).toBe(false);
    expect(s.pct).toBe(0);
  });
});
