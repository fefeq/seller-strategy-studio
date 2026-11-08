// Shared shapes of the Plays GTM module (SDD-20261106-plays-library-core). Pure types: no I/O.
// «Plays GTM» are trigger + gates + output automations; they are NOT the five sales scripts of src/lib/playbooks/.

/** Result of one gate. An unknown datum never passes (see gates.ts). */
export type GateResult =
  { v: "pass" } | { v: "fail"; reason: string } | { v: "unknown"; missing: string };

/** One gate of a play: a key for the log, and a pure check over the candidate. */
export type GateDef = {
  key: string;
  check: (subject: Record<string, unknown>) => GateResult;
};
