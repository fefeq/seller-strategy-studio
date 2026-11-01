import { employeesText } from "@/lib/icp";
import { FREE_MAIL_DOMAINS } from "./free-mail";
// Lead qualification with Jev (TypeSafe System One): the model only gives typed judgments (ICP fit, buying
// intent, decision power, flags, segment); the weights, thresholds and the proposed stage are code here, so a
// company can change its weights without spending AI again. Pure and tested; the call lives in
// lead-qualify.server.ts, the screens read the stored answers through qualificationView().

export const JEV_MODEL = "typesafe/jev-1.13";

// ---------- Inputs ----------

export type QualLead = {
  company: string;
  contact_name: string | null;
  email: string | null;
  title: string | null;
  source: string | null;
  notes: string | null;
  amount: number | null;
  segment_id: string | null;
};
export type QualAccount = { industry: string | null; size: string | null; country: string | null; notes: string | null; domain: string | null } | null;
export type QualIcp = { name: string; segment_id: string | null; industries: string | null; company_size: string | null; geography: string | null; growth_stage?: string | null; hiring_signals?: string | null; funding_signals?: string | null; anti_icp: string | null; why_fit: string | null; min_employees?: number | null; max_employees?: number | null; countries?: string[] | null; pains?: string | null; target_titles?: string[] | null };
export type QualSegment = { id: string; name: string; acv_min: number | null; acv_max: number | null; notes: string | null };
export type QualPositioning = { product_name: string | null; category: string | null; target_customer: string | null; need: string | null; key_benefit: string | null; best_customers: string | null } | null;

export type QualContext = { lead: QualLead; account: QualAccount; icps: QualIcp[]; segments: QualSegment[]; positioning: QualPositioning };

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n) || null;
const compact = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== "")) as Partial<T>;

export function emailDomainOf(email: string | null | undefined): { domain: string | null; personal: boolean } {
  const d = (email ?? "").toLowerCase().split("@")[1]?.trim() || null;
  return { domain: d, personal: !!d && FREE_MAIL_DOMAINS.has(d) };
}

/** Option ids for the segment Choice: stable per request, mapped back to segment ids by code. */
export const segmentKey = (i: number) => `segmento_${i + 1}`;
export const NO_SEGMENT = "ninguno";

// ---------- Request ----------

export type Question =
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

export const FIT_LEVELS = [
  "Fuera del ICP: sector, tamaño o tipo de empresa que ningún perfil de `icp` cubre, o coincide con un anti-ICP.",
  "Encaje dudoso: comparte algún rasgo con un perfil de `icp` pero falla en otro importante.",
  "Buen encaje: coincide con un perfil de `icp` en sector o tipo de empresa y nada indica que quede fuera.",
  "Encaje claro: coincide con un perfil de `icp` en sector, tamaño y otros rasgos, y es el tipo de cliente que más se beneficia del producto.",
];
export const INTENT_LEVELS = [
  "Sin interés de compra: suscripción a contenido, descarga genérica, evento o ningún mensaje.",
  "Interés temprano: se informa sobre el problema o el tema, sin pedir nada sobre el producto.",
  "Interés activo: pregunta por el producto, precios, una prueba o lo compara con alternativas.",
  "Petición de compra: pide demo, propuesta o reunión comercial, o describe un proyecto con plazo o presupuesto.",
];
export const AUTHORITY_LEVELS = [
  "Sin influencia en la compra: estudiante, becario o cargo sin relación con el área que usaría el producto.",
  "Usuario o influenciador: trabaja en el área afectada pero no decide la compra.",
  "Responsable de área: manager o head que propone y gestiona la compra.",
  "Decisor: dirección general, C-level, fundador o dueño del presupuesto.",
];

