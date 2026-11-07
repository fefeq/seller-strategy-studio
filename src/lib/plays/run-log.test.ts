import { describe, expect, it } from "vitest";
import { runRow } from "./run-log";

const ORG = "11111111-1111-4111-8111-111111111111";
const SUBJECT = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-11-06T10:00:00.000Z");
const base = {
  orgId: ORG,
  playId: "closed-lost-revival",
  subjectTable: "deals",
  subjectId: SUBJECT,
  now: NOW,
};

describe("runRow (CA-16, G-2)", () => {
  it("builds the row of a pass with company, play, table, subject id and date", () => {
    expect(runRow({ ...base, result: { v: "pass" } })).toEqual({
      org_id: ORG,
      play_id: "closed-lost-revival",
      subject_table: "deals",
      subject_id: SUBJECT,
      outcome: "pass",
      gate_key: null,
      drop_reason: null,
      created_at: "2026-11-06T10:00:00.000Z",
    });
  });

  it("builds the row of a drop with the gate key and the reason", () => {
    const row = runRow({
      ...base,
      result: {
        v: "drop",
        gate: "ventana",
        reason: "Dato desconocido: fecha de cierre",
        missing: "fecha de cierre",
      },
    });
    expect(row).toMatchObject({
      outcome: "drop",
      gate_key: "ventana",
      drop_reason: "Dato desconocido: fecha de cierre",
    });
  });

  it("never carries more than ids and the reason: the row has exactly the table columns", () => {
    const row = runRow({ ...base, result: { v: "drop", gate: "g", reason: "No encaja" } });
    expect(Object.keys(row).sort()).toEqual([
      "created_at",
      "drop_reason",
      "gate_key",
      "org_id",
      "outcome",
      "play_id",
      "subject_id",
      "subject_table",
    ]);
  });

  it("refuses a subject that is not an id (so a name or an email cannot be logged)", () => {
    expect(() => runRow({ ...base, subjectId: "Ana García", result: { v: "pass" } })).toThrow();
    expect(() =>
      runRow({ ...base, subjectId: "ana@example.com", result: { v: "pass" } }),
    ).toThrow();
    expect(() => runRow({ ...base, orgId: "x", result: { v: "pass" } })).toThrow();
  });

  it("refuses a reason that looks like it carries an email, or a table name that is not a table", () => {
    expect(() =>
      runRow({ ...base, result: { v: "drop", gate: "g", reason: "Descartada ana@example.com" } }),
    ).toThrow();
    expect(() =>
      runRow({ ...base, subjectTable: "deals; drop table x", result: { v: "pass" } }),
    ).toThrow();
  });

  it("refuses a drop without a reason or without a gate key (the table check requires a reason)", () => {
    expect(() => runRow({ ...base, result: { v: "drop", gate: "g", reason: "  " } })).toThrow();
    expect(() => runRow({ ...base, result: { v: "drop", gate: "", reason: "x" } })).toThrow();
  });

  it("refuses an empty play id", () => {
    expect(() => runRow({ ...base, playId: "", result: { v: "pass" } })).toThrow();
  });
});
