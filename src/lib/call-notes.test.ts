import { describe, expect, it } from "vitest";
import {
  CALL_NOTE_FIELDS,
  MAX_LINE,
  callLogEntry,
  callNotesText,
  filledCount,
  mergeCallNotes,
  needsCallNotes,
  normalizeCallNotes,
} from "./call-notes";
import { getTool } from "@/lib/agent/tools";

const NOW = new Date("2026-10-22T10:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("call notes in five lines", () => {
  it("has exactly five fields in a fixed order", () => {
    expect(CALL_NOTE_FIELDS.map((f) => f.key)).toEqual([
      "dolor",
      "impacto",
      "decision",
      "freno",
      "siguiente",
    ]);
  });

  it("normalizes stored values: one line, trimmed, capped, unknown keys and non-strings dropped", () => {
    const n = normalizeCallNotes({
      dolor: "  pierden\n leads  ",
      impacto: 3,
      otro: "x",
      freno: "",
      siguiente: "a".repeat(400),
    });
    expect(n).toEqual({ dolor: "pierden leads", siguiente: "a".repeat(MAX_LINE) });
    expect(normalizeCallNotes(null)).toEqual({});
    expect(normalizeCallNotes(["x"])).toEqual({});
  });

  it("counts and prints only the filled lines, in order", () => {
    const n = { siguiente: "Demo el jueves con Ana", dolor: "Pierden leads" };
    expect(filledCount(n)).toBe(2);
    expect(callNotesText(n)).toBe(
      "Qué les duele: Pierden leads\nPróximo paso acordado: Demo el jueves con Ana",
    );
  });

  it("the call log gets the five lines, then the free notes; the agreed next step wins", () => {
    const e = callLogEntry({
      notes: "Muy interesados",
      next_steps: "antiguo",
      call_notes: { dolor: "Pierden leads", siguiente: "Demo el jueves" },
    });
    expect(e.summary).toBe(
      "Qué les duele: Pierden leads\nPróximo paso acordado: Demo el jueves\n\nMuy interesados",
    );
    expect(e.next_steps).toBe("Demo el jueves");
    expect(callLogEntry({ notes: "", next_steps: "", call_notes: {} }).hasContent).toBe(false);
    expect(callLogEntry({ notes: null, next_steps: "Llamar", call_notes: {} }).next_steps).toBe(
      "Llamar",
    );
  });

  it("merging keeps old lines when the new value is empty", () => {
    expect(mergeCallNotes({ dolor: "A", freno: "B" }, { dolor: "", freno: "C" })).toEqual({
      dolor: "A",
      freno: "C",
    });
  });

  it("asks for notes 2 h to 7 days after a meeting with an account and nothing written", () => {
    const m = { scheduled_at: ago(3), account_id: "a1", notes: null, call_notes: {} };
    expect(needsCallNotes(m, NOW)).toBe(true);
    expect(needsCallNotes({ ...m, scheduled_at: ago(1) }, NOW)).toBe(false);
    expect(needsCallNotes({ ...m, scheduled_at: ago(24 * 8) }, NOW)).toBe(false);
    expect(
      needsCallNotes(
        { ...m, scheduled_at: new Date(NOW.getTime() + 3_600_000).toISOString() },
        NOW,
      ),
    ).toBe(false);
    expect(needsCallNotes({ ...m, account_id: null }, NOW)).toBe(false);
    expect(needsCallNotes({ ...m, notes: "Algo" }, NOW)).toBe(false);
    expect(needsCallNotes({ ...m, call_notes: { siguiente: "Demo" } }, NOW)).toBe(false);
  });

  it("the agent can save them, as a write that needs confirmation", () => {
    const t = getTool("save_call_notes");
    expect(t?.kind).toBe("write");
    expect(
      t?.input.safeParse({ meeting_id: "11111111-1111-4111-8111-111111111111", dolor: "x" })
        .success,
    ).toBe(true);
    expect(t?.summarize?.({ meeting_id: "x", dolor: "a", siguiente: "b" })).toBe(
      "Guardar las notas de la reunión (2 de 5 líneas)",
    );
  });
});
