import type { GateDef } from "./types";

// Gate engine of the Plays GTM (SDD-20261106-plays-library-core, H-3). Pure, no I/O: whoever calls it writes play_runs (run-log.ts).
// Rule: «a datum that is unknown never passes». A gate that cannot decide drops the candidate and names the missing datum.

export type GateOutcome =
  { v: "pass" } | { v: "drop"; gate: string; reason: string; missing?: string };

/** Runs the gates in order and stops at the first one that does not pass. Passes only if all of them pass. */
export function runGates(gates: GateDef[], subject: Record<string, unknown>): GateOutcome {
  for (const g of gates) {
    const r = g.check(subject);
    if (r.v === "fail") return { v: "drop", gate: g.key, reason: r.reason };
    if (r.v === "unknown")
      return {
        v: "drop",
        gate: g.key,
        reason: `Dato desconocido: ${r.missing}`,
        missing: r.missing,
      };
  }
  return { v: "pass" };
}
