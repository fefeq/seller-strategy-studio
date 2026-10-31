// Regression, not fail-first (SDD field-write-paths-normalization, CA-7): zod already drops unknown keys, so
// this passes on the base. It fixes that create_account takes no size or country; whoever adds them to the
// schema has to pass them through normalizeForSave and update this test.
import { describe, expect, it } from "vitest";
import { CORE_WRITE_TOOLS } from "./core-write";

describe("create_account input (SDD field-write-paths-normalization, CA-7)", () => {
  const tool = CORE_WRITE_TOOLS.find((t) => t.name === "create_account")!;
  it("drops size and country when parsing, without an error", () => {
    const r = tool.input.safeParse({
      name: "Acme Test",
      domain: "acme.test",
      size: "51-200",
      country: "España",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data).toEqual({ name: "Acme Test", domain: "acme.test" });
  });
  it("does not declare size or country in its shape", () => {
    const shape = (tool.input as unknown as { shape: Record<string, unknown> }).shape;
    expect(Object.keys(shape)).not.toContain("size");
    expect(Object.keys(shape)).not.toContain("country");
  });
});
