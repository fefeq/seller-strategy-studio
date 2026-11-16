// Automatic imports from third parties (pure): intake limits per connection, the quarantine rows a
// batch is stored as, and which records undoing a batch may delete. Shared by the public intake
// routes and the approve/undo server functions.

import { normalizeLead } from "@/lib/leads";
import { accountColumnMapping, planAccountImport } from "@/lib/account-import";

export type IntakeLimits = {
  maxPerRequest: number;
  dailyLimit: number;
  dayCount: number;
  dayDate: string | null;
};

export type IntakeCheck =
  | { ok: true; dayCount: number; dayDate: string }
  | { ok: false; status: number; error: string; pause: boolean };

/** today = YYYY-MM-DD (UTC). Over the per-send limit rejects; over the daily limit pauses the connection. */
export function checkIntake(count: number, l: IntakeLimits, today: string): IntakeCheck {
  if (count > l.maxPerRequest)
    return {
      ok: false,
      status: 413,
      error: `Máximo ${l.maxPerRequest} filas por envío`,
      pause: false,
    };
  const used = l.dayDate === today ? l.dayCount : 0;
  if (used + count > l.dailyLimit)
    return {
      ok: false,
      status: 429,
      error: `Límite diario de ${l.dailyLimit} filas superado: la conexión se ha pausado`,
      pause: true,
    };
  return { ok: true, dayCount: used + count, dayDate: today };
}

export type QuarantineRow = {
  line: number;
  raw: Record<string, unknown>;
  summary: string;
  action: "new" | "update" | "skip";
  reason: string | null;
};

/** Lead rows: valid ones wait for approval («se creará o actualizará»), invalid ones are kept with their reason. */
export function leadQuarantineRows(records: Record<string, unknown>[]): QuarantineRow[] {
  return records.map((rec, i) => {
    const n = normalizeLead(rec, { defaultStage: "new" });
    if ("error" in n)
      return { line: i + 1, raw: rec, summary: "—", action: "skip", reason: n.error };
    const who = [n.lead.fullName, n.lead.email].filter(Boolean).join(" · ");
    return {
      line: i + 1,
      raw: rec,
      summary: `${n.lead.company}${who ? ` · ${who}` : ""}`,
      action: "new",
      reason: null,
    };
  });
}

/** Account rows: deduped against the file and the existing accounts with the same rules as the CSV import. */
export function accountQuarantineRows(
  records: Record<string, string>[],
  segments: { id: string; name: string }[],
  existing: { name: string; domain: string | null }[],
): QuarantineRow[] {
  const mapping = accountColumnMapping(Object.keys(records[0] ?? {}));
  const plan = planAccountImport(records, mapping, segments, existing);
  const skipped = new Map(plan.skipped.map((s) => [s.line - 2, s]));
  let next = 0;
  return records.map((rec, i) => {
    const s = skipped.get(i);
    if (s) return { line: i + 1, raw: rec, summary: s.name, action: "skip", reason: s.reason };
    const row = plan.rows[next++]!;
    return {
      line: i + 1,
      raw: { ...row },
      summary: row.domain ? `${row.name} · ${row.domain}` : row.name,
      action: "new",
      reason: null,
    };
  });
}

/** Flat string record (the account importer reads text cells). */
export function asTextRecord(rec: unknown): Record<string, string> {
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) return {};
  return Object.fromEntries(
    Object.entries(rec as Record<string, unknown>)
      .slice(0, 60)
      .filter(([, v]) => v == null || ["string", "number", "boolean"].includes(typeof v))
      .map(([k, v]) => [String(k).slice(0, 120).toLowerCase(), String(v ?? "").slice(0, 2000)]),
  );
}

export type AppliedResult = {
  status: "created" | "updated";
  accountId: string | null;
  accountCreated: boolean;
  leadId: string | null;
  dealId: string | null;
};

export type UndoRow = {
  id: string;
  status: string;
  applied_at: string | null;
  result: AppliedResult | null;
};
export type Touched = {
  leads: Map<string, string>;
  accounts: Map<string, string>;
  accountsWithOther: Set<string>;
};

/**
 * What undoing a batch deletes: only records the batch created and nobody changed afterwards
 * (updated_at no later than one minute after it was applied). Rows that updated existing records
 * are never deleted.
 */
export function planUndo(rows: UndoRow[], touched: Touched) {
  const grace = 60_000;
  const untouched = (at: string | undefined, applied: string) =>
    !at || new Date(at).getTime() <= new Date(applied).getTime() + grace;
  const leads: string[] = [];
  const accounts: string[] = [];
  const undone: string[] = [];
  const kept: { id: string; reason: string }[] = [];
  for (const r of rows) {
    if (r.status !== "applied" || !r.result || !r.applied_at) continue;
    if (r.result.status !== "created") {
      kept.push({ id: r.id, reason: "actualizó un registro que ya existía" });
      continue;
    }
    if (r.result.dealId) {
      kept.push({ id: r.id, reason: "ya tiene un deal en la pipeline" });
      continue;
    }
    const leadOk = !r.result.leadId || untouched(touched.leads.get(r.result.leadId), r.applied_at);
    const acc = r.result.accountCreated ? r.result.accountId : null;
    const accOk =
      !acc ||
      (untouched(touched.accounts.get(acc), r.applied_at) && !touched.accountsWithOther.has(acc));
    if (!leadOk || !accOk) {
      kept.push({ id: r.id, reason: "se ha modificado después de importarlo" });
      continue;
    }
    if (r.result.leadId) leads.push(r.result.leadId);
    if (acc) accounts.push(acc);
    undone.push(r.id);
  }
  return { leads, accounts, undone, kept };
}
