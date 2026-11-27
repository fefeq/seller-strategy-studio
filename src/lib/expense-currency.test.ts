import { describe, expect, it } from "vitest";
import { canChangeCompanyCurrency, checkExpense, normalizeCurrency, totalsByCurrency } from "./expense-currency";

describe("expense currency", () => {
  it("uses the company currency when the expense has none", () => {
    expect(checkExpense({ amount: 120000 }, "COP")).toEqual({ ok: true, currency: "COP" });
  });

  it("rejects an expense in a different currency with a reason", () => {
    const result = checkExpense({ amount: 50, currency: "EUR" }, "COP");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("currency_mismatch");
      expect(result.message).toContain("No se guardó");
    }
  });

  it("asks to choose a currency when the company has none", () => {
    const result = checkExpense({ amount: 10 }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("needs_company_currency");
  });

  it("rejects zero, negative or non numeric amounts", () => {
    for (const amount of [0, -5, Number.NaN, "100"]) {
      const result = checkExpense({ amount }, "COP");
      expect(result.ok).toBe(false);
    }
  });

  it("rejects unknown currencies", () => {
    expect(normalizeCurrency("XXX")).toBeNull();
    const result = checkExpense({ amount: 10, currency: "XXX" }, "COP");
    expect(result.ok).toBe(false);
  });

  it("only lets the owner change the company currency", () => {
    expect(canChangeCompanyCurrency("owner")).toBe(true);
    for (const role of ["ae", "sdr", "marketing", null, undefined]) {
      expect(canChangeCompanyCurrency(role)).toBe(false);
    }
  });

  it("keeps totals separated by currency and never mixes them", () => {
    const totals = totalsByCurrency([
      { amount: 100, currency: "EUR", needs_review: true },
      { amount: 50, currency: "EUR", needs_review: true },
      { amount: 200000, currency: "COP" },
    ]);
    expect(totals).toEqual([
      { currency: "COP", total: 200000, expenses: 1, toReview: 0 },
      { currency: "EUR", total: 150, expenses: 2, toReview: 2 },
    ]);
  });
});
