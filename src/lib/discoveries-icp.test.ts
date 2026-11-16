import { describe, expect, it } from "vitest";
import { PER_ICP, peopleTargets, tallyByIcp } from "./discoveries";

describe("Descubiertos por ICP", () => {
  it("searches people in at most 2 companies per ICP: empty target accounts first, then the best new fits", () => {
    const t = peopleTargets(
      [
        { id: "a1", name: "Mapped", domain: "mapped.com", people: 3 },
        { id: "a2", name: "Empty", domain: "empty.com", people: 0 },
      ],
      [
        { name: "Low", domain: "low.com", fit: 61 },
        { name: "High", domain: "https://www.high.com", fit: 90 },
      ],
    );
    expect(PER_ICP.searches).toBe(2);
    expect(t.map((x) => x.name)).toEqual(["Empty", "High"]);
    expect(t[0]!.accountId).toBe("a2");
    expect(t[1]!.accountId).toBeNull();
  });
  it("skips companies without a domain and repeated domains", () => {
    const t = peopleTargets(
      [],
      [
        { name: "NoDomain", domain: null, fit: 99 },
        { name: "A", domain: "a.com", fit: 80 },
        { name: "A bis", domain: "www.a.com", fit: 70 },
      ],
      3,
    );
    expect(t.map((x) => x.name)).toEqual(["A"]);
  });
  it("counts only pending companies and contacts per ICP", () => {
    const m = tallyByIcp([
      { kind: "company", status: "pending", detail: { icp_id: "i1" } },
      { kind: "contact", status: "pending", detail: { icp_id: "i1" } },
      { kind: "contact", status: "accepted", detail: { icp_id: "i1" } },
      { kind: "competitor", status: "pending", detail: {} },
      { kind: "contact", status: "pending", detail: {} },
    ]);
    expect(m.get("i1")).toEqual({ company: 1, contact: 1 });
    expect(m.get("")).toEqual({ company: 0, contact: 1 });
  });
});
