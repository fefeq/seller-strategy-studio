// Shared by the public intake routes: per-connection limits (auto-pause) and storing a batch in
// quarantine. Runs with the privileged client only after the connection key was verified.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { checkIntake, type QuarantineRow } from "@/lib/import-batch";

type Db = SupabaseClient<Database>;
export type IntakeSource = {
  id: string; org_id: string; kind: string; mode: string; max_per_request: number; daily_limit: number;
  day_count: number; day_date: string | null; received_count: number;
};

/** Returns an error response body when the send is over a limit (pausing the connection on the daily one). */
export async function enforceLimits(db: Db, s: IntakeSource, count: number) {
  const today = new Date().toISOString().slice(0, 10);
  // A3: the quota is reserved atomically in the database (row lock), so two simultaneous sends cannot both pass
  // the daily limit. Same rules as checkIntake; it is the fallback only when the RPC is unavailable.
  const { data: rpc, error: rpcError } = await db.rpc("reserve_intake_quota", { _source: s.id, _n: count, _today: today });
  const r = !rpcError && rpc
    ? (rpc as unknown as ReturnType<typeof checkIntake>)
    : checkIntake(count, { maxPerRequest: s.max_per_request, dailyLimit: s.daily_limit, dayCount: s.day_count, dayDate: s.day_date }, today);
  if (r.ok) {
    if (rpcError || !rpc) await db.from("lead_sources").update({ day_count: r.dayCount, day_date: r.dayDate }).eq("id", s.id);
    return null;
  }
  if (r.pause) {
    await db.from("lead_sources").update({ active: false, paused_reason: r.error }).eq("id", s.id);
    await db.from("lead_events").insert({ org_id: s.org_id, lead_source_id: s.id, channel: "link", status: "error", summary: "Conexión pausada", error: r.error });
  }
  return { status: r.status, error: r.error };
}

export async function quarantine(db: Db, s: IntakeSource, kind: "leads" | "accounts", rows: QuarantineRow[]) {
  const { data: batch, error } = await db.from("import_batches").insert({ org_id: s.org_id, lead_source_id: s.id, kind, row_count: rows.length }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await db.from("import_rows").insert(rows.map((r) => ({
    org_id: s.org_id, batch_id: batch.id, line: r.line, raw: r.raw as Json, summary: r.summary.slice(0, 300), action: r.action, reason: r.reason,
  })));
  if (e2) throw new Error(e2.message);
  await bumpReceived(db, s, rows.length);
  return batch.id as string;
}

/** A3: atomic received_count increment (never read-modify-write); falls back to the old update if the RPC fails. */
export async function bumpReceived(db: Db, s: IntakeSource, n: number) {
  const { error } = await db.rpc("bump_intake_received", { _source: s.id, _n: n });
  if (error)
    await db.from("lead_sources").update({ received_count: s.received_count + n, last_received_at: new Date().toISOString() }).eq("id", s.id);
}
