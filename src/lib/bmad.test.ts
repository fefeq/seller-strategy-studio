import { describe, expect, it } from "vitest";
import { currentPhase, nextSteps, type CycleState } from "./bmad/phases";
import { canConvene, resolveParticipants, withRebuttal, DEBATE_LEVELS } from "./bmad/teams";
import { stageGate, trackFor } from "./bmad/tracks";
import { getWorkflow, missingPrereqs, WORKFLOWS } from "./bmad/workflows";
import { PERSONAS, personasFor } from "./bmad/personas";

const base: CycleState = { approved: [], drafts: [], setupPct: 100, openDeals: 0, closedDealsWithoutWinloss: 0, daysSinceRetro: null };

describe("phases", () => {
  it("starts in analysis and advances with approved artifacts", () => {
    expect(currentPhase(base)).toBe("analysis");
    expect(currentPhase({ ...base, approved: ["brief"] })).toBe("plan");
    expect(currentPhase({ ...base, approved: ["brief", "plan", "architecture"] })).toBe("architecture");
    expect(currentPhase({ ...base, approved: ["brief", "plan", "architecture", "readiness"] })).toBe("execution");
  });
  it("owner is asked for the brief first; AE is not", () => {
    expect(nextSteps(base, ["owner"])[0].id).toBe("draft_brief");
    expect(nextSteps(base, ["ae"]).some((s) => s.id === "draft_brief")).toBe(false);
  });
  it("a draft plan asks the leader to approve it", () => {
    const s = nextSteps({ ...base, approved: ["brief"], drafts: ["plan"] }, ["sales_leader"]);
    expect(s.some((x) => x.id === "approve_plan")).toBe(true);
  });
  it("context below 60% comes first", () => {
    expect(nextSteps({ ...base, setupPct: 40 }, ["owner"])[0].id).toBe("context");
  });
});

describe("debate levels", () => {
  it("C-Levels and Todos only for owner and sales leader", () => {
    expect(canConvene("c_level", ["ae"])).toBe(false);
    expect(canConvene("all", ["marketing"])).toBe(false);
    expect(canConvene("c_level", ["sales_leader"])).toBe(true);
    expect(canConvene("sales", ["ae"])).toBe(true);
  });
  it("C-Levels table is Reid, Benioff, Ruth, Melanie", () => {
    expect(DEBATE_LEVELS.c_level.participants).toEqual(["reid", "benioff", "ruth", "melanie"]);
  });
  it("Todos includes every persona and skips rebuttal", () => {
    const p = resolveParticipants("all");
    expect(p.length).toBe(PERSONAS.length);
    expect(withRebuttal(p)).toBe(false);
  });
  it("rejects fewer than 2 known participants", () => {
    expect(() => resolveParticipants("sales", ["jason", "nobody"])).toThrow();
  });
});

describe("tracks and stage gates", () => {
  it("ACV thresholds map to tracks", () => {
    expect(trackFor(3000)).toBe("light");
    expect(trackFor(20000)).toBe("standard");
    expect(trackFor(120000)).toBe("full");
  });
  it("full track needs economic buyer before proposal", () => {
    const g = stageGate({ amount: 100000, meddpicc: { identify_pain: { score: 3 }, metrics: { score: 2 }, champion: { score: 2 }, decision_criteria: { score: 2 } } }, "proposal");
    expect(g.missing).toEqual(["Economic buyer", "Decision process", "Competition"]);
  });
  it("light track to qualified only needs pain", () => {
    expect(stageGate({ amount: 1000, meddpicc: { identify_pain: { score: 0, note: "dolor" } } }, "qualified").missing).toEqual([]);
  });
});

describe("workflows", () => {
  it("Plan GTM requires an approved brief", () => {
    expect(missingPrereqs(getWorkflow("plan")!, [])).toEqual(["brief"]);
  });
  it("every persona menu points to an existing workflow", () => {
    for (const p of PERSONAS) for (const m of p.menu) expect(WORKFLOWS.some((w) => w.id === m.workflow)).toBe(true);
  });
  it("primary personas come first for the role", () => {
    expect(personasFor(["cs"])[0].id).toBe("brian");
  });
});

// SDD-20261112-diagnosis-in-chat (NK-0153) CA-16: the plays diagnosis is a flow of the app (workflowId), with the literal script of §9.
describe("plays diagnosis flow (NK-0153 CA-16)", () => {
  const INSTRUCTIONS =
    "1) Llama a get_onboarding_status. Si ready es false, di qué falta con las palabras de missing (sin contar los segmentos), enlaza /onboarding para el diagnóstico GTM y /setup para posicionamiento e ICP, y no propongas equipos de plays. 2) Si está lista, pregunta una cosa por turno: primero cuál es hoy su cuello de botella, con las seis opciones de BOTTLENECK_WORD más «Ninguno de estos»; después qué otras tareas quiere resolver (puede elegir varias o ninguna). No preguntes lo que get_onboarding_status ya sabe. 3) Llama a diagnose_play_teams con sus respuestas y cuenta el resultado a partir de resumen: no añadas equipos de plays, plays, motivos ni cifras que no estén en la respuesta. 4) Si reglas_base.faltan no está vacío, propón add_default_rules. Si voz.faltan es mayor que 0, di cuántos hay y pide que pegue los que faltan en Conocimiento › Voz (/hub?seccion=voice), nunca en el chat; tú no guardas voz. 5) Propón save_play_plan con las mismas respuestas y di que nada se activa hasta que apruebe cada sugerencia.";
  it("exists in execution, without artifacts, with the label and the literal instructions", () => {
    const w = getWorkflow("plays_diagnosis");
    expect(w).toBeDefined();
    expect(w!.label).toBe("Diagnóstico de plays");
    expect(w!.phase).toBe("execution");
    expect(w!.instructions).toBe(INSTRUCTIONS);
    expect("produces" in w!).toBe(false);
    expect("requires" in w!).toBe(false);
    expect(missingPrereqs(w!, [])).toEqual([]);
    expect(WORKFLOWS.filter((x) => x.id === "plays_diagnosis")).toHaveLength(1);
  });
});
