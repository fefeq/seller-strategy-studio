import { describe, expect, it } from "vitest";
import { listeningStats, nextPhase, U_PHASES } from "./theory-u";

describe("U journey phases", () => {
  it("follows the 5 movements in order", () =>
    expect(U_PHASES.map((p) => p.key)).toEqual(["co_initiating", "co_sensing", "presencing", "co_creating", "co_evolving"]));
  it("presencing leads to co-creating", () => expect(nextPhase("presencing")).toBe("co_creating"));
  it("co-evolving is the last phase", () => expect(nextPhase("co_evolving")).toBeNull());
});

describe("listening levels", () => {
  it("ignores meetings without a level", () => expect(listeningStats([1, null, 3, undefined]).count).toBe(2));
  it("averages the 4 levels", () => expect(listeningStats([1, 2, 3, 4]).average).toBe(2.5));
  it("deep listening = empathic + generative share", () => expect(listeningStats([1, 1, 3, 4]).deepShare).toBe(0.5));
  it("rejects values outside 1–4", () => expect(listeningStats([0, 5, 2]).distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0 }));
});
