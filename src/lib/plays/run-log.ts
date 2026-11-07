import type { GateOutcome } from "./gates";

// Model of one row of play_runs (SDD-20261106-plays-library-core, CA-16/CA-17). Pure: the server writes it with the privileged client.
// The row carries ids only, never text, names or emails of leads, people or accounts.

export type PlayRunRow = {
  org_id: string;
  play_id: string;
  subject_table: string;
  subject_id: string;
  outcome: "pass" | "drop";
  gate_key: string | null;
  drop_reason: string | null;
  created_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLE = /^[a-z][a-z0-9_]*$/;
const MAX_REASON = 200;

export function runRow(p: {
  orgId: string;
  playId: string;
  subjectTable: string;
  subjectId: string;
  result: GateOutcome;
  now: Date;
}): PlayRunRow {
  if (!UUID.test(p.orgId)) throw new Error("play_runs: org_id must be a uuid");
  if (!UUID.test(p.subjectId)) throw new Error("play_runs: the subject is logged by id only");
  if (!p.playId.trim()) throw new Error("play_runs: play_id is empty");
  if (!TABLE.test(p.subjectTable)) throw new Error("play_runs: subject_table must be a table name");
  const base = {
    org_id: p.orgId,
    play_id: p.playId,
    subject_table: p.subjectTable,
    subject_id: p.subjectId,
    created_at: p.now.toISOString(),
  };
  if (p.result.v === "pass") return { ...base, outcome: "pass", gate_key: null, drop_reason: null };
  const reason = p.result.reason.trim();
  if (!p.result.gate.trim() || !reason)
    throw new Error("play_runs: a drop needs a gate key and a reason");
  if (reason.includes("@") || reason.length > MAX_REASON)
    throw new Error("play_runs: the reason must be a short rule text, not data of a person");
  return { ...base, outcome: "drop", gate_key: p.result.gate, drop_reason: reason };
}
