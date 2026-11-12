import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, type Play } from "./catalog";
import {
  activationPlan,
  BOTTLENECK_WORD,
  MAX_PROPOSED_TEAMS,
  PLAYS_DIAGNOSIS_DETECTOR,
  TEAM_IDS,
  partitionPlanSuggestions,
  playDiagnosisText,
  prioritizeTeams,
  type DiagnosisAnswers,
  type DiagnosisResult,
  type DiagnosisStatus,
} from "./diagnosis";
import { recommendablePlays } from "./recommend";
import { PLAY_TEAMS, teamPlan, type PlayTeam } from "./teams";
import { blockingMissing } from "@/lib/onboarding";

// SDD-20261112-diagnosis-in-chat U-1 (CA-1 to CA-7, CA-19 of the module). Pure rules: the status, the plans and the recommendable order are
// inputs. Real-catalogue cases are the scenarios of section 13; made-up catalogues check the rules without depending on the catalogue.

const status = (o: Partial<DiagnosisStatus> = {}, motion: string | null = "inside_sales") =>
  ({
    ready: true,
    missing: [],
    diagnosis: {
      archetype: "B",
      name: "B2B mid-market / híbrido",
      motion,
      stage: "early",
      nextStep: null,
    },
    strategy: { positioning: true, icp: true, segments: true },
    ...o,
  }) as DiagnosisStatus;
const answers = (o: Partial<DiagnosisAnswers> = {}): DiagnosisAnswers => ({
  bottleneck: null,
  wanted: [],
  ...o,
});
const realOrder = recommendablePlays(CATALOG).recommended.map((p) => p.id);
const rowsOf = (enabled: Record<string, boolean> = {}) =>
  new Map(Object.entries(enabled).map(([id, e]) => [id, { enabled: e }]));
/** The real catalogue and teams, with the given rows. */
const realPlans = (enabled: Record<string, boolean> = {}) =>
  PLAY_TEAMS.map((t) => teamPlan(t, CATALOG, rowsOf(enabled)));
const run = (s: DiagnosisStatus, a: DiagnosisAnswers, enabled: Record<string, boolean> = {}) =>
  prioritizeTeams({ status: s, plans: realPlans(enabled), answers: a, order: realOrder });
const ready = (r: DiagnosisResult) => {
  if (!r.ready) throw new Error("expected a ready result");
  return r;
};

// Made-up catalogue: the team ids are real (the fit rule names entrantes-y-producto) and the plays are invented.
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
  title: PLAY_TEAMS.find((t) => t.id === id)!.title,
  task: `Tarea de ${id}`,
  plays,
});
function custom(
  catalog: Play[],
  teams: PlayTeam[],
  s: DiagnosisStatus,
  a: DiagnosisAnswers,
  enabled: Record<string, boolean> = {},
) {
  const plans = teams.map((t) => teamPlan(t, catalog, rowsOf(enabled), teams));
  const order = recommendablePlays(catalog).recommended.map((p) => p.id);
  return prioritizeTeams({ status: s, plans, answers: a, order });
}
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("constants", () => {
  it("TEAM_IDS are the ids of PLAY_TEAMS, the limit is 3 and the detector is plays_diagnosis", () => {
    expect(TEAM_IDS).toEqual(PLAY_TEAMS.map((t) => t.id));
    expect(MAX_PROPOSED_TEAMS).toBe(3);
    expect(PLAYS_DIAGNOSIS_DETECTOR).toBe("plays_diagnosis");
  });

  it("BOTTLENECK_WORD has the six options of section 9, one per team, in the team order", () => {
    expect(Object.keys(BOTTLENECK_WORD)).toEqual(TEAM_IDS);
    expect(BOTTLENECK_WORD).toEqual({
      reuniones: "Llego a las reuniones sin preparar o se quedan sin seguimiento.",
      "reactivar-perdidos": "Perdemos deals y no volvemos a ellos.",
      "senales-de-cuenta": "No sé qué cuentas se están moviendo.",
      "aprender-de-llamadas": "No sé qué dolores repiten los clientes en las llamadas.",
      "priorizar-cuentas-y-crm": "No sé a qué cuentas dedicar tiempo o no me fío del CRM.",
      "entrantes-y-producto": "Los registros y los leads entrantes se enfrían.",
    });
  });
});

describe("prioritizeTeams: a company that is not ready (CA-1)", () => {
  it("returns exactly ready false and the blocking missing, nothing else", () => {
    const s = status({
      ready: false,
      missing: ["Diagnóstico GTM sin hacer", "ICP sin completar", "Segmentos sin rango de ACV"],
      diagnosis: null,
    });
    const r = run(s, answers({ bottleneck: "reuniones" }));
    expect(r).toEqual({
      ready: false,
      missing: ["Diagnóstico GTM sin hacer", "ICP sin completar"],
    });
    expect(Object.keys(r).sort()).toEqual(["missing", "ready"]);
  });

  it("blockingMissing drops only the segments piece, and companyOnboardingStatus-style missing keeps its order", () => {
    expect(blockingMissing({ missing: ["Segmentos sin rango de ACV"] })).toEqual([]);
    expect(
      blockingMissing({ missing: ["Posicionamiento sin completar", "Segmentos sin rango de ACV"] }),
    ).toEqual(["Posicionamiento sin completar"]);
    expect(blockingMissing({ missing: [] })).toEqual([]);
  });

  it("with only the segments missing, ready is true and it proposes as usual", () => {
    const r = ready(run(status({ missing: ["Segmentos sin rango de ACV"] }), answers()));
    expect(r.proposed.length).toBeGreaterThan(0);
  });
});

