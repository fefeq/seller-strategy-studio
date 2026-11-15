import type { Db } from "@/lib/org-data";
import type { IntakeSource } from "@/lib/intake.server";

/** A3: atomic received_count increment (never read-modify-write); falls back to the old update if the RPC fails. */
export async function bumpReceived(db: Db, s: IntakeSource, n: number) {
  let failed = true;
  try {
    const { error } = await db.rpc("bump_intake_received", { _source: s.id, _n: n });
    failed = !!error;
  } catch {
    failed = true;
  }
  if (failed)
    await db.from("lead_sources").update({ received_count: s.received_count + n, last_received_at: new Date().toISOString() }).eq("id", s.id);
}
