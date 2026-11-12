import { PHASES } from "./catalog";
import { PLAY_TEAMS, type TeamPlan } from "./teams";
import { PHASE_WORD } from "./view";
import { blockingMissing, type companyOnboardingStatus } from "@/lib/onboarding";

// Diagnóstico de plays (SDD-20261112-diagnosis-in-chat, U-1): which «equipos de plays» to start with and in which order the plays are activated.
// Pure: it receives the status of the company, the team plans (already computed with teamPlan and the company's rows) and the
// recommendable order, and does no I/O. The agent only words what this returns; the reasons are fixed texts, never figures.

export type TeamId = string;
export type DiagnosisAnswers = { bottleneck: TeamId | null; wanted: TeamId[] };

// `z.enum` wants a non-empty tuple and PlayTeam.id is a plain string, so the cast is explicit; the test checks the ids against PLAY_TEAMS.
export const TEAM_IDS = PLAY_TEAMS.map((t) => t.id) as [string, ...string[]];
export const MAX_PROPOSED_TEAMS = 3;
export const PLAYS_DIAGNOSIS_DETECTOR = "plays_diagnosis";

/** The options of the first question, one per team (SDD section 9). */
export const BOTTLENECK_WORD: Record<string, string> = {
  reuniones: "Llego a las reuniones sin preparar o se quedan sin seguimiento.",
  "reactivar-perdidos": "Perdemos deals y no volvemos a ellos.",
  "senales-de-cuenta": "No sé qué cuentas se están moviendo.",
  "aprender-de-llamadas": "No sé qué dolores repiten los clientes en las llamadas.",
  "priorizar-cuentas-y-crm": "No sé a qué cuentas dedicar tiempo o no me fío del CRM.",
  "entrantes-y-producto": "Los registros y los leads entrantes se enfrían.",
};

export type DiagnosisStatus = Pick<
  ReturnType<typeof companyOnboardingStatus>,
  "ready" | "missing" | "diagnosis" | "strategy"
>;
export type ProposedTeam = {
  rank: number;
  id: string;
  title: string;
  task: string;
  /** Id of the first step of the team that is not enabled yet. */
  next: string;
  reasons: string[];
};
export type TeamNote = { id: string; title: string; reason: string };
export type ActivationStep = { n: number; play_id: string; title: string; teams: string[] };
export type DiagnosisResult =
  | { ready: false; missing: string[] }
  | {
      ready: true;
      proposed: ProposedTeam[];
      later: TeamNote[];
      alreadyActive: TeamNote[];
      notAvailable: TeamNote[];
      activation: ActivationStep[];
    };

/** The only team whose fit depends on the archetype (P-2): it is for product archetypes unless the person asks for it. */
const PRODUCT_TEAM = "entrantes-y-producto";

/** The plan of a team without anything to activate: the reason is the one teamPlan gives for its first unavailable play. */
const noStepsReason = (plan: TeamPlan) =>
  plan.unavailable[0]
    ? `Ningún play disponible todavía: ${plan.unavailable[0].reason}.`
    : "Ningún play disponible todavía.";