describe("prioritizeTeams: only what can be recommended (CA-2)", () => {
  it("a team with no steps goes to notAvailable with the reason of teamPlan, also if it is the bottleneck or wanted", () => {
    const catalog = [
      play("blk", { status: "bloqueado", blockedBy: "proveedor_datos", title: "Bloqueado" }),
      play("ok"),
    ];
    const teams = [team("reuniones", ["blk"]), team("reactivar-perdidos", ["ok"])];
    const reasonFromTeamPlan = teamPlan(teams[0]!, catalog).unavailable[0]!.reason;
    expect(reasonFromTeamPlan).toBe("falta un proveedor de datos");
    for (const a of [
      answers(),
      answers({ bottleneck: "reuniones" }),
      answers({ wanted: ["reuniones"] }),
    ]) {
      const r = ready(custom(catalog, teams, status(), a));
      expect(r.notAvailable).toEqual([
        {
          id: "reuniones",
          title: "Reuniones",
          reason: "Ningún play disponible todavía: falta un proveedor de datos.",
        },
      ]);
      expect(ids(r.proposed)).toEqual(["reactivar-perdidos"]);
    }
  });

  it("never proposes or plans a blocked, a planned or a play that depends on a planned one", () => {
    const catalog = [
      play("blk", { status: "bloqueado", blockedBy: "linkedin_d2" }),
      play("pln", { status: "planificado" }),
      play("dep", { dependsOn: ["pln"] }),
      play("ok"),
    ];
    const teams = [
      team("reuniones", ["blk", "pln", "dep"]),
      team("reactivar-perdidos", ["ok", "dep", "pln"]),
    ];
    const r = ready(custom(catalog, teams, status(), answers({ bottleneck: "reuniones" })));
    expect(ids(r.proposed)).toEqual(["reactivar-perdidos"]);
    expect(r.proposed.map((p) => p.next)).toEqual(["ok"]);
    expect(ids(r.notAvailable)).toEqual(["reuniones"]);
  });

  it("the reason is copied from the first unavailable play of teamPlan, not written here", () => {
    const catalog = [
      play("pln", { status: "planificado" }),
      play("dep", { dependsOn: ["pln"], title: "Hija" }),
    ];
    const teams = [team("reuniones", ["pln", "dep"])];
    const plan = teamPlan(teams[0]!, catalog, rowsOf(), teams);
    const r = ready(custom(catalog, teams, status(), answers()));
    expect(r.notAvailable[0]!.reason).toBe(
      `Ningún play disponible todavía: ${plan.unavailable[0]!.reason}.`,
    );
  });
});

