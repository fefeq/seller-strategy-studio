// SDD-20261031-deal-won-duplicate-approvals: CA-1, 2, 4a, 4b, 4c, 6, 7 (rules and writer; the database guarantee is in won-approval.pg.test.ts).
import { describe, expect, it } from "vitest";
import { approvalDealId, blockedByPendingWon, pendingStageChanges, pendingWonDealIds, requestWonApproval, wonRequestOutcome, type ApprovalRow } from "@/lib/won-approval";

const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const ev = (id: string) => JSON.stringify({ deal_id: id, stage: "won" });
const pend = (id: string): ApprovalRow => ({ kind: "stage_change", status: "pending", evidence: ev(id) });

function fakeDb(error: { code?: string; message: string } | null = null) {
  const inserted: Record<string, unknown>[] = [];
  return { inserted, from: () => ({ insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error }; } }) };
}
const ask = (db: ReturnType<typeof fakeDb>, over: Partial<Parameters<typeof requestWonApproval>[1]> = {}) =>
  requestWonApproval(db, { dealId: D1, dealName: "Deal Demo", dealStage: "proposal", wonKey: "won", pending: [], ...over });

describe("reading approvals", () => {
  it("takes the deal id from the evidence and ignores anything that is not structured", () => {
    expect(approvalDealId(ev(D1))).toBe(D1);
    expect(approvalDealId("Importe: 100. Justificación: texto libre")).toBeNull();
    expect(approvalDealId(null)).toBeNull();
  });
  it("counts only pending stage changes of that deal", () => {
    const rows: ApprovalRow[] = [pend(D1), pend(D2), { kind: "stage_change", status: "applied", evidence: ev(D1) }, { kind: "discount", status: "pending", evidence: ev(D1) }];
    expect(pendingStageChanges(rows, D1)).toHaveLength(1);
    expect([...pendingWonDealIds(rows)].sort()).toEqual([D1, D2]);
  });
});

describe("CA-1 first request", () => {
  it("creates one request with the deal and the won stage", async () => {
    const db = fakeDb();
    expect(await ask(db)).toEqual({ result: "created" });
    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0]).toMatchObject({ kind: "stage_change", title: "Marcar como Ganado: Deal Demo" });
    expect(JSON.parse(String(db.inserted[0]!.evidence))).toEqual({ deal_id: D1, stage: "won" });
  });
});

describe("CA-2 already pending", () => {
  it("does not create another, with one or several pending", async () => {
    for (const n of [1, 2]) {
      const db = fakeDb();
      expect(await ask(db, { pending: Array.from({ length: n }, () => pend(D1)) })).toEqual({ result: "already-pending" });
      expect(db.inserted).toHaveLength(0);
    }
  });
  it("a pending request of another deal does not count", async () => {
    const db = fakeDb();
    expect((await ask(db, { pending: [pend(D2)] })).result).toBe("created");
  });
  it("a lost race (unique violation) counts as already pending", async () => {
    const db = fakeDb({ code: "23505", message: 'duplicate key value violates unique constraint "approvals_one_pending_stage_change_per_deal"' });
    expect(await ask(db)).toEqual({ result: "already-pending" });
  });
});

describe("CA-4a a new request after the previous one was resolved", () => {
  it("creates it when no pending request is left", async () => {
    const db = fakeDb();
    const resolved: ApprovalRow = { kind: "stage_change", status: "skipped", evidence: ev(D1) };
    expect((await ask(db, { pending: [resolved] })).result).toBe("created");
  });
});

describe("CA-4b deal already Ganado", () => {
  it("creates nothing", async () => {
    const db = fakeDb();
    expect(await ask(db, { dealStage: "won" })).toEqual({ result: "already-won" });
    expect(db.inserted).toHaveLength(0);
  });
});

describe("CA-4c failed save", () => {
  it("reports the error and leaves nothing pending", async () => {
    const db = fakeDb({ code: "42501", message: "permission denied" });
    expect(await ask(db)).toEqual({ result: "error", error: { code: "42501", message: "permission denied" } });
  });
});

describe("CA-6 move blocked while a request is pending", () => {
  it("blocks any other stage, never «won» (that case answers already pending)", () => {
    expect(blockedByPendingWon(1, "negotiation")).toBe(true);
    expect(blockedByPendingWon(2, "lost")).toBe(true);
    expect(blockedByPendingWon(0, "negotiation")).toBe(false);
    expect(blockedByPendingWon(1, "won")).toBe(false);
  });
  it("outcome table", () => {
    expect(wonRequestOutcome({ dealStage: "proposal", pending: 0 })).toBe("create");
    expect(wonRequestOutcome({ dealStage: "proposal", pending: 1 })).toBe("already-pending");
    expect(wonRequestOutcome({ dealStage: "won", pending: 0 })).toBe("already-won");
  });
});
