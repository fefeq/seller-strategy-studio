// From gtm-lab@44f385b scripts/eval-checks.mjs, typed for TypeScript; same rules (NK-0048 CA-13).
// Free, automatic checks for the AI suggestion eval (SDD usuarios-reales, part B). Each returns a list of
// problems: empty means it passes. `validate` is injected so the eval can use the same bundle as the function.

/** Every string in the output, in reading order (lists and nested items included). */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

// A whole number, with Spanish thousands separators (1.500) or a decimal part; not digits inside a word (B2B).
const NUMBER = /(?<![\p{L}\d.,])(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?!\d)/gu;
const normalize = (n: string) =>
  (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(n) ? n.replaceAll(".", "") : n).replace(",", ".");

const PROPOSAL = /\[propuesta:[^\]]*\]/giu;

export interface ModelOutcome {
  stopReason: string | null;
  output: unknown;
}

/** The model finished normally and its JSON parsed. A refusal or a cut answer fails the case. */
export function finished(result: ModelOutcome): string[] {
  if (result.stopReason !== "end_turn") return [`stop_reason: ${result.stopReason}`];
  if (result.output === null || typeof result.output !== "object") return ["sin JSON válido"];
  return [];
}

/** The options of every select in a JSON schema: the form fixes them, so the model never invents their figures. */
export function optionsText(schema: unknown): string {
  const found: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.enum))
      found.push(...record.enum.filter((o): o is string => typeof o === "string"));
    for (const child of Object.values(record)) visit(child);
  };
  visit(schema);
  return found.join("\n");
}

/** Figures in the answer that appear nowhere in what the model received. */
export function inventedNumbers(output: unknown, source: string): string[] {
  const known = new Set((source.match(NUMBER) ?? []).map(normalize));
  const found: string[] = [];
  for (const raw of strings(output)) {
    // Figures the model marks as its own proposal are allowed (SDD instrucciones-ia).
    const text = raw.replace(PROPOSAL, " ");
    for (const match of text.matchAll(NUMBER)) {
      // Enumeration markers, «(1)» or «2)», are not figures: one digit, closing a parenthesis.
      const index = match.index ?? 0;
      const before = text[index - 1];
      const marker = /^[1-9]$/.test(match[0]) && text[index + 1] === ")";
      if (marker && (before === undefined || before === "(" || /\s/.test(before))) continue;
      const value = normalize(match[0]);
      if (!known.has(value) && !found.includes(value)) found.push(value);
    }
  }
  return found;
}

// Common voseo forms; a closed list, because endings like -ás or -é also match ordinary words (más, después).
const VOSEO = new Set(
  "vos tenés podés querés sabés hacés sos decís vení mirá fijate empezá probá elegí escribí contá necesitás vendés usás pensá definí armá hablá poné andá tomá buscá revisá preguntá medí validá enfocate acordate".split(
    " ",
  ),
);
const EN = new Set("the and with for your you to of is are this that from".split(" "));
const ES = new Set("el la de que y en los las con para por un una tu tus del".split(" "));

/** Spanish, addressing the founder as «tú»: no «usted», no voseo, not English. */
export function languageIssues(output: unknown): string[] {
  const issues: string[] = [];
  const words = strings(output).flatMap((t) => t.match(/\p{L}+/gu) ?? []);
  for (const word of words) {
    const lower = word.toLowerCase();
    if (lower === "usted" || lower === "ustedes") issues.push(`usted: «${word}»`);
    else if (VOSEO.has(lower)) issues.push(`voseo: «${word}»`);
  }
  // Field by field, so one English field inside a Spanish answer is not hidden by the rest.
  const english = strings(output).some((text) => {
    const fieldWords = (text.match(/\p{L}+/gu) ?? []).map((w) => w.toLowerCase());
    const en = fieldWords.filter((w) => EN.has(w)).length;
    return en >= 3 && en > fieldWords.filter((w) => ES.has(w)).length;
  });
  if (english) issues.push("idioma: parece inglés");
  return issues;
}

