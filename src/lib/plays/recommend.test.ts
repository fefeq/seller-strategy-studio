import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, type Play } from "./catalog";
import { effectiveState } from "./status";
import { recommendablePlays } from "./recommend";

// SDD-20261110-plays-phase-autonomy-deps U-2 (CA-6, CA-7, CA-8). The catalogue is a parameter, so chains, cycles and unknown ids are
// tested with made-up catalogues, not the real one.
const play = (id: string, o: Partial<Play> = {}): Play => ({
  id,
  title: `Play ${id}`,
  motion: ["cuentas"],
  channels: ["crm"],
  status: "parcial",
  needs: ["Algo"],
  detectors: [],
  defaultEnabled: false,
  outputs: ["suggestion"],
  gates: [],
  sdd: 2,
  phase: "captura",
  approval: "nokko_borrador",
  dependsOn: [],
  ...o,
});
const ids = (ps: Play[]) => ps.map((p) => p.id);
const reasonOf = (r: ReturnType<typeof recommendablePlays>, id: string) =>
  r.excluded.find((e) => e.play.id === id)?.reason;

describe("recommendablePlays: who is left out (CA-6, G-3)", () => {
  it("never recommends a blocked or planned play, and says why with the status text", () => {
    const blocked = play("b", { status: "bloqueado", blockedBy: "proveedor_datos" });
    const planned = play("p", { status: "planificado" });
    const r = recommendablePlays([play("ok"), blocked, planned]);
    expect(ids(r.recommended)).toEqual(["ok"]);
    expect(reasonOf(r, "b")).toBe(effectiveState(blocked, null).reason);
    expect(reasonOf(r, "p")).toBe(effectiveState(planned, null).reason);
    expect(reasonOf(r, "b")).toBe("falta un proveedor de datos");
  });

  it("leaves out a play that depends on a blocked one, naming the title", () => {
    const r = recommendablePlays([
      play("a", { status: "bloqueado", blockedBy: "linkedin_d2", title: "Base" }),
      play("b", { dependsOn: ["a"] }),
    ]);
    expect(r.recommended).toEqual([]);
    expect(reasonOf(r, "b")).toBe("depende de Base, que no está disponible");
  });

  it("follows indirect chains: a depends on b depends on a planned c", () => {
    const r = recommendablePlays([
      play("c", { status: "planificado", title: "Cimiento" }),
      play("b", { dependsOn: ["c"], title: "Medio" }),
      play("a", { dependsOn: ["b"] }),
    ]);
    expect(r.recommended).toEqual([]);
    expect(reasonOf(r, "b")).toBe("depende de Cimiento, que no está disponible");
    expect(reasonOf(r, "a")).toBe("depende de Medio, que no está disponible");
  });

  it("excludes a play with an unknown dependency as a catalogue error, without throwing", () => {
    const r = recommendablePlays([play("a", { dependsOn: ["nope"] }), play("ok")]);
    expect(ids(r.recommended)).toEqual(["ok"]);
    expect(reasonOf(r, "a")).toBe("El catálogo tiene un error en este play");
  });

  it("excludes a play that depends on itself and the plays of a cycle, without looping", () => {
    const r = recommendablePlays([
      play("self", { dependsOn: ["self"] }),
      play("x", { dependsOn: ["y"] }),
      play("y", { dependsOn: ["x"] }),
      play("ok"),
    ]);
    expect(ids(r.recommended)).toEqual(["ok"]);
    for (const id of ["self", "x", "y"])
      expect(reasonOf(r, id), id).toBe("El catálogo tiene un error en este play");
  });

  it("treats a play that depends on an invalid one as depending on something unavailable", () => {
    const r = recommendablePlays([
      play("bad", { dependsOn: ["nope"], title: "Roto" }),
      play("child", { dependsOn: ["bad"] }),
    ]);
    expect(r.recommended).toEqual([]);
    expect(reasonOf(r, "child")).toBe("depende de Roto, que no está disponible");
  });

  it("returns every play exactly once, recommended or excluded", () => {
    const cat = [
      play("a"),
      play("b", { status: "planificado" }),
      play("c", { dependsOn: ["b"] }),
      play("d", { dependsOn: ["zz"] }),
    ];
    const r = recommendablePlays(cat);
    expect([...ids(r.recommended), ...r.excluded.map((e) => e.play.id)].sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    for (const e of r.excluded) expect(e.reason.length, e.play.id).toBeGreaterThan(0);
  });

  it("holds on the real catalogue: nothing blocked or planned comes back recommended", () => {
    const r = recommendablePlays(CATALOG);
    expect(r.recommended.length).toBeGreaterThan(0);
    for (const p of r.recommended) {
      expect(["bloqueado", "planificado"], p.id).not.toContain(p.status);
      for (const d of p.dependsOn) expect(ids(r.recommended), `${p.id} → ${d}`).toContain(d);
    }
    expect(r.recommended.length + r.excluded.length).toBe(CATALOG.length);
    for (const e of r.excluded) expect(e.reason.trim().length, e.play.id).toBeGreaterThan(0);
  });
});

describe("recommendablePlays: order (CA-7, G-1)", () => {
  it("orders by phase: fundación, captura, generación, orquestación", () => {
    const r = recommendablePlays([
      play("o", { phase: "orquestacion" }),
      play("g", { phase: "generacion" }),
      play("c", { phase: "captura" }),
      play("f", { phase: "fundacion" }),
    ]);
    expect(ids(r.recommended)).toEqual(["f", "c", "g", "o"]);
  });

  it("puts a play after what it depends on within the same phase, even when the catalogue lists it first", () => {
    const r = recommendablePlays([
      play("late", { dependsOn: ["mid"] }),
      play("mid", { dependsOn: ["first"] }),
      play("first"),
    ]);
    expect(ids(r.recommended)).toEqual(["first", "mid", "late"]);
  });

  it("keeps the catalogue order between plays with no dependency between them", () => {
    const r = recommendablePlays([play("z"), play("a"), play("m")]);
    expect(ids(r.recommended)).toEqual(["z", "a", "m"]);
  });

  it("gives the same answer for the same catalogue", () => {
    const first = recommendablePlays(CATALOG);
    expect(recommendablePlays(CATALOG)).toEqual(first);
  });

  it("on the real catalogue, a dependency always comes before its dependent", () => {
    const got = ids(recommendablePlays(CATALOG).recommended);
    for (const p of CATALOG)
      for (const d of p.dependsOn)
        if (got.includes(p.id))
          expect(got.indexOf(d), `${p.id} → ${d}`).toBeLessThan(got.indexOf(p.id));
  });
});

describe("recommendablePlays: recommending is not enabling (CA-8, G-3)", () => {
  it("recommends a play that is not enabled in the company, because it only gets the catalogue", () => {
    expect(recommendablePlays.length).toBe(1);
    const r = recommendablePlays([play("off", { defaultEnabled: false })]);
    expect(ids(r.recommended)).toEqual(["off"]);
  });

  it("does not touch play_states or any client (source guard)", () => {
    const src = readFileSync(path.resolve(__dirname, "recommend.ts"), "utf8");
    expect(src).not.toMatch(/play_states|supabase|\.from\(|\.insert\(|\.upsert\(|\.update\(/);
  });
});
