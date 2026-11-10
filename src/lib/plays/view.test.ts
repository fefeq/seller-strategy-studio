import { describe, expect, it } from "vitest";
import { APPROVALS, CATALOG, CHANNELS, MOTIONS, PHASES, STATUSES } from "./catalog";
import {
  APPROVAL_WORD,
  CHANNEL_LABEL,
  MOTION_LABEL,
  PHASE_WORD,
  STATUS_WORD,
  filterPlays,
} from "./view";
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

// SDD-20261110-plays-phase-autonomy-deps U-3 (CA-3).
describe("phase and approval words (CA-3, G-1)", () => {
  it("names the four phases and the two approval levels with the texts of the SDD", () => {
    expect(PHASE_WORD).toEqual({
      fundacion: "Fundación",
      captura: "Captura",
      generacion: "Generación",
      orquestacion: "Orquestación",
    });
    expect(APPROVAL_WORD).toEqual({
      nokko_con_ayuda: "NOKKO prepara, tú decides",
      nokko_borrador: "NOKKO redacta, tú apruebas",
    });
    expect(Object.keys(PHASE_WORD)).toEqual([...PHASES]);
    expect(Object.keys(APPROVAL_WORD)).toEqual([...APPROVALS]);
  });

  it("describePlay carries the same words, so the screen and the agent never differ", () => {
    for (const p of CATALOG) {
      const d = describePlay(p, null);
      expect(d.phase, p.id).toBe(p.phase);
      expect(d.phaseLabel, p.id).toBe(PHASE_WORD[p.phase]);
      expect(d.approval, p.id).toBe(p.approval);
      expect(d.approvalLabel, p.id).toBe(APPROVAL_WORD[p.approval]);
    }
  });
});

describe("filter by phase (CA-3, G-1)", () => {
  it("filters by each phase and keeps the catalogue order", () => {
    for (const ph of PHASES) {
      const got = filterPlays(all, { motion: "all", status: "all", phase: ph }).map((p) => p.id);
      expect(got, ph).toEqual(CATALOG.filter((p) => p.phase === ph).map((p) => p.id));
      expect(got.length, ph).toBeGreaterThan(0);
    }
  });

  it("treats a missing phase and «all» as no phase filter", () => {
    expect(filterPlays(all, { motion: "all", status: "all" })).toHaveLength(28);
    expect(filterPlays(all, { motion: "all", status: "all", phase: "all" })).toHaveLength(28);
  });

  it("combines with motion and status without changing them", () => {
    const got = filterPlays(all, {
      motion: "cuentas",
      status: "parcial",
      phase: "captura",
    }).map((p) => p.id);
    expect(got).toEqual(
      CATALOG.filter(
        (p) => p.motion.includes("cuentas") && p.status === "parcial" && p.phase === "captura",
      ).map((p) => p.id),
    );
    expect(got.length).toBeGreaterThan(0);
  });

  it("never names Frontal in the new words", () => {
    expect(JSON.stringify([PHASE_WORD, APPROVAL_WORD]).toLowerCase()).not.toContain("frontal");
  });
});
