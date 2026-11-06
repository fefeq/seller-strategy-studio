// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// NK-0065: fixture product names must be fictitious. «VeriDoc» is a real company (VeriDoc Global), so it must not
// come back in any fixture or eval test.
describe("eval fixtures use fictitious product names (NK-0065)", () => {
  const dir = join(__dirname, "fixtures");
  it.each(readdirSync(dir).filter((f) => f.endsWith(".json")))(
    "%s has no real company name",
    (file) => {
      expect(readFileSync(join(dir, file), "utf8")).not.toMatch(/veridoc/i);
    },
  );
});
