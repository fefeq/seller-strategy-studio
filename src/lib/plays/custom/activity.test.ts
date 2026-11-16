import { expect, it } from "vitest";
import { summarizePlayCosts } from "./activity";
it("CA-5 measured USD and estimated EUR are never added together; missing usage is not zero measured", () => {
  expect(
    summarizePlayCosts([
      { cost_kind: "ai_measured", currency: "USD", amount: 0.12 },
      { cost_kind: "provider_estimated", currency: "EUR", amount: 0.01 },
      { cost_kind: "ai_sin_dato", currency: "USD", amount: 0 },
    ]),
  ).toEqual({
    totals: [
      { kind: "ai_measured", currency: "USD", amount: 0.12 },
      { kind: "provider_estimated", currency: "EUR", amount: 0.01 },
    ],
    unknown: 1,
  });
});
