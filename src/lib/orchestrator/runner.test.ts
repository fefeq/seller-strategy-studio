import { describe, expect, it } from "vitest";
import { normalizeProposed } from "../apollo";

const web = (field: "size" | "country" | "industry", proposed: string) => ({ field, current: null, proposed, empty: true, source: "web", quote: "q" });

describe("normalizeProposed, the web fallback and the automatic writer (SDD field-write-paths-normalization, CA-3, CA-4)", () => {
  it("CA-3: a country name becomes ISO", () => {
    expect(normalizeProposed(web("country", "España"))?.proposed).toBe("ES");
  });
  it("CA-3: a country that does not fit is not written", () => {
    expect(normalizeProposed(web("country", "Madrid, España"))).toBeNull();
  });
  it("CA-4: a range becomes the canonical size", () => {
    expect(normalizeProposed(web("size", "50-100"))?.proposed).toBe("50–100 empleados");
  });
  it("CA-4: a size that is not a headcount is not written", () => {
    expect(normalizeProposed(web("size", "unos 50"))).toBeNull();
  });
  it("keeps the rest of the change and leaves other fields as they are", () => {
    expect(normalizeProposed(web("country", "España"))).toMatchObject({ source: "web", quote: "q", empty: true });
    expect(normalizeProposed(web("industry", "Software"))?.proposed).toBe("Software");
  });
});
