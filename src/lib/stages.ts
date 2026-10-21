// Deal stages per company (table deal_stages). Pure so the board, the forms, the agent, the weekly
// report and the advisor order and name stages the same way. Every function takes the company's
// stages and falls back to DEFAULT_STAGES, the seven stages the app had before they were editable,
// so a screen that hasn't loaded them yet (or a test) behaves exactly as before.

export type StageKind = "open" | "won" | "lost";
export type BoardGroup = "opportunity" | "progress";

export type Stage = {
  key: string;
  label: string;
  position: number;
  kind: StageKind;
  board_group: BoardGroup | null;
  probability: number;
  color?: string | null;
  id?: string;
};

export const DEFAULT_STAGES: Stage[] = [
  { key: "discovery", label: "Descubrimiento", position: 1, kind: "open", board_group: "opportunity", probability: 10 },
  { key: "qualified", label: "Cualificado", position: 2, kind: "open", board_group: "opportunity", probability: 25 },
  { key: "demo", label: "Demo / prueba", position: 3, kind: "open", board_group: "progress", probability: 40 },
  { key: "proposal", label: "Propuesta", position: 4, kind: "open", board_group: "progress", probability: 60 },
  { key: "negotiation", label: "Negociación", position: 5, kind: "open", board_group: "progress", probability: 80 },
  { key: "won", label: "Ganado", position: 100, kind: "won", board_group: null, probability: 100 },
  { key: "lost", label: "Perdido", position: 101, kind: "lost", board_group: null, probability: 0 },
];

const use = (stages: Stage[] | null | undefined) => (stages && stages.length ? stages : DEFAULT_STAGES);

/** Open stages in order, then «Ganado», then «Perdido». */
export function sortStages(stages?: Stage[] | null): Stage[] {
  const rank = (s: Stage) => (s.kind === "open" ? 0 : s.kind === "won" ? 1 : 2);
  return [...use(stages)].sort((a, b) => rank(a) - rank(b) || a.position - b.position || a.label.localeCompare(b.label));
}

export const openStages = (stages?: Stage[] | null) => sortStages(stages).filter((s) => s.kind === "open");

/** The stage a new deal starts in when nobody chose one. */
export const firstOpenStage = (stages?: Stage[] | null): Stage => openStages(stages)[0] ?? DEFAULT_STAGES[0];

export function stageLabel(key: string | null | undefined, stages?: Stage[] | null): string {
  if (!key) return "";
  return use(stages).find((s) => s.key === key)?.label ?? DEFAULT_STAGES.find((s) => s.key === key)?.label ?? key;
}

export const stageProbability = (key: string, stages?: Stage[] | null): number | undefined =>
  use(stages).find((s) => s.key === key)?.probability;

export const isStageKey = (key: string, stages?: Stage[] | null) => use(stages).some((s) => s.key === key);

/** Open stage keys in order followed by 'won': the path a deal walks (conversion, «advanced» in the report). */
export const stagePath = (stages?: Stage[] | null): string[] => [...openStages(stages).map((s) => s.key), "won"];

/** Position of a stage on that path; -1 for «Perdido» or an unknown key. */
export const stageIndex = (key: string, stages?: Stage[] | null) => stagePath(stages).indexOf(key);

/** The last two open stages: where a deal should already be fully qualified. */
export const lateStages = (stages?: Stage[] | null) => new Set(openStages(stages).slice(-2).map((s) => s.key));

/** `{ key: label }` for selects; `withClosed` adds «Ganado» and «Perdido». */
export function stageOptions(stages?: Stage[] | null, withClosed = false): Record<string, string> {
  return Object.fromEntries((withClosed ? sortStages(stages) : openStages(stages)).map((s) => [s.key, s.label]));
}

/** A key for a new stage from its label: lowercase ASCII, unique in the company, never 'won' or 'lost'. */
export function newStageKey(label: string, stages?: Stage[] | null): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "etapa";
  const taken = new Set([...use(stages).map((s) => s.key), "won", "lost"]);
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
}

/** Why a stage edit can't be saved, or null. Mirrors the database rules so the screen says it first. */
export function checkStageEdit(label: string, probability: number, stages: Stage[], key?: string): string | null {
  const name = label.trim();
  if (!name) return "La etapa necesita un nombre.";
  if (name.length > 40) return "El nombre de la etapa tiene como máximo 40 caracteres.";
  if (!Number.isInteger(probability) || probability < 0 || probability > 100) return "La probabilidad tiene que ser un número entero entre 0 y 100.";
  const clash = stages.find((s) => s.key !== key && s.label.trim().toLowerCase() === name.toLowerCase());
  if (clash) return `Ya hay una etapa que se llama «${clash.label}».`;
  return null;
}

/** New positions after moving `key` one place up (-1) or down (+1) among the open stages. */
export function reorderOpen(stages: Stage[], key: string, dir: -1 | 1): { key: string; position: number }[] {
  const open = openStages(stages);
  const i = open.findIndex((s) => s.key === key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= open.length) return [];
  const next = [...open];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((s, idx) => ({ key: s.key, position: idx + 1 })).filter((p) => open.find((s) => s.key === p.key)?.position !== p.position);
}

/** Match a stage written by a person or another tool («Piloto», «piloto») to the company's stage key. */
export function stageByLabel(raw: string, stages?: Stage[] | null): string | null {
  const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const n = norm(raw);
  if (!n) return null;
  return use(stages).find((s) => norm(s.label) === n || norm(s.key) === n)?.key ?? null;
}
