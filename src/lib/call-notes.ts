// Call notes in five lines: what the seller writes right after a meeting, one line per question. Pure, so
// the meeting screen, the agent tool, the detector and the AI teardown agree on the same fields.

export const CALL_NOTE_FIELDS = [
  { key: "dolor", label: "Qué les duele", hint: "Con sus palabras, no las tuyas." },
  {
    key: "impacto",
    label: "Qué les cuesta no resolverlo",
    hint: "Dinero, tiempo, riesgo o una fecha que se les echa encima.",
  },
  {
    key: "decision",
    label: "Quién decide y cómo",
    hint: "Quién firma, quién más opina y qué pasos hay hasta la compra.",
  },
  {
    key: "freno",
    label: "Qué les frena",
    hint: "La objeción, la duda o el riesgo que salió (o el que intuyes).",
  },
  {
    key: "siguiente",
    label: "Próximo paso acordado",
    hint: "Qué, quién y cuándo. Si no hay fecha, no es un próximo paso.",
  },
] as const;

export type CallNoteKey = (typeof CALL_NOTE_FIELDS)[number]["key"];
export type CallNotes = Partial<Record<CallNoteKey, string>>;

const KEYS = CALL_NOTE_FIELDS.map((f) => f.key) as CallNoteKey[];
/** One line each: the template is five lines, so long pastes are cut. */
export const MAX_LINE = 300;

/** Reads the stored jsonb (or anything) into the five fields, trimmed, one line, capped. */
export function normalizeCallNotes(raw: unknown): CallNotes {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: CallNotes = {};
  for (const k of KEYS) {
    const v =
      typeof src[k] === "string"
        ? (src[k] as string).replace(/\s+/g, " ").trim().slice(0, MAX_LINE)
        : "";
    if (v) out[k] = v;
  }
  return out;
}

export const filledCount = (n: CallNotes) => KEYS.filter((k) => (n[k] ?? "").trim()).length;
export const hasCallNotes = (n: CallNotes) => filledCount(n) > 0;

/** The five lines as text, in order, skipping empty ones (for the call log, the AI and the account context). */
export function callNotesText(n: CallNotes): string {
  return CALL_NOTE_FIELDS.filter((f) => n[f.key])
    .map((f) => `${f.label}: ${n[f.key]}`)
    .join("\n");
}

/**
 * What a saved meeting writes to the call log (calls) so the account history, the call prep and the
 * score see it: the five lines first, then the free notes; the agreed next step wins over the old field.
 */
export function callLogEntry(m: {
  notes?: string | null;
  next_steps?: string | null;
  call_notes?: unknown;
}) {
  const n = normalizeCallNotes(m.call_notes);
  const summary = [callNotesText(n), (m.notes ?? "").trim()].filter(Boolean).join("\n\n");
  const next = n.siguiente ?? (m.next_steps ?? "").trim();
  return { summary, next_steps: next, hasContent: !!(summary || next) };
}

/** Merges new lines into the stored ones (empty values leave the old line); used by the agent tool. */
export function mergeCallNotes(stored: unknown, patch: CallNotes): CallNotes {
  const cur = normalizeCallNotes(stored);
  const add = normalizeCallNotes(patch);
  return { ...cur, ...add };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** The notes reminder starts 2 hours after the meeting and stops after 7 days (by then they are lost). */
export const NOTES_FROM_MS = 2 * HOUR;
export const NOTES_UNTIL_MS = 7 * DAY;

/** A past meeting (2 h–7 days ago) with an account and nothing written afterwards. */
export function needsCallNotes(
  m: {
    scheduled_at: string | null;
    account_id: string | null;
    notes?: string | null;
    call_notes?: unknown;
  },
  now: Date,
): boolean {
  if (!m.scheduled_at || !m.account_id) return false;
  const ago = now.getTime() - new Date(m.scheduled_at).getTime();
  if (ago < NOTES_FROM_MS || ago > NOTES_UNTIL_MS) return false;
  return !hasCallNotes(normalizeCallNotes(m.call_notes)) && !(m.notes ?? "").trim();
}

/** Instructions for the AI teardown of a call. */
export const TEARDOWN_SYSTEM = [
  "Eres un coach de ventas B2B senior que desmonta llamadas para que el comercial mejore la siguiente. Respondes en español neutro (tú), en markdown conciso, empezando por la conclusión, sin signos de exclamación ni emoji.",
  "Usa solo lo que hay en la reunión, sus notas y el contexto que te paso. Cita las notas cuando te apoyes en ellas. Si algo no está en las notas, di «no está en las notas»; no lo supongas.",
  "Estructura:",
  "1) Veredicto en una línea: ¿se consiguió el objetivo y el resultado deseado de la reunión? (sí, a medias o no, y por qué).",
  "2) Qué funcionó (2-3 puntos).",
  "3) Qué faltó: preguntas del brief o de discovery que no tienen respuesta en las notas y huecos de MEDDPICC que siguen abiertos.",
  "4) Señales de riesgo para el deal.",
  "5) Próximo paso: ¿es concreto (qué, quién y cuándo)? Si no, cómo cerrarlo y un borrador de mensaje corto para proponerlo.",
  "6) Qué actualizar en el deal: los campos de MEDDPICC que las notas permiten rellenar, con el valor propuesto y la frase de las notas que lo apoya. Si no hay deal, dilo.",
  "7) Para la próxima reunión: 3 preguntas concretas.",
].join("\n");
