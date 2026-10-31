import { describe, expect, it } from "vitest";
import {
  actionsFor,
  blocksLeaving,
  canDo,
  canUndo,
  confirmedText,
  confirmSummary,
  isDirty,
  validateEdit,
} from "./field-actions";
import { confirmSources, personEdit } from "./provenance";

describe("field actions", () => {
  it("CA-7: deleting is the Owner's; another role sees it disabled with the reason", () => {
    expect(canDo("icp", "delete", ["owner"])).toEqual({
      available: true,
      allowed: true,
      reason: null,
    });
    expect(canDo("icp", "delete", ["sales_leader"])).toEqual({
      available: true,
      allowed: false,
      reason: "Solo el Owner puede borrar.",
    });
    expect(canDo("pillar", "delete", ["marketing"]).allowed).toBe(false);
  });

  it("CA-7: only the Owner deletes onboarding sources and findings; another member sees it disabled with the reason", () => {
    for (const kind of ["onboarding_source", "finding"] as const) {
      expect(canDo(kind, "delete", ["owner"]), kind).toEqual({
        available: true,
        allowed: true,
        reason: null,
      });
      for (const role of ["sales_leader", "marketing", "sdr", "ae"]) {
        expect(canDo(kind, "delete", [role]), `${kind} ${role}`).toEqual({
          available: true,
          allowed: false,
          reason: "Solo el Owner puede borrar.",
        });
      }
    }
    expect(actionsFor("finding", ["ae"]).map((a) => `${a.action}:${a.allowed}`)).toEqual([
      "edit:true",
      "confirm:true",
      "delete:false",
      "undo:true",
    ]);
    expect(actionsFor("onboarding_source", ["ae"]).map((a) => `${a.action}:${a.allowed}`)).toEqual([
      "delete:false",
      "undo:true",
    ]);
  });

  it("CA-1: any member can edit and confirm", () => {
    for (const role of ["owner", "sales_leader", "marketing", "sdr", "ae"]) {
      expect(canDo("icp", "edit", [role]).allowed, role).toBe(true);
      expect(canDo("pillar", "confirm", [role]).allowed, role).toBe(true);
    }
  });

  it("an action the element does not have is not offered at all", () => {
    expect(canDo("positioning", "delete", ["owner"]).available).toBe(false);
    expect(canDo("company_field", "delete", ["owner"]).available).toBe(false);
    expect(canDo("onboarding_source", "edit", ["owner"]).available).toBe(false);
    expect(actionsFor("positioning", ["owner"]).map((a) => a.action)).toEqual([
      "edit",
      "confirm",
      "undo",
    ]);
    expect(actionsFor("pillar", ["ae"]).map((a) => `${a.action}:${a.allowed}`)).toEqual([
      "edit:true",
      "confirm:true",
      "delete:false",
      "undo:true",
    ]);
  });

  it("undoing a delete is the Owner's, undoing an edit is anyone's", () => {
    expect(canUndo("icp", "delete", ["ae"])).toMatchObject({
      allowed: false,
      reason: "Solo el Owner puede deshacer un borrado.",
    });
    expect(canUndo("icp", "delete", ["owner"]).allowed).toBe(true);
    expect(canUndo("icp", "edit", ["ae"]).allowed).toBe(true);
  });

  it("§8: a required field cannot be saved empty", () => {
    expect(validateEdit("  ", true)).toMatchObject({ ok: false });
    expect(validateEdit(null, true)).toMatchObject({ ok: false });
    expect(validateEdit("", false)).toEqual({ ok: true });
    expect(validateEdit("Fintech", true)).toEqual({ ok: true });
  });

  it("CA-3: a draft that differs from what is saved is dirty; an empty value equals no value", () => {
    expect(isDirty({ a: "x", b: null }, { a: "x", b: "" })).toBe(false);
    expect(isDirty({ a: "x" }, { a: "y" })).toBe(true);
    expect(isDirty({ list: ["a", "b"] }, { list: ["b", "a"] })).toBe(true);
    expect(isDirty(null, { a: "x" })).toBe(false);
  });

  it("CA-3: leaving is blocked on «stay» and when the save failed, never otherwise", () => {
    expect(blocksLeaving("stay", null)).toBe(true);
    expect(blocksLeaving("save", false)).toBe(true);
    expect(blocksLeaving("save", true)).toBe(false);
    expect(blocksLeaving("discard", null)).toBe(false);
  });

  it("CA-2: a person's save is marked as theirs, confirmed, with who and when", () => {
    const out = personEdit({}, { size: "51–200 empleados" }, "2026-10-26T10:00:00Z", "u1");
    expect(out.size).toMatchObject({
      source: "persona",
      kind: "persona",
      confirmed: true,
      confirmedBy: "u1",
      confirmedAt: "2026-10-26T10:00:00Z",
    });
  });

  it("CA-8: confirming keeps where the value came from and records who and when", () => {
    const prev = { industry: { source: "apollo", at: "2026-10-01T00:00:00Z" } };
    const out = confirmSources(prev, ["industry"], "u1", "2026-10-26T10:00:00Z");
    expect(out.industry).toEqual({
      source: "apollo",
      at: "2026-10-01T00:00:00Z",
      confirmed: true,
      confirmedBy: "u1",
      confirmedAt: "2026-10-26T10:00:00Z",
    });
  });

  it("CA-8: confirming a value with no mark does not claim a person wrote it", () => {
    const out = confirmSources({}, ["size"], "u1", "2026-10-26T10:00:00Z");
    expect(out.size).toMatchObject({ kind: "sin_dato", confirmed: true, confirmedBy: "u1" });
    expect(out.size?.kind).not.toBe("persona");
  });

  it("CA-9, CA-10: several fields confirm at once and the block is confirmed when all are", () => {
    const fields = ["industry", "size", "country"];
    const prev = { industry: { source: "apollo", at: "x" } };
    expect(confirmSummary(fields, prev)).toEqual({
      total: 3,
      confirmed: 0,
      pending: fields,
      allConfirmed: false,
    });
    const some = confirmSources(prev, ["industry", "size"], "u1", "2026-10-26T10:00:00Z");
    expect(confirmSummary(fields, some)).toMatchObject({
      confirmed: 2,
      pending: ["country"],
      allConfirmed: false,
    });
    const all = confirmSources(
      some,
      confirmSummary(fields, some).pending,
      "u1",
      "2026-10-26T11:00:00Z",
    );
    expect(confirmSummary(fields, all)).toMatchObject({
      confirmed: 3,
      pending: [],
      allConfirmed: true,
    });
  });

  it("a block with no fields is not confirmed", () => {
    expect(confirmSummary([], {}).allConfirmed).toBe(false);
  });

  it("CA-8: the confirmation reads who and when, or nothing while unconfirmed", () => {
    expect(confirmedText({ confirmed: true, confirmedAt: "2026-10-24T10:00:00Z" }, "ti")).toMatch(
      /^Confirmado por ti el 24/,
    );
    expect(confirmedText({ confirmed: true }, null)).toBe("Confirmado");
    expect(confirmedText({ confirmed: false }, "ti")).toBeNull();
    expect(confirmedText(undefined, null)).toBeNull();
  });
});
