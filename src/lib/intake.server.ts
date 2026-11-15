// Shared by the public intake routes: per-connection limits (auto-pause) and storing a batch in
// quarantine. Runs with the privileged client only after the connection key was verified.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { QuarantineRow } from "@/lib/import-batch";

type Db = SupabaseClient<Database>;
export type IntakeSource = {
  id: string; org_id: string; kind: string; mode: string; max_per_request: number; daily_limit: number;
  day_count: number; day_date: string | null; received_count: number;
};

/** Returns an error response body when the send is over a limit (pausing the connection on the daily one). */
export async function enforceLimits(db: Db, s: IntakeSource, count: number) {
  const today = new Date().toISOString().slice(0, 10);
  // A3: the quota is reserved atomically in the database (row lock): it checks the connection is active, reserves
  // the rows and, past the daily limit, pauses it in the same step. If the reservation cannot be made, nothing is
  // accepted (retryable 503): there is no non-atomic fallback.
  let rpc: unknown = null;
  let failed = false;
  try {
    const r = await db.rpc("reserve_intake_quota", { _source: s.id, _n: count, _today: today });
    rpc = r.data;
    failed = !!r.error || !rpc;
  } catch {
    failed = true;
  }
  if (failed) return { status: 503, error: "No se ha podido reservar el cupo de la conexión. Vuelve a intentarlo en unos minutos." };
  const r = rpc as { ok: boolean; status?: number; error?: string; pause?: boolean };
  if (r.ok) return null;
  if (r.pause)
    await db.from("lead_events").insert({ org_id: s.org_id, lead_source_id: s.id, channel: "link", status: "error", summary: "Conexión pausada", error: r.error ?? null });
  return { status: r.status ?? 429, error: r.error ?? "Límite superado" };
}

export async function quarantine(db: Db, s: IntakeSource, kind: "leads" | "accounts", rows: QuarantineRow[]) {
  const { data: batch, error } = await db.from("import_batches").insert({ org_id: s.org_id, lead_source_id: s.id, kind, row_count: rows.length }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await db.from("import_rows").insert(rows.map((r) => ({
    org_id: s.org_id, batch_id: batch.id, line: r.line, raw: r.raw as Json, summary: r.summary.slice(0, 300), action: r.action, reason: r.reason,
  })));
  if (e2) throw new Error(e2.message);
  const { bumpReceived } = await import("@/lib/intake-counter.server");
  await bumpReceived(db, s, rows.length);
  return batch.id as string;
}

