// Strategic suggestions (SDD-20261027 strategic-suggestions-engine, F0 · H-1). Pure: what a suggestion stores (element,
// kind, evidence with a link per source record, evidence level, proposed action), the fixed level rule, the decision
// record and when a suggestion is shown again. No AI: titles and bodies come from templates in the detectors (F1).
// The data lives in suggestions.strategy (jsonb, validated by the database too, migration 0068) so the existing table,
// RLS and dedupe key (org_id, dedupe_key) are reused; decisions go to strategy_decisions.
import type { Suggestion } from "@/lib/proactive/types";

export const STRATEGY_ELEMENTS = ["icp", "segment", "positioning", "competitor", "product_price", "pipeline", "experiment"] as const;
export type StrategyElement = (typeof STRATEGY_ELEMENTS)[number];
export const STRATEGY_KINDS = ["create", "change", "validate", "close", "missing_data"] as const;
export type StrategyKind = (typeof STRATEGY_KINDS)[number];
export const STRATEGY_ACTIONS = ["strategy_change", "experiment", "commercial_action", "data_to_complete"] as const;
export type StrategyAction = (typeof STRATEGY_ACTIONS)[number];
export type EvidenceLevel = "low" | "medium" | "high";

export type EvidenceItem = { table: string; id: string; label: string; link: string };
export type StrategyMeta = {
  element: StrategyElement;
  kind: StrategyKind;
  evidence: EvidenceItem[];
  evidence_level: EvidenceLevel;
  /** Records of the company the rule looked at; may be larger than the evidence list shown. */
  sample_size: number;
  action_type: StrategyAction;
  /** Hash of the evidence records: when it changes, a dismissed or postponed suggestion has new evidence (CA-5, CA-6). */
  fingerprint: string;
};
export type StrategySuggestion = Suggestion & { strategy: StrategyMeta };

export const MAX_OPEN_STRATEGY = 7;
export const MAX_REASON = 500;
export const POSTPONE_DAYS = 3;
const DAY = 86_400_000;

/** Fixed, visible rule (validated by Fede on 2026-10-27): low under 5 source records, medium 5 to 9, high from 10. */
export const evidenceLevel = (sample: number): EvidenceLevel => (sample >= 10 ? "high" : sample >= 5 ? "medium" : "low");
export const EVIDENCE_LEVEL_RULE = "Baja: menos de 5 registros de origen. Media: de 5 a 9. Alta: 10 o más.";
export const levelLabel = (l: EvidenceLevel) => ({ low: "Baja", medium: "Media", high: "Alta" })[l];
export const sampleLabel = (n: number) => (n <= 0 ? "Sin registros de origen" : `Muestra: ${n} ${n === 1 ? "registro" : "registros"}`);

export const ELEMENT_LABEL: Record<StrategyElement, string> = { icp: "ICP", segment: "Segmento", positioning: "Posicionamiento", competitor: "Competidor", product_price: "Producto y precio", pipeline: "Pipeline", experiment: "Experimento" };
export const KIND_LABEL: Record<StrategyKind, string> = { create: "Crear", change: "Cambiar", validate: "Validar", close: "Cerrar", missing_data: "Falta dato" };
export const ACTION_LABEL: Record<StrategyAction, string> = { strategy_change: "Cambio de estrategia", experiment: "Prueba", commercial_action: "Acción comercial", data_to_complete: "Dato a completar" };
/** Status words for the six states of the SDD; «Aplicada» arrives with F3 (no stored status yet). */
export const STRATEGY_STATUS_LABEL: Record<string, string> = { pending: "Nueva", approved: "Aceptada", snoozed: "Pospuesta", dismissed: "Descartada", resolved: "Resuelta" };

/** Heading of a card: the element and the kind; with nothing to recommend from the kind reads «Falta dato» (CA-2). */
export const strategyHeading = (m: Pick<StrategyMeta, "element" | "kind">) => `${ELEMENT_LABEL[m.element]} · ${KIND_LABEL[m.kind]}`;

/** Where a source record is opened. A table not listed here must bring its own link. */
export function evidenceLink(table: string, id: string): string | null {
  switch (table) {
    case "deals": return `/deals?deal=${id}`;
    case "accounts": return `/accounts/${id}`;
    case "leads": return `/leads?lead=${id}`;
    case "icp_profiles": return "/strategy?tab=icp";
    case "segments": return "/strategy?tab=motions";
    case "positioning": return "/strategy?tab=positioning";
    case "messaging_pillars": return "/strategy?tab=pillars";
    case "products": return "/products";
    case "gtm_experiments": return "/theory-u";
    default: return null;
  }
}

