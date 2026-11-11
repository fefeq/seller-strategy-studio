import { CATALOG, type Play } from "./catalog";
import { recommendablePlays } from "./recommend";
import { describePlay, type PlayStateRow } from "./status";

// «Equipos de plays» (SDD-20261110-play-teams): a team is a task a company wants solved and the plays that solve it. The six teams are
// code, like the catalogue; there is no state per team, only per play, so a play in two teams is activated once and counts in both.
// Pure: it reads the catalogue and the rows it is given and does no I/O. Order and reasons come from recommendablePlays, never from here.

export type PlayTeam = {
  id: string;
  title: string;
  /** The task the team solves, one sentence. */
  task: string;
  /** Play ids, in the order of the team. */
  plays: string[];
};

export const PLAY_TEAMS: PlayTeam[] = [
  {
    id: "reuniones",
    title: "Reuniones",
    task: "Llegar preparado a cada reunión y no dejar ninguna sin seguimiento.",
    plays: ["meeting-prep-and-follow-up", "meeting-form-orchestration"],
  },
  {
    id: "reactivar-perdidos",
    title: "Reactivar perdidos",
    task: "Volver a los deals perdidos cuando algo ha cambiado de verdad en la cuenta.",
    plays: ["closed-lost-revival", "signals-in-crm-with-decay"],
  },
  {
    id: "senales-de-cuenta",
    title: "Señales de cuenta",
    task: "Saber qué cuentas se mueven y actuar antes de que la señal se enfríe.",
    plays: ["signals-in-crm-with-decay", "signal-activation"],
  },
  {
    id: "aprender-de-llamadas",
    title: "Aprender de llamadas",
    task: "Sacar de las llamadas los dolores reales y agrupar las cuentas por ellos.",
    plays: ["call-transcript-signal-extraction", "pain-qualified-segments"],
  },
  {
    id: "priorizar-cuentas-y-crm",
    title: "Priorizar cuentas y limpiar CRM",
    task: "Decidir a qué cuentas dedicar tiempo y tener un CRM del que fiarte.",
    plays: ["hubspot-account-tiering-scoring", "crm-hygiene"],
  },
  {
    id: "entrantes-y-producto",
    title: "Entrantes y producto",
    task: "Atender cada registro y cada lead entrante a tiempo y con las personas correctas.",
    plays: ["plg-to-sales", "product-sign-up-outreach", "multi-thread-inbound-leads"],
  },
];

/** Errors in words; an empty list means the teams are valid. The suite runs it on the real teams, so a catalogue change that breaks a team fails the build of tests. */
export function validateTeams(teams: PlayTeam[], catalog: Play[]): string[] {
  const errors: string[] = [];
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (const t of teams) {
    if (seen.has(t.id)) errors.push(`Hay dos equipos de plays con el mismo id: ${t.id}.`);
    seen.add(t.id);
    if (!t.plays.length) errors.push(`El equipo de plays ${t.id} está vacío.`);
    const own = new Set<string>();
    for (const id of t.plays) {
      if (own.has(id)) errors.push(`El equipo de plays ${t.id} tiene el play ${id} repetido.`);
      own.add(id);
      if (!byId.has(id))
        errors.push(`El equipo de plays ${t.id} nombra un play que no existe: ${id}.`);
    }
    for (const id of own) {
      for (const d of byId.get(id)?.dependsOn ?? []) {
        if (!own.has(d))
          errors.push(
            `En el equipo de plays ${t.id}, ${byId.get(id)!.title} depende de ${byId.get(d)?.title ?? d}, que no está en el mismo equipo.`,
          );
      }
    }
  }
  return errors;
}

type Described = ReturnType<typeof describePlay> & { sharedWith: string[] };
export type TeamStep = Described & { n: number };
export type TeamUnavailable = Described & { reason: string };
export type TeamSummary = { available: number; total: number; enabled: number };
export type TeamPlan = {
  id: string;
  title: string;
  task: string;
  summary: TeamSummary;
  steps: TeamStep[];
  unavailable: TeamUnavailable[];
};

/** The plays of a team in the order recommendablePlays gives, then those that cannot be recommended, each with the reason that function gives. */
export function teamPlan(
  team: PlayTeam,
  catalog: Play[] = CATALOG,
  rows: Map<string, PlayStateRow> = new Map(),
  teams: PlayTeam[] = PLAY_TEAMS,
): TeamPlan {
  const { recommended, excluded } = recommendablePlays(catalog);
  const known = new Set(catalog.map((p) => p.id));
  const mine = new Set(team.plays.filter((id) => known.has(id)));
  const describe = (p: Play): Described => ({
    ...describePlay(p, rows.get(p.id)),
    sharedWith: teams.filter((t) => t.id !== team.id && t.plays.includes(p.id)).map((t) => t.title),
  });
  const steps = recommended
    .filter((p) => mine.has(p.id))
    .map((p, i) => ({ ...describe(p), n: i + 1 }));
  const reasons = new Map(excluded.map((e) => [e.play.id, e.reason]));
  const unavailable = team.plays
    .filter((id) => mine.has(id) && reasons.has(id))
    .map((id) => ({ ...describe(catalog.find((p) => p.id === id)!), reason: reasons.get(id)! }));
  const all = [...steps, ...unavailable];
  return {
    id: team.id,
    title: team.title,
    task: team.task,
    summary: {
      available: steps.length,
      total: all.length,
      enabled: all.filter((p) => p.enabled).length,
    },
    steps,
    unavailable,
  };
}

// Words of the view (SDD section 9): one set for the screen and the agent.
export const TEAMS_INTRO =
  "Un equipo de plays agrupa los plays que resuelven una misma tarea, en el orden en que conviene activarlos. Un play puede estar en varios equipos: se activa una vez y cuenta en todos. Ningún equipo envía nada: solo sugerencias, tareas y borradores que tú confirmas.";
export const summaryWord = (s: TeamSummary) =>
  `${s.available} de ${s.total} plays disponibles · ${s.enabled} ${s.enabled === 1 ? "activado" : "activados"}`;
export const stepWord = (n: number) => `Paso ${n}`;
export const unavailableWord = (reason: string) => `No disponible: ${reason}`;
export const sharedWord = (titles: string[]) => `También en: ${titles.join(", ")}`;