export function prioritizeTeams({
  status,
  plans,
  answers,
  order,
  max = MAX_PROPOSED_TEAMS,
}: {
  status: DiagnosisStatus;
  plans: TeamPlan[];
  answers: DiagnosisAnswers;
  order: string[];
  max?: number;
}): DiagnosisResult {
  if (!status.ready) return { ready: false, missing: blockingMissing(status) };

  const wanted = new Set(answers.wanted);
  const isProduct = status.diagnosis?.motion === "plg";
  // The position in PLAY_TEAMS is the last key; a team that is not there keeps the order it came in, after the known ones.
  const position = (plan: TeamPlan, i: number) => {
    const at = PLAY_TEAMS.findIndex((t) => t.id === plan.id);
    return at >= 0 ? at : PLAY_TEAMS.length + i;
  };
  const note = (plan: TeamPlan, reason: string): TeamNote => ({
    id: plan.id,
    title: plan.title,
    reason,
  });

  const alreadyActive: TeamNote[] = [];
  const notAvailable: TeamNote[] = [];
  type Candidate = {
    plan: TeamPlan;
    next: TeamPlan["steps"][number];
    keys: [boolean, boolean, boolean, number, number];
  };
  const usual: Candidate[] = [];
  const unusual: { plan: TeamPlan; at: number }[] = [];
  plans.forEach((plan, i) => {
    const bottleneck = answers.bottleneck === plan.id;
    if (!plan.steps.length) {
      notAvailable.push(note(plan, noStepsReason(plan)));
      return;
    }
    const next = plan.steps.find((s) => !s.enabled);
    if (!next) {
      alreadyActive.push(
        note(
          plan,
          bottleneck
            ? "Es tu cuello de botella, pero todos sus plays disponibles ya están activados."
            : "Todos sus plays disponibles ya están activados.",
        ),
      );
      return;
    }
    const fit = plan.id === PRODUCT_TEAM && isProduct;
    const asked = wanted.has(plan.id);
    if (plan.id === PRODUCT_TEAM && !isProduct && !bottleneck && !asked) {
      unusual.push({ plan, at: position(plan, i) });
      return;
    }
    usual.push({
      plan,
      next,
      keys: [!bottleneck, !asked, !fit, PHASES.indexOf(next.phase), position(plan, i)],
    });
  });

  usual.sort((a, b) => {
    for (let k = 0; k < a.keys.length; k++) {
      const x = a.keys[k]!;
      const y = b.keys[k]!;
      if (x !== y) return Number(x) - Number(y);
    }
    return 0;
  });
  unusual.sort((a, b) => a.at - b.at);

  const proposed: ProposedTeam[] = usual.slice(0, max).map(({ plan, next }, i) => ({
    rank: i + 1,
    id: plan.id,
    title: plan.title,
    task: plan.task,
    next: next.id,
    reasons: teamReasons(plan, next, answers, wanted, isProduct, status.diagnosis?.name ?? null),
  }));
  const later: TeamNote[] = [
    ...usual
      .slice(max)
      .map(({ plan }) =>
        note(plan, `Lo dejamos para después: como mucho ${max} equipos de plays a la vez.`),
      ),
    ...unusual.map(({ plan }) =>
      note(
        plan,
        status.diagnosis?.name
          ? `No es lo habitual para tu arquetipo (${status.diagnosis.name}); dímelo si lo quieres.`
          : "No es lo habitual para tu arquetipo; dímelo si lo quieres.",
      ),
    ),
  ];
  const activation = activationPlan({ proposed, plans, order });
  return { ready: true, proposed, later, alreadyActive, notAvailable, activation };
}

/**
 * The order in which to activate the plays of the proposed teams: the plays not enabled yet, each once, in the position they have in
 * `order` (recommendablePlays: by phase and, inside a phase, after what each play depends on). The rank of the team does not decide.
 * `teams` are the proposed teams that have the play among their steps, in rank order. A play that is not in `order` is never listed.
 */
export function activationPlan({
  proposed,
  plans,
  order,
}: {
  proposed: ProposedTeam[];
  plans: TeamPlan[];
  order: string[];
}): ActivationStep[] {
  const byId = new Map(plans.map((p) => [p.id, p]));
  const position = new Map(order.map((id, i) => [id, i]));
  const found = new Map<string, { title: string; teams: string[] }>();
  for (const team of proposed) {
    for (const step of byId.get(team.id)?.steps ?? []) {
      if (step.enabled || !position.has(step.id)) continue;
      const entry = found.get(step.id) ?? { title: step.title, teams: [] };
      entry.teams.push(team.title);
      found.set(step.id, entry);
    }
  }
  return [...found.entries()]
    .sort((a, b) => position.get(a[0])! - position.get(b[0])!)
    .map(([play_id, { title, teams }], i) => ({ n: i + 1, play_id, title, teams }));
}

/** Fixed sentences of section 9; no figures, and `<play>` is always the title of the play. */
function teamReasons(
  plan: TeamPlan,
  next: TeamPlan["steps"][number],
  answers: DiagnosisAnswers,
  wanted: Set<string>,
  isProduct: boolean,
  archetype: string | null,
): string[] {
  const reasons: string[] = [];
  if (answers.bottleneck === plan.id) reasons.push("Es tu cuello de botella.");
  if (wanted.has(plan.id)) reasons.push("Lo has elegido tú.");
  if (plan.id === PRODUCT_TEAM && isProduct)
    reasons.push(
      archetype
        ? `Encaja con tu arquetipo (${archetype}): vendes con producto.`
        : "Encaja con tu arquetipo: vendes con producto.",
    );
  reasons.push(`Empieza por «${next.title}», de la fase ${PHASE_WORD[next.phase]}.`);
  const seen = new Set<string>();
  for (const step of plan.steps) {
    if (step.enabled) continue;
    for (const other of step.sharedWith) {
      const line = `Activar «${step.title}» también avanza «${other}».`;
      if (!seen.has(line)) reasons.push(line);
      seen.add(line);
    }
  }
  return reasons;
}

export type VozInfo = { ok: true; ejemplos: number; faltan: number } | { ok: false };
export type ReglasInfo = { ok: true; faltan: string[] } | { ok: false };

/** Where each blocking piece is fixed (the links of the flow in section 9). */
function linksFor(missing: string[]): string {
  const links: string[] = [];
  if (missing.some((m) => m.startsWith("Diagnóstico GTM")))
    links.push("/onboarding para el diagnóstico GTM");
  if (missing.some((m) => !m.startsWith("Diagnóstico GTM")))
    links.push("/setup para posicionamiento e ICP");
  return links.join(" y ");
}

