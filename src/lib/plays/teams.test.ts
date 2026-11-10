import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, OUTPUTS, type Play } from "./catalog";
import { recommendablePlays } from "./recommend";
import { describePlay } from "./status";
import {
  PLAY_TEAMS,
  TEAMS_INTRO,
  sharedWord,
  stepWord,
  summaryWord,
  teamPlan,
  unavailableWord,
  validateTeams,
  type PlayTeam,
} from "./teams";

// SDD-20261110-play-teams U-1 (CA-1 to CA-6, CA-15 text part). Catalogues and teams for the rules are made up; the real ones are pinned
// to the approved composition (SDD section 13).
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
const team = (id: string, plays: string[]): PlayTeam => ({
  id,
  title: `Equipo de plays ${id}`,
  task: "Una tarea.",
  plays,
});
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

const COMPOSITION: [string, string, string[]][] = [
  ["reuniones", "Reuniones", ["meeting-prep-and-follow-up", "meeting-form-orchestration"]],
  [
    "reactivar-perdidos",
    "Reactivar perdidos",
    ["closed-lost-revival", "signals-in-crm-with-decay"],
  ],
  ["senales-de-cuenta", "Señales de cuenta", ["signals-in-crm-with-decay", "signal-activation"]],
  [
    "aprender-de-llamadas",
    "Aprender de llamadas",
    ["call-transcript-signal-extraction", "pain-qualified-segments"],
  ],
  [
    "priorizar-cuentas-y-crm",
    "Priorizar cuentas y limpiar CRM",
    ["hubspot-account-tiering-scoring", "crm-hygiene"],
  ],
  [
    "entrantes-y-producto",
    "Entrantes y producto",
    ["plg-to-sales", "product-sign-up-outreach", "multi-thread-inbound-leads"],
  ],
];

describe("PLAY_TEAMS (CA-1, G-1)", () => {
  it("has exactly the six approved teams, in order, with unique kebab-case ids", () => {
    expect(PLAY_TEAMS.map((t) => [t.id, t.title, t.plays])).toEqual(COMPOSITION);
    expect(new Set(ids(PLAY_TEAMS)).size).toBe(6);
    for (const t of PLAY_TEAMS) expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it("gives every team a title and a task in Spanish", () => {
    for (const t of PLAY_TEAMS) {
      expect(t.title.trim(), t.id).not.toBe("");
      expect(t.task.trim(), t.id).not.toBe("");
    }
  });
});

describe("validateTeams (CA-2, G-1, G-3)", () => {
  it("accepts the real teams on the real catalogue", () => {
    expect(validateTeams(PLAY_TEAMS, CATALOG)).toEqual([]);
  });
  const cat = [play("a"), play("b", { dependsOn: ["a"] }), play("c")];
  it("accepts a valid made-up case", () => {
    expect(validateTeams([team("t1", ["a", "b"]), team("t2", ["c"])], cat)).toEqual([]);
  });
  it("names a play id that is not in the catalogue", () => {
    const e = validateTeams([team("t1", ["a", "zzz"])], cat);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/zzz/);
    expect(e[0]).toMatch(/t1/);
  });
  it("names a play repeated inside a team", () => {
    const e = validateTeams([team("t1", ["a", "c", "a"])], cat);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/repetido/);
  });
  it("names an empty team", () => {
    const e = validateTeams([team("t1", [])], cat);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/vacío/);
  });
  it("names two teams with the same id", () => {
    const e = validateTeams([team("t1", ["a"]), team("t1", ["c"])], cat);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/mismo id/);
  });
  it("names a play whose dependency is not in the same team", () => {
    const e = validateTeams([team("t1", ["b"])], cat);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/depende/);
    expect(e[0]).toMatch(/Play a/);
  });
});

