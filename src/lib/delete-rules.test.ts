import { describe, expect, it } from "vitest";
import {
  canUndoChange,
  changeText,
  deletePlan,
  UNDO_HOURS,
  undoStatus,
  type ChangeEntry,
} from "./delete-rules";

const none = { kept: [], gone: [] };
const used = {
  kept: [
    { label: "cuentas", count: 3 },
    { label: "deals", count: 0 },
  ],
  gone: [{ label: "objetivos", count: 2 }],
};
const entry = (over: Partial<ChangeEntry> = {}): ChangeEntry => ({
  id: "l1",
  table_name: "icp_profiles",
  row_id: "r1",
  op: "delete",
  before: { name: "Agencias" },
  changed_at: "2026-10-26T10:00:00Z",
  undone_at: null,
  ...over,
});

describe("delete rules", () => {
  it("CA-4: the confirmation says what is lost and where it is used", () => {
    const p = deletePlan(
      "icp",
      "Agencias",
      {
        kept: [
          { label: "cuentas", count: 12 },
          { label: "leads", count: 4 },
        ],
        gone: [],
      },
      ["owner"],
    );
    expect(p.title).toBe("¿Archivar el ICP «Agencias»?");
    expect(p.lines[0]).toBe("Se usa para puntuar y buscar con: 12 cuentas, 4 leads.");
    expect(p.confirmLabel).toBe("Archivar");
    expect(p.allowed).toBe(true);
  });

  it("CA-6: a segment in use is not deleted and the cascade is named", () => {
    const p = deletePlan("segment", "Pymes", used, ["owner"]);
    expect(p).toMatchObject({ allowed: false, blocked: "in_use" });
    expect(p.lines[0]).toBe("Se usa en: 3 cuentas, 2 objetivos.");
    expect(p.lines[1]).toBe("Borrarlo se llevaría por delante: 2 objetivos.");
    expect(p.lines.join(" ")).not.toContain("0 deals");
  });

  it("a segment with no data can be deleted, with the undo window said", () => {
    const p = deletePlan("segment", "Pymes", none, ["owner"]);
    expect(p).toMatchObject({ allowed: true, blocked: null, confirmLabel: "Borrar" });
    expect(p.lines).toContain(`Puedes deshacerlo durante ${UNDO_HOURS} horas.`);
  });

  it("CA-6: an ICP or a pillar in use is archived instead of deleted", () => {
    expect(deletePlan("icp", "X", none, ["owner"]).confirmLabel).toBe("Borrar");
    expect(deletePlan("pillar", "Ahorro", none, ["owner"])).toMatchObject({
      allowed: true,
      confirmLabel: "Archivar",
    });
  });

  it("CA-7: a role that is not Owner cannot delete and is told why", () => {
    const p = deletePlan("icp", "Agencias", none, ["sales_leader"]);
    expect(p).toMatchObject({ allowed: false, blocked: "role" });
    expect(p.lines).toEqual(["Solo el Owner puede borrar."]);
  });

  it("CA-5: undo is offered for 24 hours and says until when", () => {
    const e = entry();
    expect(undoStatus(e, new Date("2026-10-27T09:59:00Z")).possible).toBe(true);
    expect(undoStatus(e, new Date("2026-10-27T09:59:00Z")).text).toMatch(
      /^Puedes deshacerlo hasta el 27 oct/,
    );
    expect(undoStatus(e, new Date("2026-10-27T10:01:00Z"))).toMatchObject({
      possible: false,
      text: "Ya no es posible deshacerlo: pasaron más de 24 horas.",
    });
  });

  it("an undone change cannot be undone twice", () => {
    expect(
      undoStatus(entry({ undone_at: "2026-10-26T11:00:00Z" }), new Date("2026-10-26T12:00:00Z")),
    ).toMatchObject({ possible: false, text: "Ya lo deshiciste." });
  });

  it("CA-14: undoing a delete is the Owner's, undoing an edit is any member's, after the window nobody's", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    expect(canUndoChange(entry({ op: "delete" }), ["owner"], now).allowed).toBe(true);
    expect(canUndoChange(entry({ op: "delete" }), ["ae"], now)).toEqual({
      allowed: false,
      reason: "Solo el Owner puede deshacer un borrado.",
    });
    expect(canUndoChange(entry({ op: "update" }), ["ae"], now).allowed).toBe(true);
    expect(
      canUndoChange(entry({ op: "update" }), ["owner"], new Date("2026-10-28T00:00:00Z")).allowed,
    ).toBe(false);
    expect(canUndoChange(entry({ table_name: "accounts" }), ["owner"], now).allowed).toBe(false);
  });

  it("the change reads as what the person did", () => {
    expect(changeText(entry())).toBe("Borraste el ICP «Agencias»");
    expect(
      changeText(
        entry({ table_name: "messaging_pillars", op: "update", before: { title: "Ahorro" } }),
      ),
    ).toBe("Cambiaste el pilar «Ahorro»");
    expect(changeText(entry({ table_name: "positioning", op: "update", before: {} }))).toBe(
      "Cambiaste el posicionamiento",
    );
  });

  it("a single use reads in the singular", () => {
    const one = {
      kept: [
        { label: "cuentas", one: "cuenta", count: 1 },
        { label: "deals", one: "deal", count: 2 },
      ],
      gone: [],
    };
    expect(deletePlan("segment", "Pymes", one, ["owner"]).lines[0]).toBe(
      "Se usa en: 1 cuenta, 2 deals.",
    );
  });
});