/** The state and questions for one lead. Authority is asked only with a job title, the segment only when the lead has none. */
export function buildQualificationRequest(ctx: QualContext) {
  const { lead, account, icps, segments, positioning } = ctx;
  const mail = emailDomainOf(lead.email);
  const state = {
    lead: compact({
      empresa: clip(lead.company, 200),
      contacto: clip(lead.contact_name, 120),
      cargo: clip(lead.title, 160),
      dominio_email: mail.domain ? (mail.personal ? `${mail.domain} (correo personal)` : mail.domain) : null,
      origen: clip(lead.source, 120),
      mensaje_y_notas: clip(lead.notes, 3000),
      valor_estimado: lead.amount ?? null,
    }),
    empresa_del_lead: account ? compact({ sector: clip(account.industry, 200), tamaño: clip(account.size, 120), país: clip(account.country, 80), web: clip(account.domain, 120), descripción: clip(account.notes, 1500) }) : null,
    nuestro_producto: positioning ? compact({ nombre: clip(positioning.product_name, 120), categoría: clip(positioning.category, 200), cliente_objetivo: clip(positioning.target_customer, 600), necesidad: clip(positioning.need, 600), beneficio: clip(positioning.key_benefit, 400), mejores_clientes: clip(positioning.best_customers, 600) }) : null,
    icp: icps.slice(0, 8).map((i) => compact({
      perfil: clip(i.name, 120),
      segmento: segments.find((s) => s.id === i.segment_id)?.name ?? null,
      sectores: clip(i.industries, 400), tamaño: clip(employeesText(i.min_employees, i.max_employees) ?? i.company_size, 200), geografía: clip([i.geography, (i.countries ?? []).join(", ")].filter(Boolean).join(" · ") || null, 200),
      dolores: clip(i.pains ?? null, 400), cargos_objetivo: clip((i.target_titles ?? []).join(", ") || null, 300),
      etapa: clip(i.growth_stage, 200), señales: clip([i.hiring_signals, i.funding_signals].filter(Boolean).join(" · "), 400),
      anti_icp: clip(i.anti_icp, 400), por_qué_encaja: clip(i.why_fit, 400),
    })),
  };

  const questions: Record<string, Question> = {
    enough_info: {
      type: "noul",
      instructions: "¿`lead` y `empresa_del_lead` dicen lo suficiente sobre la empresa (a qué se dedica, su tamaño o su sector) para compararla con los perfiles de `icp`?",
      criteria: { true: "Se sabe a qué se dedica la empresa o su sector o tamaño, por sus datos o por un nombre o web inequívocos.", false: "Solo hay un nombre genérico o un correo personal; no se puede saber qué empresa es ni a qué se dedica." },
    },
    not_buyer: {
      type: "noul",
      instructions: "¿El contacto de `lead` no representa a ninguna empresa que pueda comprar? Fíjate en `lead.empresa`, `lead.contacto`, `lead.dominio_email` y `lead.mensaje_y_notas`. Encajar o no con el ICP no importa aquí.",
      criteria: { true: "Spam, datos de prueba o inventados, estudiante, candidato que busca empleo, proveedor que quiere vendernos algo o competidor.", false: "Una empresa real o alguien que trabaja en una, aunque quede fuera del ICP, falte información o el interés sea bajo." },
    },
    intent: { type: "score", instructions: "¿Cuánta intención de compra muestra el lead según `lead.origen` y `lead.mensaje_y_notas`?", criteria: INTENT_LEVELS },
  };
  if (icps.length) questions.fit = { type: "score", instructions: "¿Cuánto encaja la empresa del lead (`lead`, `empresa_del_lead`) con el mejor de los perfiles de cliente ideal de `icp`? Si falta información, juzga solo con lo que se sabe.", criteria: FIT_LEVELS };
  if (icps.some((i) => i.anti_icp?.trim())) questions.anti_icp = {
    type: "noul",
    instructions: "¿La empresa del lead (`lead`, `empresa_del_lead`) coincide con alguna exclusión escrita en `icp[].anti_icp`?",
    criteria: { true: "Cumple claramente una de las exclusiones del anti-ICP.", false: "No cumple ninguna exclusión, o no hay datos para saberlo." },
  };
  if (lead.title?.trim()) questions.authority = { type: "score", instructions: "¿Cuánto poder de decisión sobre las compras de software de su empresa tiene alguien con el cargo `lead.cargo`?", criteria: AUTHORITY_LEVELS };
  if (!lead.segment_id && segments.length) {
    const criteria: Record<string, string> = {};
    segments.slice(0, 12).forEach((s, i) => {
      const acv = s.acv_min != null || s.acv_max != null ? ` Contratos de ${s.acv_min ?? 0} a ${s.acv_max ?? "sin límite"} al año.` : "";
      criteria[segmentKey(i)] = `Segmento «${s.name}».${acv}${s.notes ? ` ${clip(s.notes, 300)}` : ""}`;
    });
    criteria[NO_SEGMENT] = "No hay datos suficientes para situar a la empresa en un segmento, o no encaja en ninguno.";
    questions.segment = { type: "choice", instructions: "¿En qué segmento de cliente encaja la empresa del lead según su tamaño, sector y el valor estimado (`lead`, `empresa_del_lead`)?", criteria };
  }
  return { model: JEV_MODEL, state, questions };
}

