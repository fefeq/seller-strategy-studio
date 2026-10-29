// AI strategic review (SDD-20261027 strategic-suggestions-engine, F4 · H-6). Pure: what the model reads (anonymised records
// with a reference each), the prompt, the answer schema, and how the answer becomes strategic suggestions. The model can only
// cite the references it was given, so every piece of evidence is a real record with its link (CA-41); it never receives
// client or interviewee names (CA-48); a missing figure is «sin dato», never an estimate (CA-42). The call itself lives in
// strategy-review-core.ts.
import {
  buildStrategySuggestion,
  evidenceLink,
  STRATEGY_ACTIONS,
  STRATEGY_ELEMENTS,
  STRATEGY_KINDS,
  type StrategyAction,
  type StrategyElement,
  type StrategyKind,
  type StrategySuggestion,
} from "@/lib/strategy-suggestions";

export const MAX_REVIEW = 7;
export const MAX_SOURCES = 300;
export type ReviewMode = "normal" | "critical";
export type ReviewDepth = "low" | "medium";

/** One record the review reads. `label` is shown to people who may see it; the model never gets it. */
export type ReviewSource = {
  table: string;
  id: string;
  label: string;
  /** Anonymised descriptors: sector, stage, amounts, short notes. Names inside free text are removed before sending. */
  facts: Record<string, string | number | boolean | null>;
  /** Names that appear in the facts (client, person) and must not reach the model or the result. */
  names?: string[];
  link?: string;
};

/** What the review reads today; a kind without records is reported as «sin dato». Competitors and connected real metrics
 *  (CA-40) have no loader yet: they are not listed here so the model is never told they are absent when they only are not read. */
export const REVIEW_TABLES = [
  "icp_profiles",
  "segments",
  "positioning",
  "messaging_pillars",
  "products",
  "deals",
  "leads",
  "meetings",
  "account_signals",
  "sensing_notes",
  "gtm_experiments",
] as const;

const NAME_MASK = "[nombre]";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function redactNames(text: string, names: readonly string[]): string {
  let out = text;
  for (const n of [...new Set(names.map((x) => x.trim()).filter((x) => x.length >= 2))].sort(
    (a, b) => b.length - a.length,
  ))
    out = out.replace(new RegExp(escapeRe(n), "gi"), NAME_MASK);
  return out;
}

export type ReviewPayload = {
  registros: {
    ref: string;
    tabla: string;
    datos: Record<string, string | number | boolean | null>;
  }[];
  sin_dato: string[];
  omitidos: number;
};
export type RefMap = Map<string, { table: string; id: string; label: string; link: string | null }>;

export function buildReviewInput(sources: ReviewSource[]): {
  payload: ReviewPayload;
  refs: RefMap;
  names: string[];
} {
  const used = sources.slice(0, MAX_SOURCES);
  const names = used.flatMap((s) => s.names ?? []);
  const refs: RefMap = new Map();
  const registros = used.map((s, i) => {
    const ref = `R${i + 1}`;
    refs.set(ref, {
      table: s.table,
      id: s.id,
      label: s.label,
      link: s.link ?? evidenceLink(s.table, s.id),
    });
    const datos = Object.fromEntries(
      Object.entries(s.facts).map(([k, v]) => [
        k,
        typeof v === "string" ? redactNames(v, s.names ?? names) : v,
      ]),
    );
    return { ref, tabla: s.table, datos };
  });
  const present = new Set(used.map((s) => s.table));
  return {
    payload: {
      registros,
      sin_dato: REVIEW_TABLES.filter((t) => !present.has(t)),
      omitidos: Math.max(0, sources.length - used.length),
    },
    refs,
    names: [...new Set(names)],
  };
}

/** 32-bit FNV-1a, same family as the evidence fingerprint. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
/** CA-44: same data, mode and depth → same fingerprint → the stored review is reused. */
export const inputFingerprint = (p: ReviewPayload, mode: ReviewMode, depth: ReviewDepth) =>
  fnv(`${mode}|${depth}|${JSON.stringify(p)}`);

const BASE = [
  "Eres un revisor estratégico de go-to-market B2B. Revisas la estrategia de la empresa con SOLO los registros que recibes (cada uno lleva una referencia R1, R2…).",
  "Reglas: español neutro (tú), sin signos de exclamación ni emoji. Cada sugerencia cita en evidence_refs las referencias que la sostienen y solo esas; no inventes referencias.",
  "Si falta una cifra, ponla en missing y escribe «sin dato»: no la estimes ni uses benchmarks externos que no figuren en los registros. La lista sin_dato indica qué tipos de dato no existen.",
  "No escribas nombres de clientes ni de personas: los registros están anonimizados y debes mantenerlos así.",
  "Cada sugerencia: elemento de estrategia, tipo, acción propuesta, prioridad (1 = la primera), título corto, cuerpo con la cifra concreta que la motiva, y invalidates_if con el dato que la haría falsa.",
  "Devuelve como máximo 7 sugerencias, ordenadas por impacto. Si no hay base suficiente, devuelve menos, no rellenes.",
].join(" ");
const CRITICAL =
  " Modo revisión crítica: prioriza los supuestos débiles (lo declarado sin evidencia observada) y las contradicciones entre lo declarado (ICP, posicionamiento, segmentos) y lo observado (deals, pérdidas, llamadas, señales).";