// AI filler in Spanish B2B copy (Fede, 2026-11-01: «que no haya ai slop ni ai smell»). Each pattern is reported
// once, at its first match. Letter boundaries instead of \b, which does not handle accented letters.
const W = (body: string) => new RegExp(`(?<!\\p{L})(?:${body})(?!\\p{L})`, "giu");
const SLOP: { re: RegExp; label?: (m: string) => string }[] = [
  { re: W("revolucion(?:a|an|amos|ar|ando|ario|aria|arios|arias)") },
  { re: W("disrupt\\p{L}*") },
  { re: W("(?:de vanguardia|vanguardista)") },
  { re: W("(?:al|el) siguiente nivel|a otro nivel") },
  { re: W("desbloque\\p{L}*") },
  { re: W("sinergias?") },
  { re: W("empoder\\p{L}*") },
  { re: W("innovador(?:a|es|as)?") },
  // The verb only ("potencia a tu equipo"), not the noun ("una potencia de 5 kW").
  { re: W("potenci(?:a|an|ar|amos|ando)(?= (?:a|al|la|las|el|los|tu|tus|su|sus)(?!\\p{L}))") },
  { re: W("soluci[oó]n integral|todo en uno") },
  { re: W("experiencia (?:fluida|perfecta|única|inigualable)") },
  { re: W("sin fisuras|sin precedentes|inigualable|de primer nivel|de clase mundial") },
  { re: W("(?:cambia|cambiar|cambiará) las reglas del juego") },
  { re: W("en el mundo actual|en la era digital|hoy en día|en un mundo (?:cada vez más|donde)") },
  {
    re: W(
      "cabe destacar|es importante (?:destacar|señalar|recordar)|vale la pena destacar|en resumen|en definitiva",
    ),
  },
  { re: W("no s[oó]lo[^.;]*?sino (?:también|que)"), label: () => "«no solo… sino también»" },
  { re: /—/gu, label: () => "raya «—»" },
  { re: /¡/gu, label: () => "exclamación «¡»" },
  { re: /(?![©®™])\p{Extended_Pictographic}/gu, label: (m) => `emoji «${m}»` },
];

/** Stock phrases, buzzwords and typography that make a suggestion read as machine-written. */
export function slopIssues(output: unknown): string[] {
  const issues: string[] = [];
  const seen = new Set<number>();
  for (const text of strings(output)) {
    const hits: { i: number; index: number; text: string }[] = [];
    SLOP.forEach((pattern, i) => {
      if (seen.has(i)) return;
      const match = [...text.matchAll(pattern.re)][0];
      if (match)
        hits.push({
          i,
          index: match.index ?? 0,
          text: pattern.label ? pattern.label(match[0]) : `«${match[0]}»`,
        });
    });
    for (const hit of hits.sort((a, b) => a.index - b.index)) {
      seen.add(hit.i);
      issues.push(hit.text);
    }
  }
  return issues;
}

// Copy meant to be published as is (core message): no brackets at all.
const PUBLISHED = ["headline", "message"];

/** At most one check note («[Comprueba: …]» or any other bracket that is not a proposal), none in published copy. */
export function checkNotes(output: unknown): string[] {
  const issues: string[] = [];
  const notes = strings(output).flatMap((text) =>
    (text.match(/\[[^\]]*\]/gu) ?? []).filter((b) => !/^\[propuesta:/iu.test(b)),
  );
  if (notes.length > 1) issues.push(`${notes.length} avisos «[Comprueba…]» (máximo 1)`);
  const record = output && typeof output === "object" ? (output as Record<string, unknown>) : {};
  for (const key of PUBLISHED) {
    const value = record[key];
    if (typeof value === "string" && /[[\]]/u.test(value)) issues.push(`corchetes en «${key}»`);
  }
  return issues;
}

export interface Checks {
  finished: string[];
  valid: string[];
  numbers: string[];
  language: string[];
  slop: string[];
  notes: string[];
}

export type Validate = (output: Record<string, unknown>) => { label: string; message: string }[];

/** All free checks for one case. `source` is everything the model received (system and user text). */
export function runChecks({
  validate,
  source,
  result,
}: {
  validate: Validate;
  source: string;
  result: ModelOutcome;
}): { checks: Checks; pass: boolean } {
  const stop = finished(result);
  if (stop.length)
    return {
      checks: { finished: stop, valid: [], numbers: [], language: [], slop: [], notes: [] },
      pass: false,
    };
  const checks: Checks = {
    finished: [],
    // finished() above guarantees a non-null object.
    valid: validate(result.output as Record<string, unknown>).map(
      (e) => `${e.label}: ${e.message}`,
    ),
    numbers: inventedNumbers(result.output, source),
    language: languageIssues(result.output),
    slop: slopIssues(result.output),
    notes: checkNotes(result.output),
  };
  return { checks, pass: Object.values(checks).every((list) => list.length === 0) };
}

/** Refusals and cut answers are counted apart for the threshold of criterio.md §5 (none allowed). */
export function isRefusalOrCut(stopReason: string | null): boolean {
  return stopReason !== "end_turn";
}
