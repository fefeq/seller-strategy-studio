import { describe, expect, it } from "vitest";
import {
  REJECTED_EXPENSE_MESSAGE,
  canManageOrgCurrency,
  decideAssistantExpense,
  expenseIdempotencyKey,
  normalizeCurrency,
  parsePositiveAmount,
} from "./assistant-expense-currency";

describe("assistant expense currency", () => {
  it("saves in the company currency", () => {
    expect(decideAssistantExpense({ orgCurrency: "USD", incomingCurrency: "usd", amount: 120 })).toEqual({
      kind: "save",
      amount: 120,
      currency: "USD",
    });
  });

  it("each company keeps its own currency", () => {
    const a = decideAssistantExpense({ orgCurrency: "MXN", incomingCurrency: "MXN", amount: 10 });
    const b = decideAssistantExpense({ orgCurrency: "EUR", incomingCurrency: "EUR", amount: 10 });
    expect(a.kind === "save" && a.currency).toBe("MXN");
    expect(b.kind === "save" && b.currency).toBe("EUR");
  });

  it("rejects a missing or different currency", () => {
    expect(decideAssistantExpense({ orgCurrency: "USD", incomingCurrency: undefined, amount: 5 })).toMatchObject({
      kind: "reject",
      reason: "missing_currency",
    });
    expect(decideAssistantExpense({ orgCurrency: "USD", incomingCurrency: "EUR", amount: 5 })).toMatchObject({
      kind: "reject",
      reason: "currency_mismatch",
    });
    expect(decideAssistantExpense({ orgCurrency: null, incomingCurrency: "USD", amount: 5 })).toMatchObject({
      kind: "reject",
      reason: "missing_org_currency",
    });
  });

  it("rejects non positive amounts", () => {
    for (const amount of [0, -3, Number.NaN, Infinity, "abc", null, ""]) {
      expect(decideAssistantExpense({ orgCurrency: "USD", incomingCurrency: "USD", amount })).toMatchObject({
        kind: "reject",
        reason: "invalid_amount",
      });
    }
    expect(parsePositiveAmount("12.5")).toBe(12.5);
  });

  it("rejection message has no internal details", () => {
    expect(REJECTED_EXPENSE_MESSAGE).not.toMatch(/error|exception|sql|null/i);
  });

  it("same action gives the same key, so retries never duplicate", () => {
    expect(expenseIdempotencyKey("abc")).toBe(expenseIdempotencyKey(" abc "));
    expect(() => expenseIdempotencyKey("  ")).toThrow();
  });

  it("only the owner may change the currency", () => {
    expect(canManageOrgCurrency("owner")).toBe(true);
    expect(canManageOrgCurrency("ae")).toBe(false);
    expect(canManageOrgCurrency("sdr")).toBe(false);
    expect(canManageOrgCurrency(undefined)).toBe(false);
  });

  it("normalizes currency codes", () => {
    expect(normalizeCurrency(" eur ")).toBe("EUR");
    expect(normalizeCurrency("euros")).toBeNull();
    expect(normalizeCurrency(42)).toBeNull();
  });
});
