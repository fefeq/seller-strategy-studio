// Field provenance (pure, tested): where a value comes from (a person, a source Nokko read, AI, an assumption),
// when, and whether it is confirmed. Stored in accounts.field_sources; a DB trigger drops a field's mark when
// an update changes the field without touching field_sources. A value without a mark is «sin dato»: it is never
// read as written by a person.

export type OriginKind = "persona" | "fuente" | "ia" | "supuesto" | "sin_dato";
export type FieldSource = {
  source: string;
  at: string;
  quote?: string;
  kind?: OriginKind;
  confirmed?: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
};
export type FieldSources = Record<string, FieldSource>;

export const SOURCE_LABEL: Record<string, string> = {
  apollo: "Apollo",
  clay: "Clay",
  parallel: "Parallel",
  web: "Web de la empresa",
  strategic_review: "Revisión estratégica",
};

/** Origins update_account accepts: never «persona» (only a person's own edit is that). */
export const ACCOUNT_SOURCES = ["ia", "apollo", "clay", "parallel", "web"] as const;
export type AccountSource = (typeof ACCOUNT_SOURCES)[number];

const KINDS: OriginKind[] = ["persona", "fuente", "ia", "supuesto", "sin_dato"];

/** Marks older rows carry only {source, at, quote}: the kind comes from the source, and only a person's edit is confirmed. */
export function originOf(
  s: FieldSource | undefined,
): { kind: OriginKind; confirmed: boolean; detail: string } | null {
  if (!s) return null;
  const kind: OriginKind =
    s.kind && KINDS.includes(s.kind)
      ? s.kind
      : s.source === "persona"
        ? "persona"
        : s.source === "ia" || s.source === "supuesto"
          ? s.source
          : "fuente";
  return { kind, confirmed: s.confirmed ?? kind === "persona", detail: s.source };
}

/** A person wrote these fields: marked as theirs and confirmed, replacing any automatic mark. */
export function stampPerson(
  prev: unknown,
  fields: string[],
  at: string,
  by?: string,
): FieldSources {
  const out = { ...readSources(prev) };
  for (const f of fields)
    out[f] = {
      source: "persona",
      kind: "persona",
      confirmed: true,
      at,
      ...(by ? { confirmedBy: by, confirmedAt: at } : {}),
    };
  return out;
}

/**
 * A person confirms values (SDD field-actions CA-8): the mark keeps where the value came from and gains who and when.
 * A value with no mark gets kind sin_dato: it is confirmed as correct, not claimed as written by the person.
 */
export function confirmSources(
  prev: unknown,
  fields: string[],
  by: string,
  at: string,
): FieldSources {
  const out = { ...readSources(prev) };
  for (const f of fields) {
    const m = out[f];
    out[f] = m
      ? { ...m, confirmed: true, confirmedBy: by, confirmedAt: at }
      : {
          source: "sin_origen",
          kind: "sin_dato",
          at,
          confirmed: true,
          confirmedBy: by,
          confirmedAt: at,
        };
  }
  return out;
}

/** A person edited fields: a written value is marked as theirs and confirmed, a cleared one loses its mark. */
export function personEdit(
  prev: unknown,
  edits: Record<string, string | null | undefined>,
  at: string,
  by?: string,
): FieldSources {
  const out = stampPerson(
    prev,
    Object.keys(edits).filter((f) => edits[f]?.trim()),
    at,
    by,
  );
  for (const f of Object.keys(edits)) if (!edits[f]?.trim()) delete out[f];
  return out;
}

/** What an automatic process may do with a value: write it, only offer it, or nothing. Only an empty field is written. */
export function autoWriteDecision(
  current: string | null | undefined,
  proposed: string | null | undefined,
): "write" | "propose" | "same" | "none" {
  const next = proposed?.trim();
  if (!next) return "none";
  const cur = current?.trim();
  if (!cur) return "write";
  return cur.toLowerCase() === next.toLowerCase() ? "same" : "propose";
}

