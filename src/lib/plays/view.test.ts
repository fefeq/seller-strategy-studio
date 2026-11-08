import { describe, expect, it } from "vitest";
import { CATALOG, CHANNELS, MOTIONS, STATUSES } from "./catalog";
import { CHANNEL_LABEL, MOTION_LABEL, STATUS_WORD, filterPlays } from "./view";
import { describePlay } from "./status";

const all = CATALOG.map((p) => describePlay(p, null));

describe("filters of /plays (CA-5, G-1)", () => {
  it("lists the 28 plays with no filter", () => {
    expect(filterPlays(all, { motion: "all", status: "all" })).toHaveLength(28);
  });

  it("filters by motion", () => {
    for (const m of MOTIONS) {
      const got = filterPlays(all, { motion: m, status: "all" }).map((p) => p.id);
      expect(got, m).toEqual(CATALOG.filter((p) => p.motion.includes(m)).map((p) => p.id));
    }
    expect(filterPlays(all, { motion: "producto", status: "all" }).map((p) => p.id)).toContain(
      "plg-to-sales",
    );
  });

  it("filters by status", () => {
    for (const s of STATUSES) {
      expect(
        filterPlays(all, { motion: "all", status: s }).map((p) => p.id),
        s,
      ).toEqual(CATALOG.filter((p) => p.status === s).map((p) => p.id));
    }
    expect(filterPlays(all, { motion: "all", status: "bloqueado" }).length).toBe(16);
  });

  it("combines both filters and keeps the catalogue order", () => {
    const got = filterPlays(all, { motion: "cuentas", status: "parcial" }).map((p) => p.id);
    expect(got).toEqual(
      CATALOG.filter((p) => p.motion.includes("cuentas") && p.status === "parcial").map(
        (p) => p.id,
      ),
    );
    expect(got.length).toBeGreaterThan(0);
  });

  it("shows blocked plays by default, so you can see what is missing (SDD question 3)", () => {
    expect(
      filterPlays(all, { motion: "all", status: "all" }).some((p) => p.status === "bloqueado"),
    ).toBe(true);
  });
});

describe("words of /plays (CA-5, G-1)", () => {
  it("names every status with a word, never an icon or a colour alone", () => {
    expect(STATUS_WORD).toEqual({
      activo: "Activo",
      parcial: "Parcial",
      planificado: "Planificado",
      bloqueado: "Bloqueado",
    });
  });

  it("labels every motion and channel in Spanish without icons", () => {
    for (const m of MOTIONS) expect(MOTION_LABEL[m], m).toMatch(/^[\p{L} ]+$/u);
    for (const c of CHANNELS) expect(CHANNEL_LABEL[c], c).toMatch(/^[\p{L} ]+$/u);
  });

  it("never names Frontal in anything the interface shows", () => {
    const text = JSON.stringify([
      STATUS_WORD,
      MOTION_LABEL,
      CHANNEL_LABEL,
      all.map((p) => [p.title, p.needs, p.label]),
    ]);
    expect(text.toLowerCase()).not.toContain("frontal");
  });
});
