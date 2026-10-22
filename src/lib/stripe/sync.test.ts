import { describe, expect, it, vi } from "vitest";
import { fetchSubscriptions, stripeErrorText, syncStripeOrg } from "./sync.server";

const sub = (id: string) => ({
  id, customer: `c_${id}`, status: "active", currency: "eur", start_date: 1, created: 1, canceled_at: null, ended_at: null,
  items: { data: [{ quantity: 1, price: { currency: "eur", unit_amount: 4900, billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1 } } }] },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("stripe sync", () => {
  it("pages through subscriptions with the key, pinned version and expanded discounts", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ data: [sub("a"), sub("b")], has_more: true }))
      .mockResolvedValueOnce(json({ data: [sub("c")], has_more: false }));
    const r = await fetchSubscriptions("rk_test_x", fetcher as unknown as typeof fetch);
    expect(r.subs.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(r.truncated).toBe(false);
    const [url, init] = fetcher.mock.calls[1];
    expect(String(url)).toContain("starting_after=b");
    expect(String(url)).toContain("expand%5B%5D=data.discounts");
    expect(init.headers).toMatchObject({ Authorization: "Bearer rk_test_x", "Stripe-Version": "2024-06-20" });
  });
  it("explains Stripe's refusals in Spanish, without the key", () => {
    expect(stripeErrorText(401)).toMatch(/no acepta la clave/);
    expect(stripeErrorText(403)).toMatch(/Subscriptions/);
  });

  function fakeDb(key: string | null) {
    const writes: { table: string; op: string; row: unknown }[] = [];
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: key, error: null }),
      from: (table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { currency: "EUR" } }) }) }),
        insert: async (row: unknown) => { writes.push({ table, op: "insert", row }); return { error: null }; },
        update: (row: unknown) => ({ eq: async () => { writes.push({ table, op: "update", row }); return { error: null }; } }),
      }),
    };
    return { db, writes };
  }
  it("stores a snapshot and marks the connection ok", async () => {
    const { db, writes } = fakeDb("rk_test_x");
    const fetcher = vi.fn().mockResolvedValue(json({ data: [sub("a"), sub("b")], has_more: false }));
    const r = await syncStripeOrg(db as never, "org1", new Date("2026-10-22T00:00:00Z"), fetcher as unknown as typeof fetch);
    expect(r).toEqual({ ok: true });
    expect(writes[0]).toMatchObject({ table: "stripe_snapshots", op: "insert", row: { org_id: "org1", mrr: 98, active_customers: 2, currency: "EUR" } });
    expect(writes[1]).toMatchObject({ table: "stripe_connections", op: "update", row: { status: "ok", last_error: null } });
  });
  it("a refused key leaves the error on the connection and no snapshot", async () => {
    const { db, writes } = fakeDb("rk_test_x");
    const fetcher = vi.fn().mockResolvedValue(json({ error: { message: "Invalid API Key provided: rk_test_x" } }, 401));
    const r = await syncStripeOrg(db as never, "org1", new Date(), fetcher as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "stripe_connections", row: { status: "error" } });
    expect(JSON.stringify(writes)).not.toContain("rk_test_x");
  });
  it("without a key there is nothing to sync", async () => {
    const { db } = fakeDb(null);
    expect((await syncStripeOrg(db as never, "org1")).ok).toBe(false);
  });
});
