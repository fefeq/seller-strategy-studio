import { describe, expect, it } from "vitest";
import { checkStripeKey, itemMonthly, stripeMetrics, subscriptionMrr, type StripeSubscription } from "./metrics";

const NOW = new Date("2026-10-22T12:00:00Z");
const day = (d: string) => Math.floor(new Date(d).getTime() / 1000);
const price = (amount: number, interval: "month" | "year" | "week" = "month", currency = "eur", interval_count = 1) => ({ currency, unit_amount: amount, billing_scheme: "per_unit", recurring: { interval, interval_count } });
const sub = (id: string, customer: string, status: StripeSubscription["status"], items: { quantity: number; price: ReturnType<typeof price> }[], opts: Partial<StripeSubscription> = {}): StripeSubscription => ({
  id, customer, status, currency: items[0]?.price.currency ?? "eur", start_date: day("2026-01-10"), created: day("2026-01-10"), canceled_at: null, ended_at: null, items: { data: items }, ...opts,
});

describe("stripe metrics", () => {
  it("normalises prices to a month", () => {
    expect(itemMonthly({ quantity: 2, price: price(4900) })).toBe(98);
    expect(itemMonthly({ quantity: 1, price: price(120000, "year") })).toBe(100);
    expect(itemMonthly({ quantity: 1, price: price(30000, "month", "eur", 3) })).toBe(100);
    expect(itemMonthly({ quantity: 1, price: { ...price(1000), currency: "jpy" } })).toBe(1000);
    expect(itemMonthly({ quantity: 1, price: { ...price(0), unit_amount: null, billing_scheme: "tiered" } })).toBeNull();
  });
  it("applies recurring discounts, ignores one-off ones", () => {
    const s = sub("s", "c", "active", [{ quantity: 1, price: price(10000) }], { discounts: [{ coupon: { percent_off: 20, amount_off: null, currency: null, duration: "forever" } }] });
    expect(subscriptionMrr(s).mrr).toBe(80);
    const once = sub("s", "c", "active", [{ quantity: 1, price: price(10000) }], { discounts: [{ coupon: { percent_off: 50, amount_off: null, currency: null, duration: "once" } }] });
    expect(subscriptionMrr(once).mrr).toBe(100);
  });
  it("MRR, customers, new and churned in the last 30 days", () => {
    const subs = [
      sub("a", "c1", "active", [{ quantity: 1, price: price(4900) }]),
      sub("b", "c2", "past_due", [{ quantity: 1, price: price(19900) }]),
      sub("c", "c3", "active", [{ quantity: 1, price: price(1500) }], { start_date: day("2026-10-15") }),
      sub("d", "c4", "canceled", [{ quantity: 1, price: price(4900) }], { canceled_at: day("2026-10-01"), ended_at: day("2026-10-05") }),
      sub("e", "c5", "canceled", [{ quantity: 1, price: price(4900) }], { ended_at: day("2026-06-01") }),
      sub("f", "c6", "trialing", [{ quantity: 1, price: price(4900) }]),
      // c1 cancelled an old add-on but still pays: not churned.
      sub("g", "c1", "canceled", [{ quantity: 1, price: price(1000) }], { ended_at: day("2026-10-10") }),
      sub("h", "c7", "active", [{ quantity: 1, price: price(5000, "month", "usd") }]),
    ];
    const m = stripeMetrics(subs, "EUR", NOW);
    expect(m.mrr).toBe(49 + 199 + 15);
    expect(m.arr).toBe((49 + 199 + 15) * 12);
    expect(m.activeCustomers).toBe(3);
    expect(m.trialing).toBe(1);
    expect(m.newCustomers).toBe(1);
    expect(m.newMrr).toBe(15);
    expect(m.churnedCustomers).toBe(1);
    expect(m.churnedMrr).toBe(59); // c4 49 + c1's add-on 10
    expect(m.logoChurnPct).toBeCloseTo((1 / 3) * 100);
    expect(m.otherCurrencies).toEqual({ USD: { mrr: 50, customers: 1 } });
  });
  it("checks the key shape", () => {
    expect(checkStripeKey(" rk_live_51AbCdEfGhIjKl ")).toMatchObject({ ok: true, live: true, restricted: true });
    expect(checkStripeKey("sk_test_51AbCdEfGhIjKl")).toMatchObject({ ok: true, live: false, restricted: false });
    expect(checkStripeKey("pk_live_51AbCdEfGhIjKl").ok).toBe(false);
    expect(checkStripeKey("hola").ok).toBe(false);
  });
});
