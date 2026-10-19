import { describe, expect, it } from "vitest";
import { dedupePeople } from "./dedupe";

describe("dedupePeople", () => {
  it("skips a person whose email already exists (case-insensitive)", () => {
    const r = dedupePeople([{ email: "Ana@Acme.com" }], [{ email: "ana@acme.com" }]);
    expect(r.fresh).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });
  it("skips a person whose LinkedIn URL matches ignoring protocol/www/trailing slash", () => {
    const r = dedupePeople(
      [{ email: "new@x.com", linkedin_url: "https://www.linkedin.com/in/ana/" }],
      [{ linkedin_url: "linkedin.com/in/ana" }],
    );
    expect(r.skipped).toBe(1);
  });
  it("dedupes within the same batch", () => {
    const r = dedupePeople([{ email: "a@x.com" }, { email: "a@x.com" }], []);
    expect(r.fresh).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });
  it("skips rows with neither email nor LinkedIn", () => {
    expect(dedupePeople([{ full_name: "Sin datos" }], []).skipped).toBe(1);
  });
});
