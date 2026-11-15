// A3: the daily quota is reserved by the atomic RPC; received_count is incremented atomically.
import { describe, expect, it, vi } from "vitest";
import { enforceLimits } from "./intake.server";
import { bumpReceived } from "./intake-counter.server";

const src = { id: "s1", org_id: "o1", max_per_request: 10, daily_limit: 5, day_count: 0, day_date: null, received_count: 3 } as never;
function fakeDb(rpcResult: unknown, rpcError: unknown = null) {
  const updates: unknown[] = [];
  const rpc = vi.fn(async () => ({ data: rpcResult, error: rpcError }));
  const from = () => ({ update: (v: unknown) => { updates.push(v); return { eq: async () => ({}) }; }, insert: async () => ({}) });
  return { db: { rpc, from } as never, rpc, updates };
}

describe("enforceLimits uses the atomic reservation", () => {
  it("ok from the RPC writes nothing else", async () => {
    const f = fakeDb({ ok: true, dayCount: 2, dayDate: "2026-11-15" });
    expect(await enforceLimits(f.db, src, 2)).toBeNull();
    expect(f.rpc).toHaveBeenCalledWith("reserve_intake_quota", expect.objectContaining({ _source: "s1", _n: 2 }));
    expect(f.updates).toHaveLength(0);
  });
  it("a refused reservation returns 429 (the pause happens inside the RPC)", async () => {
    const f = fakeDb({ ok: false, status: 429, error: "Límite diario", pause: true });
    expect(await enforceLimits(f.db, src, 9)).toEqual({ status: 429, error: "Límite diario" });
    expect(f.updates).toHaveLength(0);
  });
  it("a failed reservation accepts nothing (503), no non-atomic fallback", async () => {
    const f = fakeDb(null, { message: "down" });
    expect((await enforceLimits(f.db, src, 1))!.status).toBe(503);
    expect(f.updates).toHaveLength(0);
  });
  it("an RPC failure never overwrites the counter", async () => {
    const f = fakeDb(null, { message: "down" });
    await bumpReceived(f.db, src, 4);
    expect(f.updates).toHaveLength(0);
  });
});

describe("bumpReceived", () => {
  it("increments through the RPC, never read-modify-write", async () => {
    const f = fakeDb(null);
    await bumpReceived(f.db, src, 4);
    expect(f.rpc).toHaveBeenCalledWith("bump_intake_received", { _source: "s1", _n: 4 });
    expect(f.updates).toHaveLength(0);
  });
  it("an RPC failure never overwrites the counter", async () => {
    const f = fakeDb(null, { message: "down" });
    await bumpReceived(f.db, src, 4);
    expect(f.updates).toHaveLength(0);
  });
});