describe("prioritizeTeams: the order (CA-3)", () => {
  it("sorts by bottleneck, then wanted, then fit, then phase of next, then the order of PLAY_TEAMS", () => {
    // Four teams, all with one disabled play; the phase of each next decides the last two keys.
    const catalog = [
      play("p-gen", { phase: "generacion" }),
      play("p-fund", { phase: "fundacion" }),
      play("p-cap", { phase: "captura" }),
      play("p-cap2", { phase: "captura" }),
    ];
    const teams = [
      team("reuniones", ["p-gen"]),
      team("reactivar-perdidos", ["p-fund"]),
      team("senales-de-cuenta", ["p-cap"]),
      team("aprender-de-llamadas", ["p-cap2"]),
    ];
    const big = (a: DiagnosisAnswers) => {
      const plans = teams.map((t) => teamPlan(t, catalog, rowsOf(), teams));
      const order = recommendablePlays(catalog).recommended.map((p) => p.id);
      const r = ready(prioritizeTeams({ status: status(), plans, answers: a, order, max: 9 }));
      return ids(r.proposed);
    };
    expect(big(answers())).toEqual([
      "reactivar-perdidos",
      "senales-de-cuenta",
      "aprender-de-llamadas",
      "reuniones",
    ]);
    // wanted beats phase; bottleneck beats wanted.
    expect(big(answers({ wanted: ["reuniones"] }))[0]).toBe("reuniones");
    expect(
      big(answers({ wanted: ["reuniones"], bottleneck: "aprender-de-llamadas" })).slice(0, 2),
    ).toEqual(["aprender-de-llamadas", "reuniones"]);
  });

  it("fit: entrantes-y-producto goes before the phase rule only for a plg archetype", () => {
    const catalog = [play("a", { phase: "fundacion" }), play("b", { phase: "generacion" })];
    const teams = [team("reuniones", ["a"]), team("entrantes-y-producto", ["b"])];
    const plg = ready(custom(catalog, teams, status({}, "plg"), answers()));
    expect(ids(plg.proposed)).toEqual(["entrantes-y-producto", "reuniones"]);
    expect(plg.proposed[0]!.reasons).toContain(
      `Encaja con tu arquetipo (${ARCHETYPE_NAME}): vendes con producto.`,
    );
  });

  it("a not usual team (entrantes-y-producto without plg) never goes to proposed, even with free slots, and says why", () => {
    const catalog = [play("a"), play("b")];
    const teams = [team("reuniones", ["a"]), team("entrantes-y-producto", ["b"])];
    const r = ready(custom(catalog, teams, status(), answers()));
    expect(ids(r.proposed)).toEqual(["reuniones"]);
    expect(r.later).toEqual([
      {
        id: "entrantes-y-producto",
        title: "Entrantes y producto",
        reason:
          "No es lo habitual para tu arquetipo (B2B mid-market / híbrido); dímelo si lo quieres.",
      },
    ]);
    const noName = ready(
      custom(
        catalog,
        teams,
        status({
          diagnosis: {
            archetype: "B",
            name: null,
            motion: "inside_sales",
            stage: null,
            nextStep: null,
          },
        }),
        answers(),
      ),
    );
    expect(noName.later[0]!.reason).toBe(
      "No es lo habitual para tu arquetipo; dímelo si lo quieres.",
    );
  });

  it("a not usual team is proposed when it is the bottleneck or wanted", () => {
    const catalog = [play("a"), play("b")];
    const teams = [team("reuniones", ["a"]), team("entrantes-y-producto", ["b"])];
    for (const a of [
      answers({ bottleneck: "entrantes-y-producto" }),
      answers({ wanted: ["entrantes-y-producto"] }),
    ]) {
      const r = ready(custom(catalog, teams, status(), a));
      expect(ids(r.proposed)).toEqual(["entrantes-y-producto", "reuniones"]);
    }
  });

  it("with the motion unknown (null) it is not a product archetype", () => {
    const catalog = [play("a"), play("b")];
    const teams = [team("reuniones", ["a"]), team("entrantes-y-producto", ["b"])];
    const r = ready(custom(catalog, teams, status({}, null), answers()));
    expect(ids(r.proposed)).toEqual(["reuniones"]);
  });

  it("the result is the same with wanted in any order and with duplicates, and twice the same input gives equal results", () => {
    const a1 = answers({
      bottleneck: "reuniones",
      wanted: ["senales-de-cuenta", "entrantes-y-producto"],
    });
    const a2 = answers({
      bottleneck: "reuniones",
      wanted: [
        "entrantes-y-producto",
        "senales-de-cuenta",
        "senales-de-cuenta",
        "entrantes-y-producto",
      ],
    });
    expect(ready(run(status(), a1)).proposed.length).toBe(3);
    expect(run(status(), a2)).toEqual(run(status(), a1));
    expect(run(status(), a1)).toEqual(run(status(), a1));
  });

  it("does not mutate its inputs", () => {
    const plans = realPlans();
    const before = JSON.stringify(plans);
    const a = answers({ wanted: ["reuniones", "reuniones"] });
    prioritizeTeams({ status: status(), plans, answers: a, order: realOrder });
    expect(JSON.stringify(plans)).toBe(before);
    expect(a.wanted).toEqual(["reuniones", "reuniones"]);
  });

  it("candidates are the teams with a step not enabled: next is the first such step in the team order", () => {
    const catalog = [play("first", { dependsOn: [] }), play("second", { dependsOn: ["first"] })];
    const teams = [team("reuniones", ["first", "second"])];
    const r = ready(custom(catalog, teams, status(), answers(), { first: true }));
    expect(r.proposed[0]!.next).toBe("second");
  });

  describe("section 13 scenarios on the real catalogue and no rows", () => {
    it("A: archetype B (inside_sales), no bottleneck, nothing wanted", () => {
      const r = ready(run(status(), answers()));
      expect(r.proposed.map((p) => [p.rank, p.id, p.next])).toEqual([
        [1, "priorizar-cuentas-y-crm", "hubspot-account-tiering-scoring"],
        [2, "reactivar-perdidos", "signals-in-crm-with-decay"],
        [3, "senales-de-cuenta", "signals-in-crm-with-decay"],
      ]);
      expect(ids(r.later)).toEqual(["aprender-de-llamadas", "entrantes-y-producto"]);
      expect(ids(r.alreadyActive)).toEqual(["reuniones"]);
      expect(r.notAvailable).toEqual([]);
    });

    it("B: archetype A (plg), bottleneck aprender-de-llamadas", () => {
      const r = ready(run(status({}, "plg"), answers({ bottleneck: "aprender-de-llamadas" })));
      expect(r.proposed.map((p) => [p.rank, p.id, p.next])).toEqual([
        [1, "aprender-de-llamadas", "call-transcript-signal-extraction"],
        [2, "entrantes-y-producto", "product-sign-up-outreach"],
        [3, "priorizar-cuentas-y-crm", "hubspot-account-tiering-scoring"],
      ]);
      expect(ids(r.later)).toEqual(["reactivar-perdidos", "senales-de-cuenta"]);
      expect(ids(r.alreadyActive)).toEqual(["reuniones"]);
    });

    it("C: archetype C (field_sales), bottleneck reuniones, entrantes-y-producto wanted", () => {
      const r = ready(
        run(
          status({}, "field_sales"),
          answers({ bottleneck: "reuniones", wanted: ["entrantes-y-producto"] }),
        ),
      );
      expect(r.proposed.map((p) => [p.rank, p.id, p.next])).toEqual([
        [1, "entrantes-y-producto", "product-sign-up-outreach"],
        [2, "priorizar-cuentas-y-crm", "hubspot-account-tiering-scoring"],
        [3, "reactivar-perdidos", "signals-in-crm-with-decay"],
      ]);
      expect(ids(r.later)).toEqual(["senales-de-cuenta", "aprender-de-llamadas"]);
      expect(r.alreadyActive).toEqual([
        {
          id: "reuniones",
          title: "Reuniones",
          reason: "Es tu cuello de botella, pero todos sus plays disponibles ya están activados.",
        },
      ]);
    });
  });
});

