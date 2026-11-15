// NK-0080: the answer of an approved suggestion whose action fails goes through errorText.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("a suggestion whose action fails rethrows the translated text, not the raw message", () => {
  const s = readFileSync("src/lib/agent.functions.ts", "utf8");
  expect(s).not.toMatch(/throw new Error\(\(e as Error\)\.message\)/);
  expect(s).toContain("throw new Error(errorText(e));");
});
