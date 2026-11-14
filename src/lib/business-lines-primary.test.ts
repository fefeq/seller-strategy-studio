import { describe, expect, it } from "vitest";
import { primaryLine } from "./business-lines";

const l = (id: string, is_primary: boolean, acv: number, friction = "committee") =>
  ({ id, is_primary, position: 0, name: id === "a" ? "Enterprise" : null, model: "b2b", acv, friction, stage: "early" });

describe("primaryLine: archetype read by Inicio, Estrategia, Métricas and Segmentos", () => {
  it("uses the primary line, not the first one", () => {
    const p = primaryLine([l("b", false, 6000, "self_serve"), l("a", true, 80000)]);
    expect(p?.result.archetype).toBe("C");
    expect(p?.label).toBe("Enterprise");
    expect(p?.extra).toBe(1);
  });
  it("no primary or two primaries gives null", () => {
    expect(primaryLine([l("a", false, 80000)])).toBeNull();
    expect(primaryLine([l("a", true, 80000), l("b", true, 6000)])).toBeNull();
  });
  it("a primary with an invalid ticket gives null", () => {
    expect(primaryLine([l("a", true, 0)])).toBeNull();
  });
});
