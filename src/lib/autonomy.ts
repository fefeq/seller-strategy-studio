// E1: agent levels per person. Only changes how much Nokko proposes and explains — never what it may do alone.
export type Autonomy = "guided" | "copilot" | "autopilot";
export const DEFAULT_AUTONOMY: Autonomy = "copilot";

export const AUTONOMY: Record<Autonomy, { label: string; short: string; prompt: string }> = {
  guided: {
    label: "Guiado",
    short: "Te explico cada paso y te pregunto antes de proponer nada.",
    prompt:
      "NIVEL GUIADO: explica en una frase por qué haces cada cosa, propone un solo paso cada vez y pregunta antes de preparar propuestas.",
  },
  copilot: {
    label: "Copiloto",
    short: "Te propongo el siguiente paso y lo dejo listo para que lo confirmes.",
    prompt:
      "NIVEL COPILOTO: responde y, cuando haya un siguiente paso claro, déjalo propuesto para que lo confirme.",
  },
  autopilot: {
    label: "Autopilot",
    short: "Preparo por mi cuenta todo lo que pueda; tú confirmas antes de que se haga.",
    prompt:
      "NIVEL AUTOPILOT: encadena las consultas necesarias sin preguntar y deja preparadas varias propuestas a la vez, agrupadas para confirmarlas juntas.",
  },
};

/** Same for every level: confirmations stay and nothing is sent on the user's behalf. */
export const ALWAYS =
  "En cualquier nivel: toda escritura queda como propuesta que el usuario confirma; nunca envías mensajes, emails ni nada en su nombre; solo dejas borradores.";

export const parseAutonomy = (v: unknown): Autonomy =>
  v === "guided" || v === "copilot" || v === "autopilot" ? v : DEFAULT_AUTONOMY;

export const autonomyPrompt = (a: Autonomy) => `${AUTONOMY[a].prompt}\n${ALWAYS}`;

/** The invariant the agent runtime relies on: no level executes writes without confirmation or sends for the user. */
export const skipsConfirmation = (_a: Autonomy) => false;
export const sendsForUser = (_a: Autonomy) => false;
