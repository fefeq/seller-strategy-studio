// Multi-agent debate levels: who sits at the table and who may convene it.
import type { Role } from "@/lib/roles";
import { PERSONAS } from "./personas";

export type DebateLevel = "c_level" | "sales" | "marketing" | "partners" | "all";

export const DEBATE_LEVELS: Record<DebateLevel, { label: string; participants: string[]; purpose: string; roles: Role[] | null }> = {
  c_level: { label: "C-Levels", participants: ["reid", "benioff", "ruth", "melanie"], purpose: "Estrategia, presupuesto, pricing, objetivos y apuestas de mercado.", roles: ["owner", "sales_leader"] },
  sales: { label: "Sales Team", participants: ["sheryl", "jason", "brian", "benioff"], purpose: "Deals atascados, forecast, planes de cuenta y expansión.", roles: null },
  marketing: { label: "Marketing Team", participants: ["melanie", "paul", "jason"], purpose: "Mensajes, campañas, ICP y calidad de leads.", roles: null },
  partners: { label: "Partner Team", participants: ["satya", "benioff", "sheryl"], purpose: "Co-selling, conflictos de canal y plan de partners.", roles: null },
  all: { label: "Todos", participants: PERSONAS.map((p) => p.id), purpose: "Revisión trimestral, lanzamientos y cambios de estrategia.", roles: ["owner", "sales_leader"] },
};

export function canConvene(level: DebateLevel, roles: string[]) {
  const allowed = DEBATE_LEVELS[level].roles;
  return !allowed || roles.some((r) => (allowed as string[]).includes(r));
}

/** Validates a custom participant list: known personas, 2–9 of them; defaults to the level's table. */
export function resolveParticipants(level: DebateLevel, custom?: string[] | null) {
  const known = new Set(PERSONAS.map((p) => p.id));
  const list = (custom?.length ? custom : DEBATE_LEVELS[level].participants).filter((id, i, a) => known.has(id) && a.indexOf(id) === i);
  if (list.length < 2) throw new Error("Un debate necesita al menos 2 participantes");
  return list.slice(0, 9);
}

/** Rebuttal round is skipped for large tables to keep cost bounded. */
export const withRebuttal = (participants: string[]) => participants.length <= 5;
