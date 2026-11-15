// A2 (PLAN-UX-20261115): reads that spend are proposed with a real-history estimate and keep their result.
import { describe, expect, it } from "vitest";
import { getTool } from "@/lib/agent/tools";
import { SPENDING_READS, estimateText, spendResultText, spendSummary, withEstimate } from "./spend-confirm";
import { webSpendRows } from "@/lib/web-search";

describe("spending reads need confirmation", () => {
  it("each Apollo/Clay/Parallel/G2/LinkedIn/web read that spends is a write tool with a summary", () => {
    for (const n of SPENDING_READS) {
      const t = getTool(n)!;
      expect(t.kind, n).toBe("write");
      expect(t.spends, n).toBe(true);
      expect(typeof t.summarize, n).toBe("function");
    }
  });
  it("free reads stay immediate (Apollo people search is free)", () => {
    expect(getTool("apollo_find_people")!.kind).toBe("read");
    expect(getTool("get_account_report")!.kind).toBe("read");
  });
  it("summary names the key argument", () => {
    expect(spendSummary("competitor_reviews", { competitor: "Buffer" })).toContain("«Buffer»");
  });
});

describe("estimate comes only from measured history", () => {
  it("no samples → sin dato, never zero", () => {
    expect(estimateText([], "clay_find_people")).toBe("coste aprox.: sin dato");
  });
  it("unknown or estimated costs are not evidence", () => {
    const rows = [
      { cost: null, currency: "EUR", cost_kind: "unknown" as const, tool: "x" },
      { cost: 5, currency: "EUR", cost_kind: "estimate" as const, tool: "x" },
    ];
    expect(estimateText(rows, "x")).toBe("coste aprox.: sin dato");
  });
  it("median per currency, currencies never merged", () => {
    const m = (cost: number, currency: string) => ({ cost, currency, cost_kind: "measured" as const, tool: "x" });
    const t = estimateText([m(1, "EUR"), m(3, "EUR"), m(2, "USD")], "x");
    expect(t).toMatch(/2\s€/);
    expect(t).toContain("US$");
    expect(t).toContain(" + ");
  });
  it("card text names the provider and the estimate", () => {
    expect(withEstimate("Buscar", "clay_find_people", "coste aprox.: sin dato")).toBe(
      "Buscar · gasta clay · coste aprox.: sin dato",
    );
  });
});

describe("the confirmed result is kept", () => {
  it("includes the data, not only «Hecho»", () => {
    const t = spendResultText("Buscar", { empresas: [{ name: "Acme" }] });
    expect(t).toContain("Hecho: Buscar.");
    expect(t).toContain("Acme");
  });
});

describe("loose web searches are charged to the company", () => {
  it("one unknown-cost row per provider, never zero", () => {
    const rows = webSpendRows(
      { db: {} as never, orgId: "o1", userId: "", tool: "research_stakeholder", trigger: "manual" },
      ["firecrawl", "parallel"],
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.org_id === "o1" && r.cost === null && r.cost_kind === "unknown")).toBe(true);
    expect(rows[0]!.user_id).toBeNull();
  });
});
