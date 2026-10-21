// Pure helpers around the library: which plays a company still lacks, the prompt that adapts one to
// its context, and the guard that keeps the adaptation honest (no invented figures, markers gone).
import { BASE_PLAYS, type BasePlay } from "./base";

export type ExistingDoc = { title: string; section: string };

/** Plays whose title is not in the Hub yet (titles are the identity, so a renamed doc counts as custom). */
export function missingPlays(existing: ExistingDoc[]): BasePlay[] {
  const titles = new Set(existing.map((d) => d.title.trim().toLowerCase()));
  return BASE_PLAYS.filter((p) => !titles.has(p.title.toLowerCase()));
}

export const ADAPT_SYSTEM = "Eres un Sales Leader B2B senior que adapta un playbook genérico a una empresa concreta. Español neutro (tú), sin signos de exclamación ni emoji. Conserva exactamente la estructura y los títulos de sección del playbook base; cambia solo los ejemplos y lo marcado entre «» por el producto, el dolor, el diferenciador, las pruebas y los perfiles de comprador reales de la empresa, con sus palabras. Si un dato no está en el contexto (precios, descuentos, cifras de resultados, referencias), no lo inventes: deja la frase en genérico o escribe [completar]. Devuelve solo el texto del playbook adaptado, en el mismo formato de texto plano con listas.";

export function adaptPrompt(play: BasePlay, context: unknown): string {
  return JSON.stringify({ playbook: play.title, conservar: play.keep, base: play.body, contexto_empresa: context });
}

/** True when the adaptation kept the structure and left no «» markers behind; otherwise keep the base text. */
export function acceptableAdaptation(play: BasePlay, text: string): boolean {
  if (!text || text.length < play.body.length * 0.5) return false;
  if (/«|»/.test(text)) return false;
  const headings = play.body.split("\n").filter((l) => /^\d\. /.test(l)).map((l) => l.replace(/\s*\(.*\)\s*$/, "").slice(0, 12));
  const kept = headings.filter((h) => text.includes(h)).length;
  return headings.length === 0 || kept >= Math.ceil(headings.length * 0.6);
}