/**
 * The words of section 9 for a result: what `resumen` says. Pure; the role arrives already resolved as `canAct`.
 * It counts voice examples and rules, it never shows their text.
 */
export function playDiagnosisText(
  result: DiagnosisResult,
  { voz, reglas, canAct }: { voz: VozInfo; reglas: ReglasInfo; canAct: boolean },
): string {
  if (!result.ready)
    return [
      `Todavía no puedo proponerte equipos de plays. Falta: ${result.missing.join("; ")}.`,
      `${linksFor(result.missing)}.`,
    ].join(" ");

  const out: string[] = [];
  // A blank line separates blocks; never before the first one (with nothing proposed the text starts with the next block).
  const gap = () => {
    if (out.length) out.push("");
  };
  if (result.proposed.length) {
    out.push("Te propongo empezar por estos equipos de plays, en este orden:");
    for (const t of result.proposed)
      out.push(`${t.rank}. ${t.title}: ${t.task} ${t.reasons.join(" ")}`);
  } else if (!result.later.length) {
    out.push("Ya tienes activados todos los plays disponibles de los equipos de plays.");
  }
  if (result.activation.length) {
    gap();
    out.push("Plan de activación, por fase y dependencias:");
    for (const a of result.activation) out.push(`${a.n}. ${a.title} (${a.teams.join(", ")})`);
  }
  const section = (title: string, notes: TeamNote[]) => {
    if (!notes.length) return;
    gap();
    out.push(title);
    for (const n of notes) out.push(`${n.title}: ${n.reason}`);
  };
  section("Para después:", result.later);
  section("Ya activos:", result.alreadyActive);
  section("No disponibles todavía:", result.notAvailable);

  gap();
  if (!voz.ok) out.push("No he podido comprobar la voz de tu empresa.");
  else if (voz.faltan > 0)
    out.push(
      `Tienes ${voz.ejemplos} de 3 mensajes de voz. Añade los que faltan en Conocimiento › Voz; no los pegues en el chat.`,
    );
  else out.push("Tu voz está completa.");
  if (!reglas.ok) out.push("No he podido comprobar tus reglas.");
  else if (reglas.faltan.length)
    out.push(
      canAct
        ? `Te faltan ${reglas.faltan.length} reglas base; puedo añadirlas si me lo confirmas.`
        : `Te faltan ${reglas.faltan.length} reglas base; pídele a tu Owner o Sales Leader que las añada.`,
    );
  else out.push("Ya tienes las reglas base.");
  if (result.activation.length)
    out.push(
      canAct
        ? "Nada se activa solo: te dejo cada play como sugerencia y lo activas al aprobarla."
        : "Nada se activa solo: un Owner o un Sales Leader activa cada play al aprobar su sugerencia.",
    );
  return out.join("\n");
}

export type PlanSuggestionRow = {
  id: string;
  dedupe_key: string;
  status: string;
  user_id: string | null;
};
export type PlanPartition = {
  create: string[];
  reopen: { key: string; id: string; status: string }[];
  ya_abiertas: string[];
  de_otra_persona: string[];
  pospuestas: string[];
  descartadas: string[];
};

/**
 * Internal helper of `save_play_plan` (SDD CA-11): what the state read decides for each key `plays_diagnosis:<play_id>` of the plan.
 * Each key goes to exactly one category: no row (create), approved or resolved (reopen), pending yours or unowned (ya_abiertas),
 * pending of another person (de_otra_persona), snoozed (pospuestas) or dismissed (descartadas). What the database returns on writing
 * (created, reopened, changed by someone else in between) is not decided here. Pure: no I/O.
 */
export function partitionPlanSuggestions({
  keys,
  rows,
  userId,
}: {
  keys: string[];
  rows: PlanSuggestionRow[];
  userId: string;
}): PlanPartition {
  const byKey = new Map(rows.map((r) => [r.dedupe_key, r]));
  const out: PlanPartition = {
    create: [],
    reopen: [],
    ya_abiertas: [],
    de_otra_persona: [],
    pospuestas: [],
    descartadas: [],
  };
  for (const key of new Set(keys)) {
    const row = byKey.get(key);
    if (!row) out.create.push(key);
    else if (row.status === "approved" || row.status === "resolved")
      out.reopen.push({ key, id: row.id, status: row.status });
    else if (row.status === "pending")
      (!row.user_id || row.user_id === userId ? out.ya_abiertas : out.de_otra_persona).push(key);
    else if (row.status === "snoozed") out.pospuestas.push(key);
    else if (row.status === "dismissed") out.descartadas.push(key);
    else throw new Error(`Unknown suggestion status: ${row.status}`);
  }
  return out;
}
