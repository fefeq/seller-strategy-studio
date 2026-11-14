// Independent review 14-11 (NK-0167): a draft line in the business-lines step must not survive a company switch.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("remounts the business-lines step per company so an open draft is dropped", () => {
  const src = readFileSync("src/routes/_authenticated/onboarding.tsx", "utf8");
  expect(src).toMatch(/<BusinessLinesStep\s+key=\{orgId/);
});
