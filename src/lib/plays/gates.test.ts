import { describe, expect, it } from "vitest";
import { runGates } from "./gates";
import type { GateDef, GateResult } from "./types";

const gate = (key: string, r: GateResult): GateDef => ({ key, check: () => r });
const PASS: GateResult = { v: "pass" };

describe("runGates (CA-14, G-2)", () => {
  it("passes only when every gate passes", () => {
    expect(runGates([gate("a", PASS), gate("b", PASS)], {})).toEqual({ v: "pass" });
  });

  it("drops with the key and the Spanish reason of the first gate that fails, and does not run the rest", () => {
    let ran = false;
    const third: GateDef = { key: "c", check: () => ((ran = true), PASS) };
    const res = runGates([gate("a", PASS), gate("b", { v: "fail", reason: "La cuenta ya es cliente" }), gate("b2", { v: "fail", reason: "otra" }), third], {});
    expect(res).toEqual({ v: "drop", gate: "b", reason: "La cuenta ya es cliente" });
    expect(ran).toBe(false);
  });

  it("evaluates gates in order over the same subject", () => {
    const seen: string[] = [];
    const g = (key: string): GateDef => ({ key, check: (s) => (seen.push(`${key}:${String(s.id)}`), PASS) });
    runGates([g("a"), g("b")], { id: 7 });
    expect(seen).toEqual(["a:7", "b:7"]);
  });

  it("passes a play with no gates (nothing to fail) without inventing a reason", () => {
    expect(runGates([], {})).toEqual({ v: "pass" });
  });
});

describe("unknown never passes (CA-15, G-2)", () => {
  it("drops an unknown gate with «dato desconocido» and the name of the missing datum", () => {
    const res = runGates([gate("a", PASS), gate("ventana", { v: "unknown", missing: "fecha de cierre" })], {});
    expect(res.v).toBe("drop");
    if (res.v !== "drop") return;
    expect(res.gate).toBe("ventana");
    expect(res.reason.toLowerCase()).toContain("dato desconocido");
    expect(res.reason).toContain("fecha de cierre");
    expect(res.missing).toBe("fecha de cierre");
  });

  it("does not let a later passing gate rescue an unknown one", () => {
    const res = runGates([gate("a", { v: "unknown", missing: "motivo de pérdida" }), gate("b", PASS)], {});
    expect(res.v).toBe("drop");
  });

  it("keeps the first non-pass gate when a fail comes before an unknown", () => {
    const res = runGates([gate("a", { v: "fail", reason: "No encaja" }), gate("b", { v: "unknown", missing: "x" })], {});
    expect(res).toEqual({ v: "drop", gate: "a", reason: "No encaja" });
  });
});