export const reviewPrompt = (mode: ReviewMode) => (mode === "critical" ? BASE + CRITICAL : BASE);

export const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      maxItems: MAX_REVIEW,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "element",
          "kind",
          "action_type",
          "priority",
          "title",
          "body",
          "evidence_refs",
          "invalidates_if",
          "missing",
        ],
        properties: {
          element: { type: "string", enum: [...STRATEGY_ELEMENTS] },
          kind: { type: "string", enum: [...STRATEGY_KINDS] },
          action_type: { type: "string", enum: [...STRATEGY_ACTIONS] },
          priority: { type: "integer", enum: [1, 2, 3] },
          title: { type: "string" },
          body: { type: "string" },
          evidence_refs: { type: "array", items: { type: "string" } },
          invalidates_if: { type: "string" },
          missing: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

type RawItem = {
  element?: unknown;
  kind?: unknown;
  action_type?: unknown;
  priority?: unknown;
  title?: unknown;
  body?: unknown;
  evidence_refs?: unknown;
  invalidates_if?: unknown;
  missing?: unknown;
};
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const REVIEW_ERROR = "La IA no devolvió una respuesta válida.";

/** CA-40/41/42/48: validates the answer, keeps only suggestions with real evidence, caps at 7 and masks names. */
export function parseReview(
  raw: string,
  refs: RefMap,
  names: readonly string[],
): { suggestions: StrategySuggestion[]; discarded: number } {
  let json: { suggestions?: unknown };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(REVIEW_ERROR);
  }
  if (!json || !Array.isArray(json.suggestions)) throw new Error(REVIEW_ERROR);
  const out: StrategySuggestion[] = [];
  let discarded = 0;
  const seen = new Set<string>();
  for (const it of json.suggestions as RawItem[]) {
    if (
      !it ||
      !oneOf(STRATEGY_ELEMENTS, it.element) ||
      !oneOf(STRATEGY_KINDS, it.kind) ||
      !oneOf(STRATEGY_ACTIONS, it.action_type)
    ) {
      discarded++;
      continue;
    }
    const title = redactNames(str(it.title, 160), names);
    if (!title) {
      discarded++;
      continue;
    }
    const evidence = (Array.isArray(it.evidence_refs) ? it.evidence_refs : [])
      .map((r) => (typeof r === "string" ? refs.get(r.trim()) : undefined))
      .filter((r): r is NonNullable<typeof r> => !!r && !!r.link)
      .map((r) => ({ table: r.table, id: r.id, label: r.label, link: r.link as string }));
    if (!evidence.length) {
      discarded++;
      continue;
    }
    const missing = (Array.isArray(it.missing) ? it.missing : [])
      .map((m) => redactNames(str(m, 120), names))
      .filter(Boolean);
    const inval = redactNames(str(it.invalidates_if, 300), names);
    const body = [
      redactNames(str(it.body, 800), names),
      missing.length ? `Sin dato: ${missing.join("; ")}.` : "",
      inval ? `Lo invalidaría: ${inval}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const priority = it.priority === 1 || it.priority === 3 ? it.priority : 2;
    const built = buildStrategySuggestion({
      element: it.element as StrategyElement,
      kind: it.kind as StrategyKind,
      action_type: it.action_type as StrategyAction,
      cause: `review:${fnv(`${it.element}|${title.toLowerCase()}`)}`,
      priority,
      title,
      body,
      evidence,
    });
    if (seen.has(built.dedupe_key)) continue;
    seen.add(built.dedupe_key);
    out.push(built);
  }
  out.sort((a, b) => a.priority - b.priority);
  discarded += Math.max(0, out.length - MAX_REVIEW);
  return { suggestions: out.slice(0, MAX_REVIEW), discarded };
}

/** CA-47: an AI suggestion about an element that already has an open fixed suggestion is not shown twice. */
export function dedupeAgainstFixed<T extends { strategy: { element: string } }>(
  ai: T[],
  openFixed: { dedupe_key: string; strategy: { element: string } }[],
): T[] {
  const taken = new Set(
    openFixed.filter((f) => !f.dedupe_key.includes(":review:")).map((f) => f.strategy.element),
  );
  return ai.filter((s) => !taken.has(s.strategy.element));
}
