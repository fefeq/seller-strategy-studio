import type { PlayApproval, PlayChannel, PlayMotion, PlayPhase, PlayStatus } from "./catalog";

// Words and filters of the /plays screen (SDD-20261106-plays-library-core, H-1). Pure, so the screen and its tests share them.
// The state is always a word, never an icon or a colour alone.

export const STATUS_WORD: Record<PlayStatus, string> = {
  activo: "Activo",
  parcial: "Parcial",
  planificado: "Planificado",
  bloqueado: "Bloqueado",
};

export const MOTION_LABEL: Record<PlayMotion, string> = {
  entrante: "Entrante",
  saliente: "Saliente",
  producto: "Producto",
  cuentas: "Cuentas",
  reactivacion: "Reactivación",
  mercado: "Mercado",
};

export const CHANNEL_LABEL: Record<PlayChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  reunion: "Reunión",
  llamada: "Llamada",
  web: "Web",
  producto: "Producto",
  crm: "CRM",
};

// Phase and approval level (SDD-20261110-plays-phase-autonomy-deps, section 9): one set of texts for the screen and the agent.
export const PHASE_WORD: Record<PlayPhase, string> = {
  fundacion: "Fundación",
  captura: "Captura",
  generacion: "Generación",
  orquestacion: "Orquestación",
};

export const APPROVAL_WORD: Record<PlayApproval, string> = {
  nokko_con_ayuda: "NOKKO prepara, tú decides",
  nokko_borrador: "NOKKO redacta, tú apruebas",
};

/** `phase` is optional: a missing phase means all of them, so callers that only filter by motion and status keep working. */
export type PlayFilter = {
  motion: PlayMotion | "all";
  status: PlayStatus | "all";
  phase?: PlayPhase | "all";
};

/** The plays that match every filter, in the order they came. Blocked plays are shown by default so you can see what is missing. */
export function filterPlays<
  T extends { motion: PlayMotion[]; status: PlayStatus; phase: PlayPhase },
>(plays: T[], f: PlayFilter): T[] {
  return plays.filter(
    (p) =>
      (f.motion === "all" || p.motion.includes(f.motion)) &&
      (f.status === "all" || p.status === f.status) &&
      (f.phase === undefined || f.phase === "all" || p.phase === f.phase),
  );
}
