import { describe, expect, it } from "vitest";
import { parseConfirmedAssistantAction, toRecordActivityArgs } from "./assistant-activity";

const base = {
  actionId: "6f1c2a4e-8b3d-4c5a-9e7f-1a2b3c4d5e6f",
  orgId: "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d",
  action: "create_task",
  status: "confirmed",
  confirmedBy: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
  confirmedAt: "2026-11-20T10:00:00.000Z",
};

describe("parseConfirmedAssistantAction", () => {
  it("acepta una accion confirmada completa", () => {
    const r = parseConfirmedAssistantAction(base);
    expect(r.ok).toBe(true);
  });

  it("rechaza una accion pendiente", () => {
    const r = parseConfirmedAssistantAction({ ...base, status: "pending" });
    expect(r.ok).toBe(false);
  });

  it("rechaza si falta quien confirmo, la empresa o la fecha", () => {
    const { confirmedBy: _a, ...sinQuien } = base;
    const { orgId: _b, ...sinEmpresa } = base;
    const { confirmedAt: _c, ...sinFecha } = base;
    expect(parseConfirmedAssistantAction(sinQuien).ok).toBe(false);
    expect(parseConfirmedAssistantAction(sinEmpresa).ok).toBe(false);
    expect(parseConfirmedAssistantAction(sinFecha).ok).toBe(false);
  });

  it("rechaza una accion vacia", () => {
    expect(parseConfirmedAssistantAction({ ...base, action: "   " }).ok).toBe(false);
  });
});

describe("toRecordActivityArgs", () => {
  it("toma la empresa de la accion confirmada", () => {
    const r = parseConfirmedAssistantAction(base);
    if (!r.ok) throw new Error("debia ser valida");
    const args = toRecordActivityArgs(r.value);
    expect(args._org_id).toBe(base.orgId);
    expect(args._action_id).toBe(base.actionId);
    expect(args._confirmed_by).toBe(base.confirmedBy);
  });

  it("la misma accion produce siempre la misma clave para no duplicar", () => {
    const a = parseConfirmedAssistantAction(base);
    const b = parseConfirmedAssistantAction({ ...base });
    if (!a.ok || !b.ok) throw new Error("debian ser validas");
    expect(toRecordActivityArgs(a.value)._action_id).toBe(toRecordActivityArgs(b.value)._action_id);
  });
});