// ---------- Answers ----------

export type ScoreAnswer = { score: number; confidence: number | null; levels: number };
export type Qualification = {
  v: 1;
  at: string;
  fit: ScoreAnswer | null;
  intent: ScoreAnswer;
  authority: ScoreAnswer | null;
  enough_info: number;
  not_buyer: number;
  anti_icp: number | null;
  segment: { id: string | null; confidence: number | null } | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Validates Jev's answers for the questions that were asked; throws (never invents) when one is missing. */
export function parseQualification(req: ReturnType<typeof buildQualificationRequest>, body: unknown, segments: QualSegment[], now = new Date()): Qualification {
  const answers = (body as { answers?: Record<string, Record<string, unknown>> } | null)?.answers;
  if (!answers || typeof answers !== "object") throw new Error("Jev no devolvió respuestas");
  const score = (id: string): ScoreAnswer | null => {
    const q = req.questions[id];
    if (!q) return null;
    const s = num(answers[id]?.score);
    if (s == null) throw new Error(`Falta la respuesta «${id}» de Jev`);
    return { score: s, confidence: num(answers[id]?.confidence), levels: (q as { criteria: string[] }).criteria.length };
  };
  const noul = (id: string): number | null => {
    if (!req.questions[id]) return null;
    const n = num(answers[id]?.noul);
    if (n == null) throw new Error(`Falta la respuesta «${id}» de Jev`);
    return n;
  };
  let segment: Qualification["segment"] = null;
  if (req.questions.segment) {
    const choice = answers.segment?.choice;
    if (typeof choice !== "string") throw new Error("Falta la respuesta «segment» de Jev");
    const idx = choice.startsWith("segmento_") ? Number(choice.slice(9)) - 1 : -1;
    segment = { id: segments[idx]?.id ?? null, confidence: num(answers.segment?.confidence) };
  }
  return {
    v: 1, at: now.toISOString(),
    fit: score("fit"), intent: score("intent")!, authority: score("authority"),
    enough_info: noul("enough_info")!, not_buyer: noul("not_buyer")!, anti_icp: noul("anti_icp"), segment,
  };
}

export function readQualification(v: unknown): Qualification | null {
  const q = v as Qualification | null;
  return q && typeof q === "object" && q.v === 1 && q.intent && typeof q.intent.score === "number" ? q : null;
}

// ---------- Policy (company-editable) ----------

export type QualSettings = { weights: { fit: number; intent: number; authority: number }; mql: number; sql: number };
export const DEFAULT_QUAL_SETTINGS: QualSettings = { weights: { fit: 50, intent: 35, authority: 15 }, mql: 45, sql: 70 };

export function readQualSettings(v: unknown): QualSettings {
  const o = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Partial<QualSettings>;
  const w = (o.weights ?? {}) as Partial<QualSettings["weights"]>;
  const n = (x: unknown, d: number, max = 100) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max ? x : d);
  const weights = { fit: n(w.fit, DEFAULT_QUAL_SETTINGS.weights.fit), intent: n(w.intent, DEFAULT_QUAL_SETTINGS.weights.intent), authority: n(w.authority, DEFAULT_QUAL_SETTINGS.weights.authority) };
  const ok = weights.fit + weights.intent + weights.authority > 0;
  const mql = n(o.mql, DEFAULT_QUAL_SETTINGS.mql);
  const sql = n(o.sql, DEFAULT_QUAL_SETTINGS.sql);
  return { weights: ok ? weights : DEFAULT_QUAL_SETTINGS.weights, mql: Math.min(mql, sql), sql: Math.max(mql, sql) };
}

/** A Score on a 0–1 scale (score / (levels − 1)), the only form that is combined with weights. */
export const norm = (a: ScoreAnswer) => (a.levels > 1 ? Math.max(0, Math.min(1, a.score / (a.levels - 1))) : 0);