describe("teamPlan: order and what is not available (CA-3, CA-4, G-1, G-3)", () => {
  const EXPECTED: Record<string, [string[], string[]]> = {
    reuniones: [["meeting-form-orchestration", "meeting-prep-and-follow-up"], []],
    "reactivar-perdidos": [["signals-in-crm-with-decay", "closed-lost-revival"], []],
    "senales-de-cuenta": [["signals-in-crm-with-decay", "signal-activation"], []],
    "aprender-de-llamadas": [["call-transcript-signal-extraction"], ["pain-qualified-segments"]],
    "priorizar-cuentas-y-crm": [["hubspot-account-tiering-scoring", "crm-hygiene"], []],
    "entrantes-y-producto": [
      ["plg-to-sales", "product-sign-up-outreach", "multi-thread-inbound-leads"],
      [],
    ],
  };
  it("matches the expected plan on the real catalogue, steps numbered from 1", () => {
    for (const t of PLAY_TEAMS) {
      const p = teamPlan(t, CATALOG, new Map());
      expect(ids(p.steps), t.id).toEqual(EXPECTED[t.id]![0]);
      expect(ids(p.unavailable), t.id).toEqual(EXPECTED[t.id]![1]);
      expect(
        p.steps.map((s) => s.n),
        t.id,
      ).toEqual(p.steps.map((_, i) => i + 1));
    }
  });
  it("keeps the relative order of recommendablePlays", () => {
    const order = ids(recommendablePlays(CATALOG).recommended);
    for (const t of PLAY_TEAMS) {
      const got = ids(teamPlan(t, CATALOG, new Map()).steps).map((i) => order.indexOf(i));
      expect(got, t.id).toEqual([...got].sort((a, b) => a - b));
    }
  });
  it("puts pain-qualified-segments in unavailable with the recommendablePlays reason", () => {
    const p = teamPlan(PLAY_TEAMS[3]!, CATALOG, new Map());
    expect(p.unavailable[0]?.reason).toBe("todavía no está construido");
    expect(p.unavailable[0]?.reason).toBe(
      recommendablePlays(CATALOG).excluded.find((e) => e.play.id === "pain-qualified-segments")
        ?.reason,
    );
  });
  it("never recommends a blocked, a planned or a play depending on a planned one; the reasons come from recommendablePlays", () => {
    const cat = [
      play("ok"),
      play("blk", { status: "bloqueado", blockedBy: "proveedor_datos" }),
      play("pln", { status: "planificado" }),
      play("dep", { dependsOn: ["pln"] }),
    ];
    const t = team("t", ["ok", "blk", "pln", "dep"]);
    const p = teamPlan(t, cat, new Map());
    expect(ids(p.steps)).toEqual(["ok"]);
    expect(ids(p.unavailable)).toEqual(["blk", "pln", "dep"]);
    const ex = recommendablePlays(cat).excluded;
    for (const u of p.unavailable)
      expect(u.reason, u.id).toBe(ex.find((e) => e.play.id === u.id)?.reason);
  });
  it("ignores a play id that is not in the catalogue instead of throwing", () => {
    const p = teamPlan(team("t", ["a", "nope"]), [play("a")], new Map());
    expect(ids(p.steps)).toEqual(["a"]);
    expect(p.summary.total).toBe(1);
  });
});

