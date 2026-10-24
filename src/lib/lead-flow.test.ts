import { describe, expect, it } from "vitest";
import { corporateDomain, flowLines, pickKeyPeople, readFlow, shouldRunFlow } from "./lead-flow";

describe("lead flow", () => {
  it("runs once for a new lead, never for opportunities, and again only when a person asks", () => {
    expect(shouldRunFlow({ enriched_at: null, stage: "new" })).toBe(true);
    expect(shouldRunFlow({ enriched_at: "2026-10-24", stage: "new" })).toBe(false);
    expect(shouldRunFlow({ enriched_at: null, stage: "opportunity" })).toBe(false);
    expect(shouldRunFlow({ enriched_at: null, stage: "disqualified" })).toBe(false);
    expect(shouldRunFlow({ enriched_at: "2026-10-24", stage: "mql" }, true)).toBe(true);
  });
  it("only corporate emails give the company domain", () => {
    expect(corporateDomain("ana@Typeform.com")).toBe("typeform.com");
    expect(corporateDomain("ana@gmail.com")).toBeNull();
    expect(corporateDomain(null)).toBeNull();
  });
  it("shows the most senior people first, without the lead's own contact", () => {
    const rows = [
      { name: "Luis Pérez", title: "Sales Manager", linkedin: null },
      { name: "Ana Ruiz", title: "CEO & Founder", linkedin: null },
      { name: "Marta Gil", title: "VP Sales", linkedin: null },
      { name: "Juan Sol", title: "Head of Growth", linkedin: null },
    ];
    expect(pickKeyPeople(rows, "Juan Sol", 3).map((p) => p.name)).toEqual(["Ana Ruiz", "Marta Gil", "Luis Pérez"]);
  });
  it("summarises steps in flow order and reads old rows", () => {
    expect(readFlow(null)).toBeNull();
    const f = readFlow({ at: "x", steps: { proposal: { status: "done", note: "SQL" }, account: { status: "done", note: "Creada" } } })!;
    expect(flowLines(f)).toEqual(["Cuenta: Creada", "Propuesta de IA: SQL"]);
  });
});
