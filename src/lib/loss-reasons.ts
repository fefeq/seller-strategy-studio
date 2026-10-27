// Why a deal was lost and against whom (SDD-20261027 strategic-suggestions-engine, F0 · H-2). Pure, so the pipeline
// dialog, the agent tool and the later strategy rules read the same list and the same «sin dato» rule.
// The list was validated by Fede on 2026-10-27 (SDD question 5): change it here and, with a new migration, in the
// deals_lost_reason_list check of migration 0068 together.

export const LOSS_REASONS = [
  { key: "price", label: "Precio" },
  { key: "competitor", label: "Competidor" },
  { key: "no_decision", label: "Sin decisión" },
  { key: "no_budget", label: "Sin presupuesto" },
  { key: "no_product_fit", label: "Sin encaje con el producto" },
  { key: "bad_timing", label: "Mal momento" },
  { key: "contact_change", label: "Cambio de contacto" },
  { key: "other", label: "Otro" },
] as const;

export type LossReasonKey = (typeof LOSS_REASONS)[number]["key"];
export const LOSS_REASON_KEYS: readonly string[] = LOSS_REASONS.map((r) => r.key);
export const isLossReason = (v: unknown): v is LossReasonKey =>
  typeof v === "string" && LOSS_REASON_KEYS.includes(v);

export const MAX_DETAIL = 500;
export const MAX_COMPETITOR = 200;
/** A «Competition» note longer than this is a paragraph, not a name worth proposing. */
const MAX_PROPOSED_COMPETITOR = 80;

export const lossLabel = (key: string | null | undefined): string =>
  LOSS_REASONS.find((r) => r.key === key)?.label ?? "Sin dato";

/** The lost stage is the fixed key «lost» (a stage key can never be «lost» or «won» for a custom stage). */
export const isLostStage = (stage: string | null | undefined) => stage === "lost";

/** The loss form opens only when a deal moves into «lost», not when it already was or goes elsewhere. */
export const needsLossPrompt = (target: string, current: string | null | undefined) =>
  isLostStage(target) && !isLostStage(current);

export type LossInput = {
  reason?: string | null;
  detail?: string | null;
  competitor?: string | null;
};
export type LossPatch = {
  lost_reason: LossReasonKey | null;
  lost_reason_detail: string | null;
  lost_competitor: string | null;
};
export type LossParsed = { ok: true; patch: LossPatch } | { ok: false; error: string };

const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

/** Nothing is required (CA-10): an empty form is valid and stores «sin dato». A reason outside the list is not. */
export function parseLoss(input: LossInput): LossParsed {
  const reason = clean(input.reason);
  if (reason !== null && !isLossReason(reason))
    return {
      ok: false,
      error: "Ese motivo no está en la lista. Elige uno de la lista o déjalo en blanco.",
    };
  const detail = clean(input.detail);
  if (detail !== null && detail.length > MAX_DETAIL)
    return { ok: false, error: `El texto libre admite hasta ${MAX_DETAIL} caracteres. Acórtalo.` };
  const competitor = clean(input.competitor);
  if (competitor !== null && competitor.length > MAX_COMPETITOR)
    return {
      ok: false,
      error: `El competidor admite hasta ${MAX_COMPETITOR} caracteres. Acórtalo.`,
    };
  return {
    ok: true,
    patch: {
      lost_reason: reason as LossReasonKey | null,
      lost_reason_detail: detail,
      lost_competitor: competitor,
    },
  };
}

/** The MEDDPICC «Competition» note as a proposal for the competitor field (the person edits or clears it). */
export function competitorFromMeddpicc(
  meddpicc: Record<string, unknown> | null | undefined,
): string | null {
  const c = meddpicc?.competition;
  const text =
    typeof c === "string"
      ? c
      : c && typeof c === "object" && typeof (c as { note?: unknown }).note === "string"
        ? (c as { note: string }).note
        : "";
  const t = text.trim();
  return t && t.length <= MAX_PROPOSED_COMPETITOR ? t : null;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export type LossDeal = {
  stage: string;
  lost_reason?: string | null;
  lost_competitor?: string | null;
};
export type LossBreakdown = {
  /** Lost deals. */
  total: number;
  /** Lost deals with no reason: counted as «sin dato», never guessed. */
  noReason: number;
  byReason: Record<string, number>;
  noCompetitor: number;
  /** Competitors named in lost deals, same name in any case and spacing counted once; most frequent first. */
  byCompetitor: { name: string; count: number }[];
};

export function lossBreakdown(deals: LossDeal[]): LossBreakdown {
  const lost = deals.filter((d) => isLostStage(d.stage));
  const byReason: Record<string, number> = {};
  const comp = new Map<string, { name: string; count: number }>();
  let noReason = 0;
  let noCompetitor = 0;
  for (const d of lost) {
    if (isLossReason(d.lost_reason)) byReason[d.lost_reason] = (byReason[d.lost_reason] ?? 0) + 1;
    else noReason++;
    const name = clean(d.lost_competitor);
    if (!name) {
      noCompetitor++;
      continue;
    }
    const k = norm(name);
    const cur = comp.get(k);
    if (cur) cur.count++;
    else comp.set(k, { name, count: 1 });
  }
  return {
    total: lost.length,
    noReason,
    byReason,
    noCompetitor,
    byCompetitor: [...comp.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    ),
  };
}