export function readSources(raw: unknown): FieldSources {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: FieldSources = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (
      v &&
      typeof v === "object" &&
      typeof (v as FieldSource).source === "string" &&
      typeof (v as FieldSource).at === "string"
    )
      out[k] = v as FieldSource;
  }
  return out;
}

/** Marks the filled fields; keeps the marks of the others. */
export function stampSources(
  prev: unknown,
  filled: { field: string; source: string; quote?: string }[],
  at: string,
): FieldSources {
  const out = { ...readSources(prev) };
  for (const f of filled)
    out[f.field] = { source: f.source, at, ...(f.quote ? { quote: f.quote } : {}) };
  return out;
}

const kindOfSource = (source: string): OriginKind => originOf({ source, at: "" })?.kind ?? "fuente";

/**
 * Writer marks (SDD field-sources-on-tracked-writers U-1). All start from the field_sources read just before writing,
 * keep the marks of the fields that do not change, and give every written field a new mark (it carries `at`), so the
 * result differs from the previous one: DB trigger 0058 only leaves field_sources alone when it changed.
 * Origin approved by someone: keeps where the value came from and adds who confirmed and when.
 */
export function stampConfirmed(
  prev: unknown,
  filled: { field: string; source: string; quote?: string }[],
  by: string,
  at: string,
): FieldSources {
  const out = confirmSources(
    stampSources(prev, filled, at),
    filled.map((f) => f.field),
    by,
    at,
  );
  for (const f of filled) out[f.field] = { ...out[f.field]!, kind: kindOfSource(f.source) };
  return out;
}

/** Origin that nobody confirmed (an automatic write): never «persona», never confirmed. */
export function stampUnconfirmed(
  prev: unknown,
  filled: { field: string; source: string; quote?: string }[],
  at: string,
): FieldSources {
  const out = stampSources(prev, filled, at);
  for (const f of filled)
    out[f.field] = { ...out[f.field]!, kind: kindOfSource(f.source), confirmed: false };
  return out;
}

/** A cleared value loses its mark; the others stay. */
export function dropSources(prev: unknown, fields: string[]): FieldSources {
  const out = { ...readSources(prev) };
  for (const f of fields) delete out[f];
  return out;
}

/**
 * The field_sources to save: the new marks over what was read, keeping entries readSources would drop (no `at`,
 * malformed) so rewriting never loses what it does not understand; cleared fields are removed.
 */
export function keepUnreadable(
  prev: unknown,
  marks: FieldSources,
  cleared: string[] = [],
): Record<string, unknown> {
  const raw =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? (prev as Record<string, unknown>)
      : {};
  const out: Record<string, unknown> = { ...raw, ...marks };
  for (const f of cleared) delete out[f];
  return out;
}

/** «Automático · Apollo · 24 oct» */
export function sourceText(s: FieldSource | undefined): string | null {
  const o = originOf(s);
  if (!s || !o) return null;
  const d = new Date(s.at);
  const day = isNaN(d.getTime())
    ? ""
    : ` · ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
  if (o.kind === "persona") return `Escrito por ti · Confirmado${day}`;
  if (o.kind === "ia") return `Deducido${o.confirmed ? " · Confirmado" : ""}${day}`;
  if (o.kind === "supuesto") return `Supuesto${day}`;
  if (o.kind === "sin_dato") return `Sin origen${o.confirmed ? " · Confirmado" : ""}${day}`;
  return `Automático · ${SOURCE_LABEL[s.source] ?? s.source}${o.confirmed ? " · Confirmado" : ""}${day}`;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A web value is accepted only when its quote appears literally (ignoring case, accents and punctuation) in the page text. */
export function quoteFound(quote: string | null | undefined, text: string): boolean {
  const q = quote ? norm(quote) : "";
  return q.length >= 8 && norm(text).includes(q);
}

/** Order of sources: Apollo, then Clay, then the company website as the last one. */
export function needsWebFallback(emptyLeft: string[], webAvailable: boolean): boolean {
  return webAvailable && emptyLeft.length > 0;
}