/** 32-bit FNV-1a over the sorted, de-duplicated «table:id» of the evidence: same records, same fingerprint. */
export function evidenceFingerprint<T extends { table: string; id: string }>(evidence: T[]): string {
  const keys = [...new Set(evidence.map((e) => `${e.table}:${e.id}`))].sort().join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < keys.length; i++) { h ^= keys.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

export type StrategyInput = {
  element: StrategyElement;
  kind: StrategyKind;
  action_type: StrategyAction;
  /** Cause inside the element; with the element it forms the dedupe key, so a dismissal never returns for the same cause. */
  cause: string;
  priority: 1 | 2 | 3;
  title: string;
  body: string;
  evidence: { table: string; id: string; label: string; link?: string }[];
  /** Records examined, when more than the evidence listed. */
  sample_size?: number;
  link?: string | null;
};

/**
 * CA-1..CA-3: stores element, kind, evidence with a link per record, level from the fixed rule, action and priority.
 * Without any evidence the suggestion is only «falta dato» (CA-2), whatever kind and action the rule asked for.
 */
export function buildStrategySuggestion(i: StrategyInput): StrategySuggestion {
  const seen = new Set<string>();
  const evidence: EvidenceItem[] = [];
  for (const e of i.evidence) {
    const k = `${e.table}:${e.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const link = e.link ?? evidenceLink(e.table, e.id);
    if (!link) throw new Error(`Falta el enlace al registro de origen de «${e.table}»: una fuente sin enlace conocido debe traer el suyo.`);
    evidence.push({ table: e.table, id: e.id, label: e.label, link });
  }
  const sample = i.sample_size ?? evidence.length;
  if (sample < evidence.length) throw new Error("El tamaño de la muestra no puede ser menor que la evidencia citada.");
  const none = evidence.length === 0;
  const strategy: StrategyMeta = {
    element: i.element,
    kind: none ? "missing_data" : i.kind,
    evidence,
    evidence_level: evidenceLevel(sample),
    sample_size: sample,
    action_type: none ? "data_to_complete" : i.action_type,
    fingerprint: evidenceFingerprint(evidence),
  };
  return { detector: `strategy_${i.element}`, dedupe_key: `strategy_${i.element}:${i.cause}`, priority: i.priority, title: i.title, body: i.body, link: i.link ?? null, action: null, user_id: null, strategy };
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Reads a stored strategy value; null when anything of CA-1..CA-3 is missing or inconsistent (the database refuses the same). */
export function parseStrategy(v: unknown): StrategyMeta | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  if (!(STRATEGY_ELEMENTS as readonly unknown[]).includes(m.element) || !(STRATEGY_KINDS as readonly unknown[]).includes(m.kind) || !(STRATEGY_ACTIONS as readonly unknown[]).includes(m.action_type)) return null;
  if (!Array.isArray(m.evidence)) return null;
  const evidence: EvidenceItem[] = [];
  for (const e of m.evidence) {
    const x = e as Record<string, unknown> | null;
    if (!x || !isStr(x.table) || !isStr(x.id) || !isStr(x.label) || !isStr(x.link)) return null;
    evidence.push({ table: x.table, id: x.id, label: x.label, link: x.link });
  }
  const n = m.sample_size;
  if (typeof n !== "number" || !Number.isInteger(n) || n < evidence.length) return null;
  if (m.evidence_level !== evidenceLevel(n)) return null;
  if (evidence.length === 0 && (m.kind !== "missing_data" || m.action_type !== "data_to_complete")) return null;
  if (!isStr(m.fingerprint)) return null;
  return { element: m.element as StrategyElement, kind: m.kind as StrategyKind, evidence, evidence_level: m.evidence_level as EvidenceLevel, sample_size: n, action_type: m.action_type as StrategyAction, fingerprint: m.fingerprint };
}

// ---- Decisions (CA-4) ----

export type StrategyDecision = "accept" | "postpone" | "dismiss";
export type DecisionInput = { decision: StrategyDecision; by: string; now: Date; fingerprint: string; reason?: string | null; remindAt?: Date | null };
export type DecisionRecord = {
  decision: "accepted" | "postponed" | "dismissed";
  /** New status of the suggestion row. */
  status: "approved" | "snoozed" | "dismissed";
  decided_by: string;
  decided_at: string;
  reason: string | null;
  remind_at: string | null;
  evidence_fingerprint: string;
};

export function decisionRecord(i: DecisionInput): DecisionRecord {
  const reason = (i.reason ?? "").trim() || null;
  if (reason && reason.length > MAX_REASON) throw new Error(`El motivo admite hasta ${MAX_REASON} caracteres. Acórtalo.`);
  const base = { decided_by: i.by, decided_at: i.now.toISOString(), reason, evidence_fingerprint: i.fingerprint };
  if (i.decision === "accept") return { ...base, decision: "accepted", status: "approved", remind_at: null };
  if (i.decision === "dismiss") return { ...base, decision: "dismissed", status: "dismissed", remind_at: null };
  return { ...base, decision: "postponed", status: "snoozed", remind_at: (i.remindAt ?? new Date(i.now.getTime() + POSTPONE_DAYS * DAY)).toISOString() };
}

// ---- Visibility and re-evaluation (CA-5, CA-6, CA-7) ----

export type StrategyRow = {
  id: string;
  dedupe_key: string;
  status: string;
  priority: number;
  created_at: string;
  snoozed_until: string | null;
  strategy: StrategyMeta;
  /** Fingerprint recorded with the last decision, when there is one. */
  decided_fingerprint: string | null;
  title?: string;
  body?: string;
};

/** Shown while new, or postponed and past its reminder date. Dismissed, accepted and resolved are never shown as open. */
export function isVisible(r: Pick<StrategyRow, "status" | "snoozed_until">, now: Date): boolean {
  if (r.status === "pending") return true;
  if (r.status === "snoozed") return r.snoozed_until !== null && new Date(r.snoozed_until).getTime() <= now.getTime();
  return false;
}

/** CA-7: at most 7 open strategic suggestions, most urgent first, newest first inside a priority. */
export function openStrategy<T extends Pick<StrategyRow, "status" | "snoozed_until" | "priority" | "created_at">>(rows: T[], now: Date, max = MAX_OPEN_STRATEGY): T[] {
  return rows
    .filter((r) => isVisible(r, now))
    .sort((a, b) => a.priority - b.priority || b.created_at.localeCompare(a.created_at))
    .slice(0, max);
}

/**
 * CA-7 on a mixed list (the screen reads operational and strategic suggestions together): keeps every operational one and the
 * strategic ones that fit the cap, in the order received.
 */
export function limitStrategy<T extends { id: string; strategy?: unknown; status?: string; snoozed_until?: string | null; priority: number; created_at: string }>(rows: T[], now: Date, max = MAX_OPEN_STRATEGY): T[] {
  const strategic = rows.filter((r) => parseStrategy(r.strategy));
  const keep = new Set(openStrategy(strategic.map((r) => ({ id: r.id, status: r.status ?? "pending", snoozed_until: r.snoozed_until ?? null, priority: r.priority, created_at: r.created_at })), now, max).map((r) => r.id));
  return rows.filter((r) => !parseStrategy(r.strategy) || keep.has(r.id));
}

export type Reconciled =
  | { action: "insert" }
  | { action: "keep" }
  | { action: "refresh"; patch: { strategy: StrategyMeta; title: string; body: string; priority: number } }
  | { action: "reopen"; patch: { status: "pending"; snoozed_until: null; strategy: StrategyMeta; title: string; body: string; priority: number } };

/**
 * CA-5: «new evidence» means a record that was not behind the decision. A changed fingerprint is not enough: when records
 * drop out (a deal deleted, an account that no longer fits) the fingerprint changes too, and that must not wake the suggestion.
 */
function hasNewEvidence(existing: StrategyRow, found: StrategySuggestion): boolean {
  if (found.strategy.fingerprint === (existing.decided_fingerprint ?? existing.strategy.fingerprint)) return false;
  const before = new Set(existing.strategy.evidence.map((e) => `${e.table}:${e.id}`));
  return found.strategy.evidence.some((e) => !before.has(`${e.table}:${e.id}`));
}

/**
 * What to do when a detector finds a suggestion again. A dismissed or postponed one stays as it is unless its evidence
 * changed since the decision (CA-5, CA-6); an accepted one is never touched; an open one only refreshes its evidence.
 */
export function reconcile(existing: StrategyRow | null, found: StrategySuggestion, _now: Date): Reconciled {
  if (!existing) return { action: "insert" };
  const patch = { strategy: found.strategy, title: found.title, body: found.body, priority: found.priority };
  switch (existing.status) {
    case "approved": return { action: "keep" };
    case "dismissed":
    case "snoozed":
      return hasNewEvidence(existing, found) ? { action: "reopen", patch: { status: "pending", snoozed_until: null, ...patch } } : { action: "keep" };
    case "resolved": return { action: "reopen", patch: { status: "pending", snoozed_until: null, ...patch } };
    default: return found.strategy.fingerprint === existing.strategy.fingerprint ? { action: "keep" } : { action: "refresh", patch };
  }
}

/** A price suggestion (product_price with the «price:» cause) is only for roles that may see prices (CA-19, same roles as canPrice). */
export const needsPriceAccess = (r: { detector?: string | null; dedupe_key?: string | null }) =>
  r.detector === "strategy_product_price" && (r.dedupe_key ?? "").startsWith("strategy_product_price:price:");
export const PRICE_ROLES = ["owner", "sales_leader", "deal_desk"] as const;
export const canViewStrategy = <T extends { detector?: string | null; dedupe_key?: string | null }>(r: T, roles: readonly string[]): boolean =>
  !needsPriceAccess(r) || roles.some((x) => (PRICE_ROLES as readonly string[]).includes(x));
