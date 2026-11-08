import type { PlayChannel, PlayMotion, PlayStatus } from "./catalog";

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

export type PlayFilter = { motion: PlayMotion | "all"; status: PlayStatus | "all" };

/** The plays that match both filters, in the order they came. Blocked plays are shown by default so you can see what is missing. */
export function filterPlays<T extends { motion: PlayMotion[]; status: PlayStatus }>(
  plays: T[],
  f: PlayFilter,
): T[] {
  return plays.filter(
    (p) =>
      (f.motion === "all" || p.motion.includes(f.motion)) &&
      (f.status === "all" || p.status === f.status),
  );
}
