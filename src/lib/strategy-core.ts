// Writes of strategic suggestions (SDD-20261027 strategic-suggestions-engine, F0 · H-1): recording a decision and
// re-evaluating what a detector finds again. Takes the client and the company explicitly, like the agent tools, because it
// also runs with the privileged client (Telegram, cron) where RLS does not apply. The rules themselves are pure, in
// strategy-suggestions.ts.
import type { Db } from "@/lib/org-data";
import type { Json } from "@/integrations/supabase/types";
import {
  decisionRecord, parseStrategy, reconcile, type StrategyDecision, type StrategyRow, type StrategySuggestion,
} from "@/lib/strategy-suggestions";

/** Detectors named strategy_<element>; the generic sync must never auto-close or rewrite them. */
export const STRATEGY_DETECTOR_LIKE = "strategy_%";

export const isStrategySuggestion = (s: { detector: string } & Record<string, unknown>): s is StrategySuggestion =>
  s.detector.startsWith("strategy_") && !!parseStrategy((s as { strategy?: unknown }).strategy);

type Ctx = { db: Db; orgId: string; userId: string };
type SuggestionLike = { id: string; strategy: unknown };

const MESSAGE = {
  approve: "Aceptada",
  dismiss: "Descartada; no volverá a aparecer salvo que haya evidencia nueva",
};

/**
 * CA-4: moves the suggestion out of «pending» exactly once (the claim filters on status), then logs who decided, when, why and
 * with which evidence. If the log fails the status goes back to pending, so there is never a decision without its record.
 */
export async function decideStrategy(
  ctx: Ctx,
  s: SuggestionLike,
  decision: StrategyDecision,
  opts: { reason?: string | null; remindAt?: Date | null; now?: Date } = {},
): Promise<{ status: string; message: string }> {
  const meta = parseStrategy(s.strategy);
  if (!meta) throw new Error("Esta sugerencia no tiene los datos de una sugerencia estratégica completa; no se puede decidir.");
  const now = opts.now ?? new Date();
  const rec = decisionRecord({ decision, by: ctx.userId, now, fingerprint: meta.fingerprint, reason: opts.reason, remindAt: opts.remindAt });
  const at = now.toISOString();
  const { data: claimed } = await ctx.db.from("suggestions")
    .update({ status: rec.status, snoozed_until: rec.remind_at, updated_at: at })
    .eq("id", s.id).eq("org_id", ctx.orgId).eq("status", "pending").select("id");
  if (!claimed?.length) return { status: rec.status, message: "Ya estaba gestionada" };
  const { error } = await ctx.db.from("strategy_decisions").insert({
    org_id: ctx.orgId, suggestion_id: s.id, decision: rec.decision, reason: rec.reason, remind_at: rec.remind_at,
    evidence_fingerprint: rec.evidence_fingerprint, decided_by: rec.decided_by, // decided_at: the database sets it (the policy requires now())
  });
  if (error) {
    await ctx.db.from("suggestions").update({ status: "pending", snoozed_until: null, updated_at: at }).eq("id", s.id).eq("org_id", ctx.orgId);
    throw new Error("No pude registrar la decisión. No he cambiado nada; inténtalo de nuevo.");
  }
  const message = decision === "accept" ? MESSAGE.approve : decision === "dismiss" ? MESSAGE.dismiss : `Pospuesta hasta el ${(rec.remind_at ?? at).slice(0, 10)}`;
  return { status: rec.status, message };
}

/**
 * CA-5 and CA-6: for each suggestion a detector finds, inserts it, refreshes its evidence, reopens it (only when the evidence
 * changed since a dismissal or postponement) or leaves it alone. Rows that stopped being found are not closed here (F5).
 */
export async function syncStrategySuggestions(db: Db, orgId: string, found: StrategySuggestion[], now: Date = new Date()) {
  if (!found.length) return;
  const keys = found.map((f) => f.dedupe_key);
  const { data: existing } = await db.from("suggestions").select("id,dedupe_key,status,priority,created_at,snoozed_until,strategy,title,body").eq("org_id", orgId).in("dedupe_key", keys);
  const rows = (existing ?? []) as { id: string; dedupe_key: string; status: string; priority: number; created_at: string; snoozed_until: string | null; strategy: unknown; title: string; body: string }[];
  const ids = rows.map((r) => r.id);
  const lastFp = new Map<string, string>();
  if (ids.length) {
    const { data: decided } = await db.from("strategy_decisions").select("suggestion_id,evidence_fingerprint,decided_at").eq("org_id", orgId).in("suggestion_id", ids).order("decided_at", { ascending: false });
    for (const d of (decided ?? []) as { suggestion_id: string; evidence_fingerprint: string }[]) if (!lastFp.has(d.suggestion_id)) lastFp.set(d.suggestion_id, d.evidence_fingerprint);
  }
  const byKey = new Map(rows.map((r) => [r.dedupe_key, r]));
  const inserts: StrategySuggestion[] = [];
  const at = now.toISOString();
  for (const f of found) {
    const r = byKey.get(f.dedupe_key);
    const meta = r ? parseStrategy(r.strategy) : null;
    const existingRow: StrategyRow | null = r && meta ? { ...r, strategy: meta, decided_fingerprint: lastFp.get(r.id) ?? null } : null;
    // The database refuses a strategy_* row without valid data, so a row we cannot read is only a defensive case: refresh it.
    const out = r && !existingRow ? ({ action: "refresh", patch: { strategy: f.strategy, title: f.title, body: f.body, priority: f.priority } } as const) : reconcile(existingRow, f, now);
    if (out.action === "insert") inserts.push(f);
    else if (out.action === "keep") continue;
    else await db.from("suggestions").update({ ...out.patch, strategy: out.patch.strategy as unknown as Json, updated_at: at }).eq("id", r!.id).eq("org_id", orgId);
  }
  if (inserts.length) {
    await db.from("suggestions").upsert(
      inserts.map((f) => ({ ...f, org_id: orgId, action: f.action as unknown as Json, strategy: f.strategy as unknown as Json })),
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
  }
}
