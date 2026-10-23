import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUIET_DAYS, DEFAULT_RENEWAL_WINDOW_DAYS, customerHealth, customerRenewals, expansionOpportunities, lastActivityByAccount, nextAnniversary, readCustomerSettings, wonKeysOf,
  type WonDeal,
} from "./customers";
import { DETECTORS } from "./proactive";
import { renewalUpcoming } from "./proactive/detectors/renewal-upcoming";
import { customerAtRisk } from "./proactive/detectors/customer-at-risk";
import type { Snapshot } from "./proactive/types";

const NOW = new Date("2026-10-20T10:00:00Z");
const ago = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();
const won = (o: Partial<WonDeal> & { id: string }): WonDeal => ({ name: `Deal ${o.id}`, account_id: "a1", stage: "won", amount: 12000, closed_at: "2025-11-05T09:00:00Z", close_date: null, updated_at: ago(5), owner_id: "u1", ...o });
const WON = new Set(["won"]);

describe("nextAnniversary", () => {
  const d = (s: string) => nextAnniversary(new Date(s), NOW).toISOString().slice(0, 10);
  it("is this year's anniversary when it has not passed", () => expect(d("2025-11-05T09:00:00Z")).toBe("2026-11-05"));
  it("shows a renewal due today", () => expect(d("2025-10-20T23:00:00Z")).toBe("2026-10-20"));
  it("moves to next year once the day has passed", () => expect(d("2025-10-19T09:00:00Z")).toBe("2027-10-19"));
  it("29 Feb falls back to 28 Feb in a common year", () => expect(d("2024-02-29T09:00:00Z")).toBe("2027-02-28"));
});

describe("readCustomerSettings", () => {
  it("uses provisional defaults and says so", () => {
    expect(readCustomerSettings(null)).toMatchObject({ renewalWindowDays: DEFAULT_RENEWAL_WINDOW_DAYS, quietDays: DEFAULT_QUIET_DAYS, renewalSource: "defecto", quietSource: "defecto" });
  });
  it("the company's numbers win; garbage is ignored", () => {
    expect(readCustomerSettings({ renewal_window_days: 45, quiet_customer_days: "30" })).toMatchObject({ renewalWindowDays: 45, quietDays: 30, renewalSource: "empresa", quietSource: "empresa" });
    expect(readCustomerSettings({ renewal_window_days: -3, quiet_customer_days: "x" })).toMatchObject({ renewalSource: "defecto", quietSource: "defecto" });
  });
});

describe("customerRenewals", () => {
  const lines = [{ deal_id: "d1", billing: "annual" }, { deal_id: "d2", billing: "monthly" }, { deal_id: "d3", billing: "annual" }, { deal_id: "d4", billing: "one_off" }];
  it("only deals with an annual line renew; monthly and one-off have no date", () => {
    const r = customerRenewals([won({ id: "d2" }), won({ id: "d4", account_id: "a2" })], lines, WON, NOW, 90);
    expect(r).toEqual([]);
  });
  it("keeps the soonest renewal per customer, sorted by days left, and flags the window", () => {
    const r = customerRenewals([
      won({ id: "d1", closed_at: "2025-12-30T09:00:00Z" }),
      won({ id: "d3", closed_at: "2025-11-05T09:00:00Z" }),
      won({ id: "d5", account_id: "a2", closed_at: "2025-10-25T09:00:00Z" }),
    ], [...lines, { deal_id: "d5", billing: "annual" }], WON, NOW, 30);
    expect(r.map((x) => [x.account_id, x.deal_id, x.renews_on, x.days_left, x.within_window])).toEqual([
      ["a2", "d5", "2026-10-25", 5, true],
      ["a1", "d3", "2026-11-05", 16, true],
    ]);
  });
  it("ignores open deals, deals without account and deals without a close date", () => {
    const r = customerRenewals([won({ id: "d1", stage: "demo" }), won({ id: "d3", account_id: null }), won({ id: "d1", closed_at: null, close_date: null })], lines, WON, NOW, 90);
    expect(r).toEqual([]);
  });
  it("won stages come from the company's own stage kinds", () => {
    expect([...wonKeysOf([{ key: "cerrado", kind: "won" }, { key: "demo", kind: "open" }])]).toEqual(["cerrado"]);
    expect([...wonKeysOf([])]).toEqual(["won"]);
  });
});

describe("customerHealth", () => {
  const h = (o: Partial<Parameters<typeof customerHealth>[0]>) => customerHealth({ accountHealth: "green", lastActivityAt: ago(10), quietDays: 60, now: NOW, ...o });
  it("payments are always unknown: Stripe is not linked to accounts", () => {
    expect(h({}).senales.find((s) => s.id === "pago")).toMatchObject({ estado: "sin datos" });
  });
  it("green and recent activity is sano, with the evidence of each signal", () => {
    const r = h({});
    expect(r.nivel).toBe("sano");
    expect(r.senales.find((s) => s.id === "actividad")?.evidencia).toContain("10 días");
  });
  it("a red account sheet is riesgo; yellow is vigilar", () => {
    expect(h({ accountHealth: "red" }).nivel).toBe("riesgo");
    expect(h({ accountHealth: "yellow" }).nivel).toBe("vigilar");
  });
  it("silence over the limit is riesgo and says how many days", () => {
    const r = h({ lastActivityAt: ago(61) });
    expect(r.nivel).toBe("riesgo");
    expect(r.senales.find((s) => s.id === "actividad")?.evidencia).toContain("61 días");
    expect(h({ lastActivityAt: ago(60) }).nivel).toBe("sano");
  });
  it("no data at all is «sin datos», never sano or a zero", () => {
    expect(h({ accountHealth: null, lastActivityAt: null }).nivel).toBe("sin datos");
  });
});

