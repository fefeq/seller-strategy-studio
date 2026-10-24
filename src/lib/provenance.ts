// Field provenance (pure, tested): which account fields Nokko filled, from which source and when.
// Stored in accounts.field_sources; a DB trigger drops a field's mark when a person edits it.

export type FieldSource = { source: string; at: string; quote?: string };
export type FieldSources = Record<string, FieldSource>;

export const SOURCE_LABEL: Record<string, string> = { apollo: "Apollo", clay: "Clay", web: "Web de la empresa" };

export function readSources(raw: unknown): FieldSources {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: FieldSources = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object" && typeof (v as FieldSource).source === "string" && typeof (v as FieldSource).at === "string") out[k] = v as FieldSource;
  }
  return out;
}

/** Marks the filled fields; keeps the marks of the others. */
export function stampSources(prev: unknown, filled: { field: string; source: string; quote?: string }[], at: string): FieldSources {
  const out = { ...readSources(prev) };
  for (const f of filled) out[f.field] = { source: f.source, at, ...(f.quote ? { quote: f.quote } : {}) };
  return out;
}

/** «Automático · Apollo · 24 oct» */
export function sourceText(s: FieldSource | undefined): string | null {
  if (!s) return null;
  const d = new Date(s.at);
  const day = isNaN(d.getTime()) ? "" : ` · ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
  return `Automático · ${SOURCE_LABEL[s.source] ?? s.source}${day}`;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** A web value is accepted only when its quote appears literally (ignoring case, accents and punctuation) in the page text. */
export function quoteFound(quote: string | null | undefined, text: string): boolean {
  const q = quote ? norm(quote) : "";
  return q.length >= 8 && norm(text).includes(q);
}

/** Order of sources: Apollo, then Clay, then the company website as the last one. */
export function needsWebFallback(emptyLeft: string[], webAvailable: boolean): boolean {
  return webAvailable && emptyLeft.length > 0;
}