describe("prioritizeTeams: at most three (CA-4)", () => {
  const six = () => {
    const catalog = ["a", "b", "c", "d", "e"].map((id, i) =>
      play(id, {
        phase: (["fundacion", "captura", "captura", "generacion", "generacion"] as const)[i]!,
      }),
    );
    const teams = [
      team("reuniones", ["a"]),
      team("reactivar-perdidos", ["b"]),
      team("senales-de-cuenta", ["c"]),
      team("aprender-de-llamadas", ["d"]),
      team("priorizar-cuentas-y-crm", ["e"]),
    ];
    return { catalog, teams };
  };

  it("proposes the first three with rank from 1; the rest go to later in the same order with the limit reason", () => {
    const { catalog, teams } = six();
    const r = ready(custom(catalog, teams, status(), answers()));
    expect(r.proposed.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(ids(r.proposed)).toEqual(["reuniones", "reactivar-perdidos", "senales-de-cuenta"]);
    expect(r.later).toEqual([
      {
        id: "aprender-de-llamadas",
        title: "Aprender de llamadas",
        reason: "Lo dejamos para después: como mucho 3 equipos de plays a la vez.",
      },
      {
        id: "priorizar-cuentas-y-crm",
        title: "Priorizar cuentas y limpiar CRM",
        reason: "Lo dejamos para después: como mucho 3 equipos de plays a la vez.",
      },
    ]);
  });

  it("with fewer than three candidates it proposes them all", () => {
    const { catalog, teams } = six();
    const r = ready(custom(catalog, teams.slice(0, 2), status(), answers()));
    expect(r.proposed.map((p) => p.rank)).toEqual([1, 2]);
    expect(r.later).toEqual([]);
  });
});

describe("prioritizeTeams: already active (CA-5)", () => {
  it("a team with every step enabled goes to alreadyActive, never to proposed", () => {
    const catalog = [play("a"), play("b")];
    const teams = [team("reuniones", ["a"]), team("reactivar-perdidos", ["b"])];
    const r = ready(custom(catalog, teams, status(), answers(), { a: true }));
    expect(r.alreadyActive).toEqual([
      {
        id: "reuniones",
        title: "Reuniones",
        reason: "Todos sus plays disponibles ya están activados.",
      },
    ]);
    expect(ids(r.proposed)).toEqual(["reactivar-perdidos"]);
  });

  it("a bottleneck that is already active says so and is not proposed", () => {
    const catalog = [play("a"), play("b")];
    const teams = [team("reuniones", ["a"]), team("reactivar-perdidos", ["b"])];
    const r = ready(
      custom(catalog, teams, status(), answers({ bottleneck: "reuniones" }), { a: true }),
    );
    expect(r.alreadyActive[0]!.reason).toBe(
      "Es tu cuello de botella, pero todos sus plays disponibles ya están activados.",
    );
    expect(ids(r.proposed)).toEqual(["reactivar-perdidos"]);
  });

  it("with the real catalogue and no rows, Reuniones is already active", () => {
    expect(ids(ready(run(status(), answers())).alreadyActive)).toEqual(["reuniones"]);
  });

  it("when every team is active, proposed and activation are empty", () => {
    const enabled = Object.fromEntries(CATALOG.map((p) => [p.id, true]));
    const r = ready(run(status({}, "plg"), answers(), enabled));
    expect(r.proposed).toEqual([]);
    expect(r.activation).toEqual([]);
    expect(r.alreadyActive.length).toBeGreaterThan(0);
  });
});

describe("activationPlan (CA-6)", () => {
  const steps = (r: DiagnosisResult) =>
    ready(r).activation.map((a) => [a.n, a.play_id, a.teams] as const);

  it("(a) section 13 scenarios: by phase and dependencies, shared plays once, teams in rank order", () => {
    expect(steps(run(status(), answers()))).toEqual([
      [1, "hubspot-account-tiering-scoring", ["Priorizar cuentas y limpiar CRM"]],
      [2, "signals-in-crm-with-decay", ["Reactivar perdidos", "Señales de cuenta"]],
      [3, "closed-lost-revival", ["Reactivar perdidos"]],
    ]);
    expect(steps(run(status({}, "plg"), answers({ bottleneck: "aprender-de-llamadas" })))).toEqual([
      [1, "hubspot-account-tiering-scoring", ["Priorizar cuentas y limpiar CRM"]],
      [2, "call-transcript-signal-extraction", ["Aprender de llamadas"]],
      [3, "product-sign-up-outreach", ["Entrantes y producto"]],
    ]);
    expect(
      steps(
        run(
          status({}, "field_sales"),
          answers({ bottleneck: "reuniones", wanted: ["entrantes-y-producto"] }),
        ),
      ),
    ).toEqual([
      [1, "hubspot-account-tiering-scoring", ["Priorizar cuentas y limpiar CRM"]],
      [2, "signals-in-crm-with-decay", ["Reactivar perdidos"]],
      [3, "closed-lost-revival", ["Reactivar perdidos"]],
      [4, "product-sign-up-outreach", ["Entrantes y producto"]],
    ]);
  });

  it("every entry carries the title of the play, not its id", () => {
    const r = ready(run(status(), answers()));
    expect(r.activation[1]!.title).toBe("Señales en el CRM con caída en el tiempo");
    for (const a of r.activation)
      expect(a.title).toBe(CATALOG.find((p) => p.id === a.play_id)!.title);
  });

  it("(b) the rank of the team does not decide: a generation play of rank 1 goes after a foundation play of rank 2", () => {
    const catalog = [play("gen", { phase: "generacion" }), play("fund", { phase: "fundacion" })];
    const teams = [team("reuniones", ["gen"]), team("reactivar-perdidos", ["fund"])];
    const r = ready(custom(catalog, teams, status(), answers({ bottleneck: "reuniones" })));
    expect(ids(r.proposed)).toEqual(["reuniones", "reactivar-perdidos"]);
    expect(r.activation.map((a) => [a.n, a.play_id])).toEqual([
      [1, "fund"],
      [2, "gen"],
    ]);
  });

  it("(c) a play that depends on another of its own phase goes after it, even if the catalogue lists it first", () => {
    const catalog = [
      play("child", { phase: "captura", dependsOn: ["parent"] }),
      play("parent", { phase: "captura" }),
    ];
    const teams = [team("reuniones", ["child"]), team("reactivar-perdidos", ["parent"])];
    const r = ready(custom(catalog, teams, status(), answers({ bottleneck: "reuniones" })));
    expect(r.activation.map((a) => a.play_id)).toEqual(["parent", "child"]);
  });

  it("only plays that are not enabled enter, and a play that is not in the order cannot appear", () => {
    const catalog = [play("on"), play("off"), play("ghost")];
    const teams = [team("reuniones", ["on", "off", "ghost"])];
    const plans = teams.map((t) => teamPlan(t, catalog, rowsOf({ on: true }), teams));
    const proposed = ready(
      prioritizeTeams({ status: status(), plans, answers: answers(), order: ["on", "off"] }),
    ).proposed;
    const plan = activationPlan({ proposed, plans, order: ["on", "off"] });
    expect(plan.map((a) => a.play_id)).toEqual(["off"]);
  });

  it("with no proposed team there is nothing to activate", () => {
    expect(activationPlan({ proposed: [], plans: realPlans(), order: realOrder })).toEqual([]);
  });

  it("takes plays only from the proposed teams, not from later ones", () => {
    const r = ready(run(status(), answers()));
    const proposedPlays = new Set(
      realPlans()
        .filter((p) => ids(r.proposed).includes(p.id))
        .flatMap((p) => p.steps.map((s) => s.id)),
    );
    for (const a of r.activation) expect(proposedPlays.has(a.play_id)).toBe(true);
    expect(r.activation.map((a) => a.play_id)).not.toContain("call-transcript-signal-extraction");
  });
});

const VOZ = { ok: true, ejemplos: 3, faltan: 0 } as const;
const REGLAS = { ok: true, faltan: [] as string[] } as const;
const text = (r: DiagnosisResult, o: Partial<Parameters<typeof playDiagnosisText>[1]> = {}) =>
  playDiagnosisText(r, { voz: VOZ, reglas: REGLAS, canAct: true, ...o });
const scenarios = () => [
  run(status(), answers()),
  run(status({}, "plg"), answers({ bottleneck: "aprender-de-llamadas" })),
  run(
    status({}, "field_sales"),
    answers({ bottleneck: "reuniones", wanted: ["entrantes-y-producto"] }),
  ),
  run(status({}, "plg"), answers({ wanted: ["reuniones", "senales-de-cuenta"] })),
];

const ARCHETYPE_NAME = "B2B mid-market / híbrido";

describe("reasons and texts (CA-7)", () => {
  it("every reason is one of the fixed sentences of section 9 and has no figures", () => {
    const fixed = [
      /^Es tu cuello de botella\.$/,
      /^Lo has elegido tú\.$/,
      /^Encaja con tu arquetipo \(.+\): vendes con producto\.$/,
      /^Empieza por «.+», de la fase (Fundación|Captura|Generación|Orquestación)\.$/,
      /^Activar «.+» también avanza «.+»\.$/,
    ];
    for (const r of scenarios()) {
      for (const t of ready(r).proposed) {
        expect(t.reasons.length).toBeGreaterThan(0);
        for (const reason of t.reasons) {
          expect(
            fixed.some((re) => re.test(reason)),
            reason,
          ).toBe(true);
          // The archetype name is data («B2B…»), not a figure of the rule: it is taken out before looking for digits.
          expect(reason.replace(ARCHETYPE_NAME, "")).not.toMatch(/\d/);
        }
      }
    }
  });

  it("builds the reasons of a team in order: bottleneck, chosen, fit, where it starts, what else it moves", () => {
    const r = ready(
      run(
        status({}, "plg"),
        answers({ bottleneck: "entrantes-y-producto", wanted: ["entrantes-y-producto"] }),
      ),
    );
    expect(r.proposed[0]!.reasons).toEqual([
      "Es tu cuello de botella.",
      "Lo has elegido tú.",
      `Encaja con tu arquetipo (${ARCHETYPE_NAME}): vendes con producto.`,
      "Empieza por «Contacto a cada registro de producto», de la fase Generación.",
    ]);
  });

  it("names the play with its catalogue title in «Empieza por» and «Activar … también avanza …»", () => {
    const r = ready(run(status(), answers()));
    const reactivar = r.proposed.find((t) => t.id === "reactivar-perdidos")!;
    expect(reactivar.reasons).toEqual([
      "Empieza por «Señales en el CRM con caída en el tiempo», de la fase Captura.",
      "Activar «Señales en el CRM con caída en el tiempo» también avanza «Señales de cuenta».",
    ]);
  });

  it("without an archetype name the fit reason has no empty parentheses", () => {
    const s = status({
      diagnosis: { archetype: "A", name: null, motion: "plg", stage: null, nextStep: null },
    });
    const r = ready(run(s, answers({ bottleneck: "entrantes-y-producto" })));
    expect(r.proposed[0]!.reasons).toContain("Encaja con tu arquetipo: vendes con producto.");
    for (const reason of r.proposed.flatMap((t) => t.reasons)) expect(reason).not.toContain("()");
  });

  it("is pure: the source imports no Supabase client, ai-gateway, agent.server, toggle or server function", () => {
    const src = readFileSync(path.resolve(__dirname, "diagnosis.ts"), "utf8");
    const specifiers = [...src.matchAll(/^import[^;]*?from\s+["']([^"']+)["']/gm)].map(
      (m) => m[1]!,
    );
    expect(specifiers.length).toBeGreaterThan(0);
    for (const s of specifiers)
      expect(s).not.toMatch(/supabase|ai-gateway|agent\.server|toggle|\.functions|\.server/);
    expect(src).not.toMatch(
      /play_states|supabase|\.from\(|\.insert\(|\.upsert\(|\.update\(|\bfetch\(/,
    );
  });
});

describe("playDiagnosisText (section 9)", () => {
  it("a company that is not ready: what is missing, joined by «; », and where to fix it, with no team or play title", () => {
    const r = run(
      status({
        ready: false,
        missing: ["Diagnóstico GTM sin hacer", "ICP sin completar", "Segmentos sin rango de ACV"],
        diagnosis: null,
      }),
      answers({ bottleneck: "reuniones" }),
    );
    const out = text(r);
    expect(out).toBe(
      "Todavía no puedo proponerte equipos de plays. Falta: Diagnóstico GTM sin hacer; ICP sin completar. /onboarding para el diagnóstico GTM y /setup para posicionamiento e ICP.",
    );
    for (const t of PLAY_TEAMS) expect(out).not.toContain(t.title);
    for (const p of CATALOG) expect(out).not.toContain(p.title);
    expect(out).not.toContain("Segmentos");
  });

  it("points only to the screen that fixes what is missing", () => {
    const onlyGtm = text({ ready: false, missing: ["Diagnóstico GTM sin hacer"] });
    expect(onlyGtm).toContain("/onboarding");
    expect(onlyGtm).not.toContain("/setup");
    const onlySetup = text({ ready: false, missing: ["Posicionamiento sin completar"] });
    expect(onlySetup).toContain("/setup");
    expect(onlySetup).not.toContain("/onboarding");
  });

  it("scenario A, owner: header, teams with task and reasons, plan, the rest, voice, rules and closing", () => {
    const out = text(run(status(), answers()), {
      voz: { ok: true, ejemplos: 1, faltan: 2 },
      reglas: { ok: true, faltan: ["a", "b", "c"] },
    });
    expect(out).toBe(
      [
        "Te propongo empezar por estos equipos de plays, en este orden:",
        "1. Priorizar cuentas y limpiar CRM: Decidir a qué cuentas dedicar tiempo y tener un CRM del que fiarte. Empieza por «Tiering y puntuación de cuentas», de la fase Fundación.",
        "2. Reactivar perdidos: Volver a los deals perdidos cuando algo ha cambiado de verdad en la cuenta. Empieza por «Señales en el CRM con caída en el tiempo», de la fase Captura. Activar «Señales en el CRM con caída en el tiempo» también avanza «Señales de cuenta».",
        "3. Señales de cuenta: Saber qué cuentas se mueven y actuar antes de que la señal se enfríe. Empieza por «Señales en el CRM con caída en el tiempo», de la fase Captura. Activar «Señales en el CRM con caída en el tiempo» también avanza «Reactivar perdidos».",
        "",
        "Plan de activación, por fase y dependencias:",
        "1. Tiering y puntuación de cuentas (Priorizar cuentas y limpiar CRM)",
        "2. Señales en el CRM con caída en el tiempo (Reactivar perdidos, Señales de cuenta)",
        "3. Reactivación de deals perdidos (Reactivar perdidos)",
        "",
        "Para después:",
        "Aprender de llamadas: Lo dejamos para después: como mucho 3 equipos de plays a la vez.",
        "Entrantes y producto: No es lo habitual para tu arquetipo (B2B mid-market / híbrido); dímelo si lo quieres.",
        "",
        "Ya activos:",
        "Reuniones: Todos sus plays disponibles ya están activados.",
        "",
        "Tienes 1 de 3 mensajes de voz. Añade los que faltan en Conocimiento › Voz; no los pegues en el chat.",
        "Te faltan 3 reglas base; puedo añadirlas si me lo confirmas.",
        "Nada se activa solo: te dejo cada play como sugerencia y lo activas al aprobarla.",
      ].join("\n"),
    );
  });

  it("a role that cannot act: rules and closing do not promise actions", () => {
    const out = text(run(status(), answers()), {
      reglas: { ok: true, faltan: ["a", "b"] },
      canAct: false,
    });
    expect(out).toContain(
      "Te faltan 2 reglas base; pídele a tu Owner o Sales Leader que las añada.",
    );
    expect(out).toContain(
      "Nada se activa solo: un Owner o un Sales Leader activa cada play al aprobar su sugerencia.",
    );
    expect(out).not.toContain("puedo añadirlas");
    expect(out).not.toContain("te dejo cada play como sugerencia");
  });

  it("voice and rules: complete, and failed reads say so instead of showing zero", () => {
    const base = run(status(), answers());
    expect(text(base)).toContain("Tu voz está completa.");
    expect(text(base)).toContain("Ya tienes las reglas base.");
    const failed = text(base, { voz: { ok: false }, reglas: { ok: false } });
    expect(failed).toContain("No he podido comprobar la voz de tu empresa.");
    expect(failed).toContain("No he podido comprobar tus reglas.");
    expect(failed).not.toMatch(/Tienes \d+ de/);
    expect(failed).not.toContain("Te faltan");
  });

  it("when every team is active it says so and offers no plan, no closing", () => {
    const enabled = Object.fromEntries(CATALOG.map((p) => [p.id, true]));
    const out = text(run(status({}, "plg"), answers(), enabled));
    expect(out).toContain(
      "Ya tienes activados todos los plays disponibles de los equipos de plays.",
    );
    expect(out).not.toContain("Te propongo");
    expect(out).not.toContain("Plan de activación");
    expect(out).not.toContain("Nada se activa solo");
  });

  it("omits the sections that have no elements", () => {
    const catalog = [play("a")];
    const teams = [team("reuniones", ["a"])];
    const out = text(custom(catalog, teams, status(), answers()));
    expect(out).not.toContain("Para después:");
    expect(out).not.toContain("Ya activos:");
    expect(out).not.toContain("No disponibles todavía:");
  });

  it("lists the teams without available plays with their reason", () => {
    const catalog = [
      play("blk", { status: "bloqueado", blockedBy: "proveedor_datos" }),
      play("ok"),
    ];
    const teams = [team("reuniones", ["blk"]), team("reactivar-perdidos", ["ok"])];
    const out = text(custom(catalog, teams, status(), answers()));
    expect(out).toContain(
      "No disponibles todavía:\nReuniones: Ningún play disponible todavía: falta un proveedor de datos.",
    );
  });

  it("never shows voice text or rule bodies: only counts and the titles it is given", () => {
    const out = text(run(status(), answers()), {
      voz: { ok: true, ejemplos: 2, faltan: 1 },
      reglas: { ok: true, faltan: ["Titulo A"] },
    });
    expect(out).not.toContain("Titulo A");
    expect(out).toContain("Tienes 2 de 3");
  });
});

describe("words (CA-19, module part)", () => {
  const sources = () => {
    const out: string[] = [readFileSync(path.resolve(__dirname, "diagnosis.ts"), "utf8")];
    for (const r of scenarios()) {
      const x = ready(r);
      out.push(
        text(r),
        text(r, { canAct: false }),
        text(r, { voz: { ok: false }, reglas: { ok: false } }),
      );
      out.push(...x.proposed.flatMap((t) => t.reasons), ...x.later.map((n) => n.reason));
      out.push(...x.alreadyActive.map((n) => n.reason), ...x.notAvailable.map((n) => n.reason));
    }
    out.push(text({ ready: false, missing: ["Diagnóstico GTM sin hacer", "ICP sin completar"] }));
    out.push(...Object.values(BOTTLENECK_WORD));
    return out;
  };

  it("never writes «Equipo»/«Equipos» capitalised unless followed by « de plays»", () => {
    for (const s of sources()) expect(s).not.toMatch(/\bEquipos?\b(?! de plays)/);
  });

  it("never calls a team of plays an agent", () => {
    for (const s of sources()) expect(s).not.toMatch(/equipos? de plays[^.]*\bagentes?\b/i);
  });

  it("never uses usted, ustedes, vos or vosotros", () => {
    for (const s of sources()) expect(s).not.toMatch(/\b(usted|ustedes|vos|vosotros)\b/i);
  });

  it("the word check has teeth: it catches the forms it forbids", () => {
    expect("Equipo de ventas").toMatch(/\bEquipos?\b(?! de plays)/);
    expect("Los equipos de plays son agentes").toMatch(/equipos? de plays[^.]*\bagentes?\b/i);
    expect("Usted puede").toMatch(/\b(usted|ustedes|vos|vosotros)\b/i);
    expect("activos y motivos").not.toMatch(/\b(usted|ustedes|vos|vosotros)\b/i);
  });
});

describe("partitionPlanSuggestions (internal helper of CA-11: the categories decided by the state read)", () => {
  const ME = "me";
  const OTHER = "other";
  const key = (n: string) => `plays_diagnosis:${n}`;
  const row = (n: string, status: string, user_id: string | null) => ({
    id: `id-${n}`,
    dedupe_key: key(n),
    status,
    user_id,
  });
  const part = (keys: string[], rows: ReturnType<typeof row>[]) =>
    partitionPlanSuggestions({ keys: keys.map(key), rows, userId: ME });

  it("a key with no row is created", () => {
    expect(part(["a"], [])).toEqual({
      create: [key("a")],
      reopen: [],
      ya_abiertas: [],
      de_otra_persona: [],
      pospuestas: [],
      descartadas: [],
    });
  });

  it("approved and resolved rows are reopened, keeping the row id and the status read, whoever owns them", () => {
    const r = part(
      ["a", "b", "c"],
      [row("a", "approved", ME), row("b", "resolved", OTHER), row("c", "approved", null)],
    );
    expect(r.reopen).toEqual([
      { key: key("a"), id: "id-a", status: "approved" },
      { key: key("b"), id: "id-b", status: "resolved" },
      { key: key("c"), id: "id-c", status: "approved" },
    ]);
    expect(r.create).toEqual([]);
  });

  it("pending: yours or without an owner is already open; another person's is only «de otra persona»", () => {
    const r = part(
      ["a", "b", "c"],
      [row("a", "pending", ME), row("b", "pending", null), row("c", "pending", OTHER)],
    );
    expect(r.ya_abiertas).toEqual([key("a"), key("b")]);
    expect(r.de_otra_persona).toEqual([key("c")]);
  });

  it("snoozed is only «pospuestas», whoever owns it, and is never reopened", () => {
    const r = part(["a", "b"], [row("a", "snoozed", ME), row("b", "snoozed", OTHER)]);
    expect(r.pospuestas).toEqual([key("a"), key("b")]);
    expect(r.ya_abiertas).toEqual([]);
    expect(r.de_otra_persona).toEqual([]);
    expect(r.reopen).toEqual([]);
  });

  it("dismissed is «descartadas», whoever owns it, and is never reopened", () => {
    const r = part(["a", "b"], [row("a", "dismissed", ME), row("b", "dismissed", OTHER)]);
    expect(r.descartadas).toEqual([key("a"), key("b")]);
    expect(r.reopen).toEqual([]);
    expect(r.create).toEqual([]);
  });

  it("with every state at once each play is in exactly one category and the sum is the number of keys", () => {
    const names = ["new", "app", "res", "mine", "mate", "snz", "dis"];
    const r = part(names, [
      row("app", "approved", ME),
      row("res", "resolved", ME),
      row("mine", "pending", ME),
      row("mate", "pending", OTHER),
      row("snz", "snoozed", OTHER),
      row("dis", "dismissed", ME),
    ]);
    const all = [
      ...r.create,
      ...r.reopen.map((x) => x.key),
      ...r.ya_abiertas,
      ...r.de_otra_persona,
      ...r.pospuestas,
      ...r.descartadas,
    ];
    expect(all.length).toBe(names.length);
    expect(new Set(all).size).toBe(names.length);
    expect([...all].sort()).toEqual(names.map(key).sort());
  });

  it("ignores rows of keys that are not in the plan, and a repeated key counts once", () => {
    const r = part(["a", "a"], [row("a", "pending", ME), row("zzz", "dismissed", ME)]);
    expect(r.ya_abiertas).toEqual([key("a")]);
    expect(r.descartadas).toEqual([]);
    expect(r.create).toEqual([]);
  });

  it("keeps the order of the keys inside each category", () => {
    const r = part(
      ["c", "a", "b"],
      [row("a", "dismissed", ME), row("b", "dismissed", ME), row("c", "dismissed", ME)],
    );
    expect(r.descartadas).toEqual([key("c"), key("a"), key("b")]);
  });

  it("a status the database cannot hold is not guessed: it throws", () => {
    expect(() => part(["a"], [row("a", "sent", ME)])).toThrow();
  });

  it("an empty plan gives empty categories", () => {
    expect(part([], [row("a", "pending", ME)])).toEqual({
      create: [],
      reopen: [],
      ya_abiertas: [],
      de_otra_persona: [],
      pospuestas: [],
      descartadas: [],
    });
  });
});

// Review of session 1 (NK-0153): defects found by the reviewer and the coordinator's copy decisions, each pinned by a test.
describe("playDiagnosisText: review of session 1", () => {
  it("with nothing proposed and only a not usual team for later, the text starts with «Para después:», not with a blank line", () => {
    // Every play enabled except the one of Entrantes y producto, which is not usual for an inside_sales archetype.
    const enabled = Object.fromEntries(
      CATALOG.filter((p) => p.id !== "product-sign-up-outreach").map((p) => [p.id, true]),
    );
    const r = ready(run(status(), answers(), enabled));
    expect(r.proposed).toEqual([]);
    expect(ids(r.later)).toEqual(["entrantes-y-producto"]);
    const out = text(r);
    expect(out.startsWith("Para después:\nEntrantes y producto: No es lo habitual")).toBe(true);
    // It does not claim every play is active (one is still waiting in «Para después») and invents no header.
    expect(out).not.toContain("Ya tienes activados todos");
    expect(out).not.toContain("Te propongo");
  });

  it("never starts with a line break nor leaves two blank lines in a row", () => {
    const enabled = Object.fromEntries(CATALOG.map((p) => [p.id, true]));
    const all = [
      ...scenarios(),
      run(status(), answers(), enabled),
      run(
        status(),
        answers(),
        Object.fromEntries(
          CATALOG.filter((p) => p.id !== "product-sign-up-outreach").map((p) => [p.id, true]),
        ),
      ),
    ];
    for (const r of all)
      for (const out of [text(r), text(r, { canAct: false, voz: { ok: false } })]) {
        expect(out.startsWith("\n")).toBe(false);
        expect(out).not.toContain("\n\n\n");
      }
  });

  it("«también avanza» is said for every step not enabled, not only the next one, and names teams that are not proposed", () => {
    // Reuniones starts by «a»; «b» comes after it and is shared with Entrantes y producto, which goes to later (not usual).
    const catalog = [play("a"), play("b")];
    const teams = [team("reuniones", ["a", "b"]), team("entrantes-y-producto", ["b"])];
    const r = ready(custom(catalog, teams, status(), answers()));
    expect(ids(r.proposed)).toEqual(["reuniones"]);
    expect(ids(r.later)).toEqual(["entrantes-y-producto"]);
    expect(r.proposed[0]!.reasons).toEqual([
      "Empieza por «Play a», de la fase Captura.",
      "Activar «Play b» también avanza «Entrantes y producto».",
    ]);
  });

  it("an enabled step says nothing about the teams it shares", () => {
    const catalog = [play("a"), play("b")];
    const teams = [team("reuniones", ["a", "b"]), team("entrantes-y-producto", ["b"])];
    const r = ready(custom(catalog, teams, status(), answers(), { b: true }));
    expect(r.proposed[0]!.reasons).toEqual(["Empieza por «Play a», de la fase Captura."]);
  });
});