describe("lastActivityByAccount", () => {
  it("takes the latest per account and ignores future dates and rows without account", () => {
    const m = lastActivityByAccount([
      { account_id: "a1", at: ago(10) }, { account_id: "a1", at: ago(3) }, { account_id: "a1", at: new Date(NOW.getTime() + 864e5).toISOString() },
      { account_id: null, at: ago(1) }, { account_id: "a2", at: null },
    ], NOW);
    expect(m.get("a1")).toBe(ago(3));
    expect(m.has("a2")).toBe(false);
  });
});

describe("expansionOpportunities", () => {
  it("lists customers with whitespace or products not bought; leaves out the rest", () => {
    const r = expansionOpportunities(
      new Set(["a1", "a2", "a3"]),
      [{ account_id: "a1", whitespace: "  Equipo de ventas EMEA " }, { account_id: "a2", whitespace: "" }],
      new Map([["a1", 1]]),
      new Map([["a1", new Set(["p1", "p2"])], ["a2", new Set(["p1", "p2"])], ["a3", new Set(["p1"])]]),
      [{ id: "p1", name: "Core" }, { id: "p2", name: "Add-on" }],
    );
    expect(r).toEqual([
      { account_id: "a1", whitespace: "Equipo de ventas EMEA", open_deals: 1, not_contracted: [] },
      { account_id: "a3", whitespace: null, open_deals: 0, not_contracted: ["Add-on"] },
    ]);
  });
});

const base = (o: Partial<Snapshot> = {}): Snapshot => ({ now: NOW, orgId: "o", setup: {} as never, deals: [], meetings: [], accounts: [], stakeholders: [], registrations: [], trials: [], segments: [], ...o });
const dealRow = (o: Record<string, unknown>) => ({ id: "d1", name: "Acme anual", stage: "won", amount: 12000, close_date: null, closed_at: "2025-11-05T09:00:00Z", updated_at: ago(5), owner_id: "u1", meddpicc: {}, account_id: "a1", ...o });
const acct = (o: Record<string, unknown> = {}) => ({ id: "a1", name: "Acme", is_target: false, owner_id: "u2", ...o });

describe("renewal_upcoming", () => {
  const s = (o: Partial<Snapshot> = {}) => base({ deals: [dealRow({})] as never, dealLines: [{ deal_id: "d1", billing: "annual" }], accounts: [acct()], ...o });
  it("is registered with the other detectors", () => {
    expect(DETECTORS).toContain(renewalUpcoming);
    expect(DETECTORS).toContain(customerAtRisk);
  });
  it("proposes the renewal deal inside the window, keyed by the renewal date", () => {
    const [r] = renewalUpcoming(s());
    expect(r).toMatchObject({ detector: "renewal_upcoming", dedupe_key: "renewal_upcoming:a1:2026-11-05", user_id: "u2", title: "Acme renueva en 16 días" });
    expect(r.action).toEqual({ tool: "create_deal", args: { name: "Renovación: Acme", account_id: "a1", close_date: "2026-11-05", amount: 12000 } });
    expect(r.body).toContain("estimada");
  });
  it("stays quiet when someone is already working the account, outside the window, or without an annual line", () => {
    expect(renewalUpcoming(s({ deals: [dealRow({}), dealRow({ id: "d9", stage: "demo", closed_at: null })] as never }))).toEqual([]);
    expect(renewalUpcoming(s({ customerSettings: readCustomerSettings({ renewal_window_days: 10 }) }))).toEqual([]);
    expect(renewalUpcoming(s({ dealLines: [{ deal_id: "d1", billing: "monthly" }] }))).toEqual([]);
  });
});

describe("customer_at_risk", () => {
  const s = (o: Partial<Snapshot> = {}) => base({ deals: [dealRow({})] as never, accounts: [acct()], accountHealth: [{ id: "a1", health: "green" }], activity: [{ account_id: "a1", at: ago(90) }], ...o });
  it("proposes reviewing a customer silent for longer than the limit, with the evidence", () => {
    const [r] = customerAtRisk(s());
    expect(r).toMatchObject({ detector: "customer_at_risk", dedupe_key: "customer_at_risk:a1:actividad", priority: 2, user_id: "u2" });
    expect(r.body).toContain("90 días");
    expect(r.action).toMatchObject({ tool: "create_task", args: { account_id: "a1", owner_id: "u2" } });
  });
  it("two risk signals are priority 1 and key a different reminder", () => {
    const [r] = customerAtRisk(s({ accountHealth: [{ id: "a1", health: "red" }] }));
    expect(r.priority).toBe(1);
    expect(r.dedupe_key).toBe("customer_at_risk:a1:actividad,cuenta");
  });
  it("accounts that are not customers, recent activity and «sin datos» stay quiet", () => {
    expect(customerAtRisk(s({ deals: [dealRow({ stage: "demo" })] as never }))).toEqual([]);
    expect(customerAtRisk(s({ activity: [{ account_id: "a1", at: ago(5) }] }))).toEqual([]);
    expect(customerAtRisk(s({ accountHealth: [{ id: "a1", health: null }], activity: [] }))).toEqual([]);
  });
});
