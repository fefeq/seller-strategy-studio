import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Reads eslint.config.js as source (like the other source-reading tests); no eslint is run here.
const config = readFileSync(resolve(__dirname, "../../eslint.config.js"), "utf8");
const match = config.match(/ignores:\s*\[([^\]]*)\]/);
const ignores = (match?.[1] ?? "").match(/"[^"]+"/g)?.map((s) => s.slice(1, -1)) ?? [];

describe("eslint ignores", () => {
  it("ignores the Lovable-generated Supabase types file, exactly", () => {
    expect(ignores).toContain("src/integrations/supabase/types.ts");
  });

  it("keeps the build output ignores", () => {
    expect(ignores).toEqual(expect.arrayContaining(["dist", ".output", ".vinxi"]));
  });

  it("does not ignore anything else", () => {
    expect([...ignores].sort()).toEqual(
      ["dist", ".output", ".vinxi", "src/integrations/supabase/types.ts"].sort(),
    );
  });
});
