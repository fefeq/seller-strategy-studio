import { describe, expect, it } from "vitest";
import { accountQuarantineRows, checkIntake, leadQuarantineRows, planUndo, type UndoRow } from "./import-batch";

const limits = { maxPerRequest: 100, dailyLimit: 500, dayCount: 450, dayDate: "2026-10-24" };

describe("intake limits", () => {
  it("rejects a send over the per-send limit without pausing", () =>
    expect(checkIntake(101, limits, "2026-10-24")).toMatchObject({ ok: false, status: 413, pause: false }));
  it("pauses the connection when the daily limit is exceeded", () =>
    expect(checkIntake(51, limits, "2026-10-24")).toMatchObject({ ok: false, status: 429, pause: true }));
  it("counts up to the daily limit exactly", () =>
    expect(checkIntake(50, limits, "2026-10-24")).toEqual({ ok: true, dayCount: 500, dayDate: "2026-10-24" }));
  it("resets the count on a new day", () =>
    expect(checkIntake(80, limits, "2026-10-25")).toEqual({ ok: true, dayCount: 80, dayDate: "2026-10-25" }));
});

describe("quarantine rows", () => {
  it("keeps leads without company with their reason", () => {
    const rows = leadQuarantineRows([{ empresa: "Acme", email: "ana@acme.com" }, { nota: "hola" }]);
    expect(rows.map((r) => r.action)).toEqual(["new", "skip"]);
    expect(rows[1]!.reason).toBeTruthy();
  });
  it("skips accounts that already exist", () => {
    const rows = accountQuarantineRows([{ empresa: "Acme", web: "acme.com" }, { empresa: "Nueva", web: "nueva.io" }], [], [{ name: "Otra", domain: "acme.com" }]);
    expect(rows.map((r) => [r.action, r.reason])).toEqual([["skip", "ya existe"], ["new", null]]);
  });
});

describe("undo", () => {
  const applied = "2026-10-24T10:00:00Z";
  const row = (id: string, result: UndoRow["result"]): UndoRow => ({ id, status: "applied", applied_at: applied, result });
  const rows = [
    row("a", { status: "created", accountId: "acc1", accountCreated: true, leadId: "l1", dealId: null }),
    row("b", { status: "updated", accountId: "acc2", accountCreated: false, leadId: "l2", dealId: null }),
    row("c", { status: "created", accountId: "acc3", accountCreated: true, leadId: "l3", dealId: null }),
    row("d", { status: "created", accountId: "acc4", accountCreated: true, leadId: "l4", dealId: "d4" }),
  ];
  it("deletes only what it created and nobody touched; never existing records", () => {
    const p = planUndo(rows, {
      leads: new Map([["l1", applied], ["l3", "2026-10-25T09:00:00Z"]]),
      accounts: new Map([["acc1", applied], ["acc3", applied]]),
      accountsWithOther: new Set(),
    });
    expect(p.leads).toEqual(["l1"]);
    expect(p.accounts).toEqual(["acc1"]);
    expect(p.undone).toEqual(["a"]);
    expect(p.kept.map((k) => k.id)).toEqual(["b", "c", "d"]);
  });
  it("keeps a created account that now has other leads or deals", () => {
    const p = planUndo([rows[0]!], { leads: new Map(), accounts: new Map(), accountsWithOther: new Set(["acc1"]) });
    expect(p.undone).toEqual([]);
  });
});