describe("teamPlan: shared state (CA-5, G-1)", () => {
  it("describes a play the same in both teams that hold it", () => {
    const rows = new Map([["signals-in-crm-with-decay", { enabled: true }]]);
    const a = teamPlan(PLAY_TEAMS[1]!, CATALOG, rows).steps.find(
      (s) => s.id === "signals-in-crm-with-decay",
    )!;
    const b = teamPlan(PLAY_TEAMS[2]!, CATALOG, rows).steps.find(
      (s) => s.id === "signals-in-crm-with-decay",
    )!;
    expect(a.enabled).toBe(true);
    expect([a.enabled, a.label]).toEqual([b.enabled, b.label]);
    const real = CATALOG.find((c) => c.id === a.id)!;
    expect(a).toMatchObject(describePlay(real, rows.get(a.id)));
  });
  it("counts the summary from the rows, and from defaultEnabled with no rows", () => {
    const t = PLAY_TEAMS[3]!;
    expect(teamPlan(t, CATALOG, new Map()).summary).toEqual({
      available: 1,
      total: 2,
      enabled: t.plays.filter((i) => CATALOG.find((c) => c.id === i)!.defaultEnabled).length,
    });
    const rows = new Map([["call-transcript-signal-extraction", { enabled: true }]]);
    expect(teamPlan(t, CATALOG, rows).summary).toEqual({ available: 1, total: 2, enabled: 1 });
    const off = new Map(t.plays.map((i) => [i, { enabled: false }]));
    expect(teamPlan(t, CATALOG, off).summary.enabled).toBe(0);
  });
  it("lists in sharedWith the titles of the other teams, computed from PLAY_TEAMS", () => {
    const sig = (i: number) =>
      teamPlan(PLAY_TEAMS[i]!, CATALOG, new Map()).steps.find(
        (s) => s.id === "signals-in-crm-with-decay",
      )!.sharedWith;
    expect(sig(1)).toEqual(["Señales de cuenta"]);
    expect(sig(2)).toEqual(["Reactivar perdidos"]);
    const own = teamPlan(PLAY_TEAMS[0]!, CATALOG, new Map());
    for (const s of [...own.steps, ...own.unavailable]) expect(s.sharedWith).toEqual([]);
  });
});

describe("teams.ts has no outputs of its own and no I/O (CA-6, G-2)", () => {
  it("a team has no outputs or action; the outputs of its plays are inside OUTPUTS", () => {
    for (const t of PLAY_TEAMS) {
      expect(Object.keys(t).sort(), t.id).toEqual(["id", "plays", "task", "title"]);
      for (const i of t.plays)
        for (const o of CATALOG.find((c) => c.id === i)!.outputs)
          expect(OUTPUTS as readonly string[], `${t.id}/${i}`).toContain(o);
    }
  });
  it("does not import the Supabase client, play_states or a server function (source guard)", () => {
    const src = readFileSync(path.resolve(__dirname, "teams.ts"), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
    for (const l of imports) expect(l).not.toMatch(/supabase|\.functions|\.server|@tanstack/);
    expect(src).not.toMatch(/play_states|supabase|\.from\(|\.insert\(|\.upsert\(|\.update\(/);
  });
});

describe("words of the view (CA-15 text part, §9)", () => {
  it("builds the §9 sentences", () => {
    expect(summaryWord({ available: 2, total: 3, enabled: 2 })).toBe(
      "2 de 3 plays disponibles · 2 activados",
    );
    expect(summaryWord({ available: 1, total: 2, enabled: 1 })).toBe(
      "1 de 2 plays disponibles · 1 activado",
    );
    expect(summaryWord({ available: 0, total: 2, enabled: 0 })).toBe(
      "0 de 2 plays disponibles · 0 activados",
    );
    expect(stepWord(2)).toBe("Paso 2");
    expect(unavailableWord("x")).toBe("No disponible: x");
    expect(sharedWord(["A", "B"])).toBe("También en: A, B");
    expect(TEAMS_INTRO).toMatch(/^Un equipo de plays agrupa/);
  });
  it("no capitalised «Equipo» outside «equipo de plays», and no «agente» (screen and agent words)", () => {
    const texts = [
      TEAMS_INTRO,
      stepWord(1),
      unavailableWord("motivo"),
      sharedWord(["Reuniones"]),
      summaryWord({ available: 1, total: 2, enabled: 1 }),
      ...PLAY_TEAMS.flatMap((t) => [t.title, t.task]),
    ];
    for (const t of texts) {
      expect(t, t).not.toMatch(/\bEquipos?\b(?! de plays)/);
      expect(t, t).not.toMatch(/\bagentes?\b/i);
    }
  });
});