export const FLAG_AT = 0.7;
export const ENOUGH_INFO_AT = 0.5;
const LOW_CONFIDENCE = 0.35;
const OPEN_ORDER = ["new", "contacted", "mql", "sql"];

export type Proposal = "disqualified" | "sql" | "mql" | "new";
export const PROPOSAL_LABEL: Record<Proposal, string> = { disqualified: "Descartar", sql: "SQL", mql: "MQL", new: "Nutrir" };

export type QualView = {
  /** 0–100 over the dimensions that could be judged. */
  total: number;
  fitKnown: boolean;
  parts: { id: "fit" | "intent" | "authority"; label: string; value: number | null; level: string | null; weight: number }[];
  proposal: Proposal;
  reason: string;
  /** Stage to move to now, only when it is a step forward from the current stage (or a discard of an open lead). */
  move: "disqualified" | "sql" | "mql" | null;
  /** Segment proposed for a lead without one, when Jev picked one with some confidence. */
  segmentId: string | null;
  review: boolean;
};

const levelOf = (a: ScoreAnswer, levels: string[]) => levels[Math.max(0, Math.min(levels.length - 1, Math.round(a.score)))].split(":")[0];

export function qualificationView(q: Qualification, settings: QualSettings, currentStage: string): QualView {
  const fitKnown = !!q.fit && q.enough_info >= ENOUGH_INFO_AT;
  const parts: QualView["parts"] = [
    { id: "fit", label: "Encaje con el ICP", value: fitKnown ? Math.round(norm(q.fit!) * 100) : null, level: fitKnown ? levelOf(q.fit!, FIT_LEVELS) : null, weight: settings.weights.fit },
    { id: "intent", label: "Intención de compra", value: Math.round(norm(q.intent) * 100), level: levelOf(q.intent, INTENT_LEVELS), weight: settings.weights.intent },
    { id: "authority", label: "Poder de decisión", value: q.authority ? Math.round(norm(q.authority) * 100) : null, level: q.authority ? levelOf(q.authority, AUTHORITY_LEVELS) : null, weight: settings.weights.authority },
  ];
  const used = parts.filter((p) => p.value != null && p.weight > 0);
  const wsum = used.reduce((s, p) => s + p.weight, 0);
  const total = wsum ? Math.round(used.reduce((s, p) => s + p.value! * p.weight, 0) / wsum) : 0;

  let proposal: Proposal;
  let reason: string;
  if (q.not_buyer >= FLAG_AT) { proposal = "disqualified"; reason = "No parece un comprador real (spam, prueba, candidato, proveedor o competidor)."; }
  else if (q.anti_icp != null && q.anti_icp >= FLAG_AT) { proposal = "disqualified"; reason = "Coincide con el anti-ICP."; }
  else if (fitKnown && norm(q.fit!) < 0.2) { proposal = "disqualified"; reason = "Queda fuera del ICP."; }
  else if (total >= settings.sql && fitKnown && norm(q.intent) >= 0.5) { proposal = "sql"; reason = `Calificación ${total} y pide hablar del producto.`; }
  else if (total >= settings.mql) { proposal = "mql"; reason = fitKnown ? `Calificación ${total}.` : `Calificación ${total}, sin datos para medir el encaje: como mucho MQL.`; }
  else { proposal = "new"; reason = `Calificación ${total}: aún no merece una llamada; nútrelo.`; }
  // Without known fit a lead never goes straight to SQL (the branch above already needs fitKnown).

  const cur = OPEN_ORDER.indexOf(currentStage);
  let move: QualView["move"] = null;
  if (cur >= 0) {
    if (proposal === "disqualified") move = "disqualified";
    else if (proposal !== "new" && OPEN_ORDER.indexOf(proposal) > cur) move = proposal;
  }
  const flagsUnsure = [q.not_buyer, q.anti_icp ?? 0].some((n) => n > 0.35 && n < FLAG_AT);
  const confs = [fitKnown ? q.fit?.confidence : null, q.intent.confidence, q.authority?.confidence].filter((c): c is number => c != null);
  const review = flagsUnsure || confs.some((c) => c < LOW_CONFIDENCE);
  const segmentId = q.segment?.id && (q.segment.confidence ?? 0) >= 0.4 ? q.segment.id : null;
  return { total, fitKnown, parts, proposal, reason, move, segmentId, review };
}
