import { safeErrorLog } from "@/lib/agent/safe-error-log";
import type { Db } from "@/lib/org-data";
import type { IntakeSource } from "@/lib/intake.server";

/** A3: atomic received_count increment (never read-modify-write); falls back to the old update if the RPC fails. */
export async function bumpReceived(db: Db, s: IntakeSource, n: number) {
  // A3: atomic increment only; a failure is logged and never overwritten with a stale snapshot.
  try {
    const { error } = await db.rpc("bump_intake_received", { _source: s.id, _n: n });
    if (error) console.error("bump_intake_received failed", safeErrorLog(error));
  } catch (e) {
    console.error("bump_intake_received failed", safeErrorLog(e));
  }
}
