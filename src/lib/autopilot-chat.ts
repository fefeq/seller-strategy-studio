/** Narrow, free control requests. Other conversation continues through the normal agent. */
export function localAutopilotRequest(text: string): { kind: "read" } | { kind: "threshold"; threshold: number; currency?: string } | null {
  const value = text.trim();
  const change = /^(?:cambiar|cambia|poner|pon|fijar|fija|prop[oó]n(?:er)?)\s+(?:el\s+)?umbral(?:\s+del\s+piloto)?\s+(?:a|en)\s+(\d+(?:[.,]\d+)?)\s*([A-Z]{3})?\s*[.?!]?$/i.exec(value);
  if (change) return { kind: "threshold", threshold: Number(change[1]?.replace(",", ".")), ...(change[2] ? { currency: change[2].toUpperCase() } : {}) };
  if (/^(?:ver |mu[eé]strame |muestra |quiero ver )?(?:mis |los |las )?pendientes[.?!]?$/i.test(value) || (/umbral/i.test(value) && /(?:cu[aá]l|actual|ver|consultar|tengo)/i.test(value) && !/(cambi|poner|fij|prop)/i.test(value))) return { kind: "read" };
  return null;
}