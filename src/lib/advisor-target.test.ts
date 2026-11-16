import { describe, expect, it } from "vitest";
import { strategyTargetFor } from "./advisor-target";

const r = (title: string, rationale = "", kpi = "", actions: string[] = []) => ({
  title,
  rationale,
  kpi,
  actions,
});

describe("B4 advisor proposal → Estrategia field", () => {
  it("ICP proposal opens ICP", () =>
    expect(strategyTargetFor(r("Afinar el ICP de agencias")).tab).toBe("icp"));
  it("messages open Mensajes", () =>
    expect(strategyTargetFor(r("Reescribir los mensajes para CFOs")).tab).toBe("pillars"));
  it("CAC/payback opens Payback", () =>
    expect(strategyTargetFor(r("Bajar el CAC en pymes")).tab).toBe("payback"));
  it("the title wins over the rationale", () =>
    expect(strategyTargetFor(r("Lanzar outbound a mid-market", "mejora el ICP")).tab).toBe(
      "motions",
    ));
  it("no match falls back to the AI review", () =>
    expect(strategyTargetFor(r("Contratar dos personas"))).toEqual({
      tab: "review",
      label: "Revisión con IA",
    }));
});
