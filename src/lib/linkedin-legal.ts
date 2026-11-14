// Legal pause of robotized LinkedIn extraction (SDD pausa-legal-linkedin-y-gasto, pieza A): pure rules.
// The pause is global and reversible only by a superadmin after the legal review; G2 reviews are NOT paused
// and LinkedIn sources already saved stay visible (nothing is deleted or rewritten).
import { ACTORS } from "@/lib/apify";

/** Key of the global flag in platform_legal_flags. */
export const LINKEDIN_FLAG_KEY = "linkedin_extraction";

/** Short state label shown wherever the extraction is offered. */
export const LINKEDIN_PAUSE_TEXT = "En pausa · pendiente de revisión legal";

/**
 * Actors explicitly authorized as non-LinkedIn. Every other actor — the three LinkedIn robots and any new
 * actor not listed here — passes the legal-pause check before running (SDD: a new actor is never implicitly
 * authorized).
 */
export const NON_LINKEDIN_ACTOR_IDS: readonly string[] = [ACTORS.g2.id];

/** True when running this actor is robotized extraction subject to the legal pause. */
export function actorNeedsLegalCheck(actorId: string): boolean {
  return !NON_LINKEDIN_ACTOR_IDS.includes(actorId);
}

export type LegalFlagRow = { paused: boolean } | null;

/**
 * Fail-closed: only a row explicitly saying paused = false lets the extraction run. A missing row or a
 * failed read (the caller passes null then) means paused.
 */
export function extractionPaused(row: LegalFlagRow): boolean {
  return row?.paused !== false;
}

/** What the agent answers when someone asks for LinkedIn extraction while paused: what, why, what still works. */
export function linkedinPauseExplanation(): string {
  return (
    "La extracción de LinkedIn está en pausa pendiente de revisión legal, así que no puedo leer publicaciones " +
    "ni ofertas de LinkedIn ni buscar páginas de LinkedIn ahora. Sí puedo seguir usando las reseñas de G2, " +
    "las fuentes de LinkedIn ya guardadas y el resto de fuentes (web pública, Apollo, Clay)."
  );
}
